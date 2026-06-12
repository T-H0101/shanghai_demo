# Sprint R.18-R.25 推进路线 - 站点 Agent 闭环落地

> 日期: 2026-06-12
> 基线: R.17, commit `8510f89`
> 状态: 实施路线
> 最高标准: `docs/source/requirements.md`

## 0. 实施决策

当前阶段按以下方式推进:

- 允许站点 Agent 主动轮询总控命令。
- 允许站点 Agent 在站点本地调用数据库或站点 API 执行操作。
- 站点 Agent 必须回传 ack、执行结果、错误和最终状态。
- 总控不直接连接或修改生产站点数据库。
- 站点执行适配层必须可替换，后续可切换为正式站点 API、消息队列或站点应用内置模块。
- 此方案属于当前实施基线，最终与其他外部依赖、schema 变更一起提交领导确认。

该决策解除当前开发阶段的 `blocked_by_site_change` 设计阻塞，但 requirement 只有在真实站点 Agent 部署并完成端到端验证后才能标记 `complete`。

## 1. 当前真实状态

### 1.1 已实现

| 能力 | 当前状态 |
|---|---|
| 中心同步接收 | `POST /api/sync/package` 已具备 HMAC、校验、幂等、dispatcher 和日志 |
| 小表同步 | 13 张 package 白名单表 |
| 一致性校验 | 7 张已接入表可执行 source/center 对比 |
| 同步调度 | export -> push -> consistency -> scheduler log |
| 总控查看 | tasks/racks/volumes/sites/sync/logs/settings 多数已接真实中心表 |
| 控制队列 | `control_command`、poll、ack、result API 已存在 |
| 测试执行器 | pause/resume 可写测试站点 `tbl_task.status` |
| 审计 | 控制、同步、导出已有审计和运行日志 |

### 1.2 未完成

| 能力 | 真实缺口 |
|---|---|
| 真实站点同步 | exporter/scheduler 仍是仓库脚本，未形成可部署站点 Agent |
| 真实站点控制 | worker 仍可直接读中心库，未使用完整站点 HTTP 协议闭环 |
| 控制动作 | pause/resume 有官方状态依据；reset 语义未确认；priority/inspect/recovery 缺 schema |
| 文件索引 | 只有 4 行任务级索引样本，未接 ES，不能做千万级跨站检索 |
| 权限同步 | 用户/角色/部门关系未形成完整同步；真实站点多数相关表为 0 行 |
| 多站点 | 尚未在两个独立站点数据库和 Agent 上完成部署验证 |
| 安全 | site-control 当前是简化 secret 校验，不是完整请求级 HMAC |
| 运维 | 缺 Agent 安装、升级、心跳、离线缓存、重试和告警闭环 |

### 1.3 禁止使用的错误指标

- 不以 `13/170` 表覆盖率判断项目完成度。
- 不为了提高 requirements 完成率接入无业务用途的表。
- 不把中心库有数据等同于站点 Agent 已落地。
- 不把测试库直写等同于站点应用完成控制。
- 不预测某个 Sprint 必然把 requirement 升为 `complete`。

项目验收按 requirement 垂直闭环计算，而不是按表数量或页面数量计算。

## 2. 目标架构

```text
Site Agent
  |
  +-- Local Reader
  |     +-- 小表 snapshot/hash diff
  |     +-- 有更新时间字段的增量读取
  |     +-- tbl_file/tbl_folder 有界索引读取
  |
  +-- Sync Client
  |     +-- POST /api/sync/package
  |     +-- HMAC、幂等、重试、离线队列
  |
  +-- Control Client
  |     +-- GET  /api/site-control/commands
  |     +-- POST /api/site-control/commands/:id/ack
  |     +-- 本地 adapter 执行
  |     +-- POST /api/site-control/commands/:id/result
  |
  +-- Heartbeat Client
        +-- Agent/DB/设备/同步水位/版本状态

Unified Control Platform
  +-- site registry and safe config
  +-- package validation and dispatcher
  +-- unified summaries in PG17
  +-- command queue and immutable audit
  +-- consistency, retry and alert orchestration
  +-- read APIs and current UI

External data planes
  +-- Elasticsearch: 完整文件/目录索引
  +-- ClickHouse: 高频运行/API/系统日志
```

### 2.1 必须保留的扩展边界

```typescript
interface SiteActionAdapter {
  capabilities(): Promise<SiteCapability[]>
  execute(command: SiteCommand): Promise<SiteCommandResult>
}
```

首期实现:

- `PostgresSiteActionAdapter`: 在 Agent 本地连接站点数据库。

后续可替换:

- `HttpSiteActionAdapter`: 调正式站点 API。
- `MessageQueueSiteActionAdapter`: 投递站点消息队列。
- `NativeAppSiteActionAdapter`: 嵌入站点应用。

总控协议和 UI 不依赖具体 adapter。

## 3. 数据接入原则

### 3.1 PG17 小表

适用于配置、关系、设备、任务、卷、介质等有限规模数据:

- snapshot + hash diff
- 或可靠更新时间字段增量
- UPSERT 到 `unified_*`
- 保留 `source_site_id/source_table/source_id/source_hash/synced_at/raw_data`

### 3.2 聚合表

大明细只进入 PG17 聚合结果:

- 文件数量和容量
- 任务错误数量
- 设备容量和健康摘要
- 日志数量和状态摘要

### 3.3 文件与目录

`tbl_file/tbl_folder`:

- 禁止加入 package 白名单。
- 禁止建立全量 `unified_files/unified_folders`。
- 禁止无条件全表扫描。
- PG17 仅保留 `unified_file_index/unified_folder_index` 有界任务级索引或聚合摘要。
- 读取必须携带 `taskId + last_id/watermark + limit <= 5000`。
- 完整跨站文件检索必须进入 Elasticsearch 后再验收。

### 3.4 高频日志

`tbl_sys_log/tbl_api_log`:

- 不做 PG17 全量复制。
- 当前可同步统计摘要和必要审计事件。
- 完整采集、模糊检索和两年留存依赖 ClickHouse 或等价日志系统。

## 4. R.18-R.25 实施顺序

### R.18 - 基线重构和 Agent 协议冻结

**Requirement**: §1.2、§2.1、§2.3、§4.2

交付:

1. 重算 requirements traceability，消除路线图和当前 JSON 的状态冲突。
2. 建立 requirement -> 源表 -> 同步类型 -> 中心目标 -> API -> UI -> e2e 矩阵。
3. 定义 Site Agent 配置、heartbeat、sync、control、result 协议。
4. 定义 capability 返回值和 unsupported/blocker 规则。
5. 把直连中心库的 worker 标为测试实现，不作为生产架构。
6. 输出领导待确认事项台账，但不阻塞后续实现。

验收:

- 不新增业务表或页面。
- schema 结论同时核对 requirements、disc_files.sql 和 star_storage_db。
- 路线图不再规划建立全量 `unified_files/unified_folders`。
- 产出 R.18 requirements review。

### R.19 - 可部署 Site Agent v1

**Requirement**: §1.2、§2.3.1、§2.3.2、§6.4

交付:

1. 站点 Agent 独立入口和配置模型。
2. 配置只保存环境变量 key 引用，不保存真实密码。
3. 从本地站点库导出已接入小表并推送总控。
4. package 生成改为流式/临时文件安全写入，失败可重试。
5. 支持幂等 batch、指数退避、离线队列和断点恢复。
6. 提供 Docker/systemd 部署方式、health endpoint 和结构化日志。
7. SH01 以独立进程运行，不由总控 scheduler 直接读取站点库。

当前进度:

- R.19A 已完成 heartbeat 请求级 HMAC、nonce 防重放、
  `site_agent_runtime` 持久化和 `/sync` 状态展示。
- 独立 Agent 进程、package push、spool、control poll/ack/result 仍未完成。

验收:

- Agent 停止时总控显示离线或过期，不显示同步成功。
- 网络中断后自动补传且不重复入库。
- Agent 日志不打印密码或 secret。
- `smoke:sync`、scheduler、sites、sync e2e 全部通过。

### R.20 - 必要小表扩展

**Requirement**: §2.1、§2.3.1、§3.1、§3.2、§3.3、§4.2、§4.3

按真实数据和 requirement 优先接入:

| 批次 | 源表 | 用途 | 存储方式 |
|---|---|---|---|
| A | `tbl_drivers`, `tbl_lib_group`, `tbl_early_warning` | 设备和站点监控 | PG17 small/snapshot |
| B | `tbl_role`, `tbl_fuc`, `tbl_user_role`, `tbl_depa`, `tbl_depa_user` | 权限和部门只读视图 | PG17 small/snapshot |
| C | 任务错误/巡检/恢复相关小表 | 任务详情、能力判断 | PG17 small/aggregate |
| D | 字典和必要配置表 | DTO 解释和状态映射 | PG17 small/snapshot |

约束:

- 每个提交只接一个源表或一个最小聚合单元。
- 源表 0 行时只验链路和 empty state，不标业务 complete。
- 不实现 ADFS/JWT/RBAC 写操作。
- 不一次性把剩余 157 张表加入白名单。

验收:

- 每张表有 schema patch、mapper、dispatcher、source/center SQL、API 证据。
- 每张表有一致性规则。
- UI 已有位置需要该数据时才接入；禁止为了表覆盖率新增页面。

### R.21 - 同步策略和一致性闭环

**Requirement**: §2.3.2、§2.3.3、§6.1、§6.4

交付:

1. Agent 按表支持 snapshot、incremental、append_incremental、aggregate。
2. 关键任务/设备状态使用短周期或变更事件推送。
3. 非关键小表按可配置周期同步。
4. 每日一致性校验和差异报告。
5. 总控发起“重同步请求”，Agent 拉取后执行，不由总控直连数据库。
6. 支持失败重试、手动重试、最终失败告警。
7. Sync Center 展示每站点、每表水位、延迟、最后成功和错误。

验收:

- 关键状态同步延迟按 requirements 实测。
- 人工修复必须表现为可审计的重同步命令。
- 不能用修改中心表数据伪造一致。

### R.22 - 控制闭环 v1

**Requirement**: §4.2.1、§4.2.2、§6.2

首期只完成有可靠证据的动作:

| 动作 | 当前依据 | R.22 处理 |
|---|---|---|
| pause | 官方 `status=20` | 实现真实闭环 |
| resume | 官方 `status=0`，需校验任务类型和前态 | 实现真实闭环 |
| reset | 当前 SQL 语义与官方文档不一致 | 保持 unsupported |
| priority restore | 缺 `priority` 字段/正式 API | 保持 blocked |
| inspect | 缺必要 schema/站点行为 | 保持 blocked |
| recovery | 缺必要 schema/站点行为 | 保持 blocked |

生产链路:

1. 总控写 `control_command=pending`。
2. Agent 通过 HTTPS poll。
3. Agent ack 为 running。
4. Agent capability 和前置状态校验。
5. Agent 本地事务执行，记录 before/after。
6. Agent result 回传 success/failed/unsupported。
7. Agent 立即同步相关任务。
8. 总控 UI 展示最终站点状态和审计。

验收:

- 禁止生产 UI 调 `/api/control/commands/[id]/execute` 直写站点。
- success 必须来自 Agent `dryRun=false` 结果。
- Agent 重启、重复 poll、重复 result 不重复执行命令。
- pause/resume 分别完成真实站点端到端验证。

### R.23 - 任务创建与其余控制能力

**Requirement**: §4.2

交付:

1. `task_create_backup/task_create_restore` 使用控制命令协议。
2. Agent adapter 根据站点正式约束调用 API 或执行本地事务。
3. 不允许总控同时写 `unified_tasks` 和站点业务表。
4. 中心任务只在站点接受并回传后出现真实 source identity。
5. reset、priority、inspect、recovery 按 schema/API 决策逐项实现。
6. 无正式语义的动作保持 disabled/unsupported。

验收:

- 一个 commit 只关闭一个原子动作。
- 每个动作必须有站点 before/after、result、同步回读、UI 和 e2e。
- 需要站点 DDL 的动作先生成 patch 建议，不擅自修改生产 schema。

### R.24 - 多站点统一查看和运维

**Requirement**: §2.1、§4.2.4、§4.3、§5.1、§6.4

交付:

1. 真实站点 registry 和 Agent heartbeat。
2. 每站点同步/控制 capability、版本、延迟和错误。
3. 任务、设备、盘笼、容量、同步、日志页面统一 siteCode 行为。
4. 盘笼移位采用“总控登记 -> 站点确认 -> 移入 Agent 上报”状态机。
5. 告警从同步失败、Agent 离线、任务失败、设备异常产生。
6. Settings 只展示安全配置和 env key 引用；写操作在 auth 缺失时禁用。

验收:

- 至少两个独立站点 Agent/数据库实例验证。
- 站点断连不影响其他站点查看。
- 不跨站串数据。
- 盘笼移位不能只写中心日志后宣称完成。

### R.25 - 生产验收和最终汇报

**Requirement**: §6.1、§6.2、§6.3、§6.4

交付:

1. 普通查询、复杂查询、导出、同步延迟和控制响应性能报告。
2. 20 并发用户和多 Agent 并发测试。
3. Agent 断网、中心重启、数据库不可用、重复命令和重放攻击测试。
4. site-control 升级为请求级 HMAC，包含 siteCode、timestamp、nonce、body hash。
5. 审计留存、不可篡改、备份恢复和运行监控方案。
6. Chrome/Firefox/Edge 关键流程验证。
7. 最终 requirements review 和领导汇报材料。

## 5. 每个 Sprint 的强制闭环

每个 Sprint 必须:

1. 引用 requirements 原文和 Req ID。
2. 使用当前代码、disc_files.sql、star_storage_db 和中心库重新验证。
3. 完成 DB/API/Agent/UI/e2e/docs 中实际涉及的层。
4. 前端事件逐项完成事件级 e2e。
5. 输出 `docs/database-analysis/sprint-<X>-requirements-review.md`。
6. 更新 traceability、PROJECT_STATUS 和 ROADMAP。
7. 所有检查通过后才能 commit。

强制检查:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

涉及 Agent/control:

```bash
pnpm test:e2e:worker
```

## 6. 真实里程碑

### M1 - 可部署同步

- SH01 Agent 作为独立服务运行。
- 小表真实推送、重试、幂等、心跳、告警成立。
- 总控不直接读取 SH01 数据库。

### M2 - 两个真实控制动作

- pause/resume 由 Agent poll、执行、回传、同步回读。
- UI 展示最终状态。
- 重复命令不重复执行。

### M3 - 多站点

- 第二个独立站点接入。
- registry、配置、同步、控制、查看均按 siteCode 隔离。

### M4 - 文件检索和完整日志

- Elasticsearch 和 ClickHouse 获批并接入。
- 文件检索、文件索引导出、日志模糊检索达到 requirements 性能。

### M5 - Auth 和权限

- ADFS/JWT/RBAC 获批并接入。
- 所有读取和控制按站点、部门、设备、数据权限校验。

## 7. 最终提交领导的问题

实现过程中记录，R.25 集中汇报:

1. Site Agent 长期形态: 独立服务、站点 API、消息队列或嵌入站点应用。
2. Agent 是否允许直接修改站点数据库，哪些动作必须改走正式 API。
3. reset、priority restore、inspect、recovery 的官方业务语义和 schema/API。
4. 站点 schema patch 的审批、发布和回滚责任人。
5. Elasticsearch、ClickHouse、邮件/钉钉、数字证书的提供计划。
6. ADFS/JWT/RBAC 的责任团队和交付日期。
7. Agent 凭据签发、轮换、吊销和网络访问策略。
8. 生产站点名单、上线窗口、灰度和回滚策略。
9. 审计日志一年/两年留存、不可篡改和备份要求。

这些事项不阻塞当前可验证的 Agent、同步、控制和查看闭环开发；受其影响的 requirement 在证据完整前保持 `partial` 或相应 `blocked_*`。

## 8. 下一步

立即执行 R.18，不新增业务功能:

1. 修正 requirements traceability。
2. 固化 Agent v1 协议。
3. 生成表接入矩阵和六动作 capability 矩阵。
4. 明确测试直连路径与生产 Agent 路径。
5. 产出 R.18 requirements review。

R.18 通过后，从 R.19 开始实现可部署 Site Agent。
