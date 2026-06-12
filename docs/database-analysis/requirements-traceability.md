# Requirements Traceability Matrix

> 版本: R.18
> 日期: 2026-06-12
> 唯一标准: `docs/source/requirements.md`
> 机器可读完整 18 字段: `docs/database-analysis/requirements-traceability.json`

## 0. R.18 真相校准

R.18 将所有 `current_status` 规范为 8 选 1，并重新核对当前代码、`disc_files.sql`、170 表 `star_storage_db` 和中心库。旧矩阵统计写 6 个 complete，但 JSON 实际有 10 条 complete，且包含非枚举状态；该口径已废止。

| 状态 | 数量 |
|---|---:|
| `complete` | 3 |
| `partial` | 23 |
| `not_started` | 4 |
| `blocked_by_source_schema` | 4 |
| `blocked_by_site_change` | 1 |
| `blocked_by_auth` | 9 |
| `blocked_by_external_system` | 1 |
| `out_of_scope` | 0 |

**requirements 完成率: 3/45 = 6.7%**

下调原因:

- REQ-1.2.1: 控制生产链路尚未完成 Site Agent 松耦合部署。
- REQ-2.3.1: 文件完整索引和权限关系同步未完成。
- REQ-2.3.2: 实时同步、重试、告警、离线补传未完成。
- REQ-5.1.1: 当前日志不是站点刻录/回迁全量日志。
- REQ-6.1.1: 没有满足 requirements 规模的性能报告。
- REQ-6.2.1: HMAC 不等于敏感字段加密。
- REQ-6.3.1: 尚未完成 Firefox/Edge 实测。

## 1. R.18 实施决策

- 允许 Site Agent 主动轮询总控命令并在站点本地调用数据库/API。
- 总控不直接连接或修改生产站点数据库。
- 首期使用可替换的 Postgres adapter，后续可切换 HTTP/MQ/native adapter。
- 该决策解除设计阻塞，但没有 Agent 部署和端到端证据时不得标 `complete`。
- `tbl_file/tbl_folder` 禁止进入 package 全量同步，PG17 仅保留有界任务级索引/聚合，完整检索走 ES。

## 2. 当前需求矩阵

| Req ID | 需求 | 状态 | 后端现实 | 主要缺失 | 下一步 |
|---|---|---|---|---|---|
| REQ-1.1.1 | 集团层统一管控, 不替代各站点系统 | `complete` | 平台只做统一视图/管控, 写接口都标记为审计/模拟 |  | — |
| REQ-1.2.1 | 松耦合 (API/MQ 交互, 不侵入站点核心逻辑) | `partial` | 同步 package 通过 HMAC API 松耦合；控制侧仍存在测试用直连中心库/站点库路径。R.18 已冻结生产 Site Agent HTTP poll/ack/result 协议，待 R.19 部署验证。 | 可部署 Site Agent；生产控制路径移除中心库直连；请求级 HMAC 与心跳 | R.19 实现独立 Site Agent |
| REQ-2.1.1 | 站点配置 (名称/IP/状态/联系人) | `partial` | unified_sites 0 行；/api/sites 从真实中心业务表派生 7 个站点编码；sync_sites 2 条中心调度配置单独展示 | 源端 tbl_site 0 行；真实 IP/联系人/注册资料；站点配置写入权限与审计 | 等源端补 tbl_site 数据 |
| REQ-2.1.2 | 站点切换 (SSO 免登) | `blocked_by_auth` | 0 | 依赖 REQ-2.2.1 (ADFS) + 站点 URL 配置 | 等 REQ-2.2.1 解锁 |
| REQ-2.1.3 | 站点监控 (实时 + 告警, 采集 ≤5 分钟) | `partial` | UI 框架有, unified_sites 0 行 | 源端监控数据空 | 等源端补监控字段 |
| REQ-2.2.1 | ADFS 3.0+ / LDAP 集成登录 | `blocked_by_auth` | 0 — 颁发 mock_demo_<user>_<ts> 假 token | ADFS/LDAP 服务端 + JWT 签发 | 解锁 CLAUDE.md '不做登录权限系统' |
| REQ-2.2.2 | 集团 AD ↔ 站点本地账号映射 | `blocked_by_auth` | 0 | CLAUDE.md 禁 + 源端无 AD 通道 | 解锁 CLAUDE.md (Sprint 5.x) — R.4 不再标 out_of_scope (违反 R.1 §1) |
| REQ-2.2.3 | 登录审计 (≥1 年) + 失败 ≥5 次锁定 | `blocked_by_auth` | 仅 localStorage, 无服务端 | 服务端 audit_log + 锁定策略 | 解锁 Auth |
| REQ-2.3.1 | 同步范围 (设备/文件/权限/任务 4 类) | `partial` | 设备和任务小表已真实同步；权限仅 tbl_user 基础数据；文件仅 4 行任务级索引样本，完整文件索引未接 ES。 | 完整文件索引同步；角色/权限/部门关系同步；真实站点 Agent 部署 | R.19 Agent + R.20 必要小表扩展 |
| REQ-2.3.2 | 同步策略 (实时/定时/手动) | `partial` | 已有手动 trigger、定时 scheduler 和 HMAC package push；缺关键状态变更实时推送、自动重试告警和站点离线补传。 | 关键数据实时同步；可配置自动重试；最终失败告警；站点离线队列和补传 | R.19 Agent + R.21 同步策略闭环 |
| REQ-2.3.3 | 数据一致性校验 (每日差异报告) | `partial` | 7 张已接入源表可执行真实一致性校验并写 sync_consistency_log；R.11C 按配置站点聚合最近调度、数据包和一致性记录 | 每日自动执行保证；完整差异历史报告；人工修复；按数据类型配置 | 补每日调度保证、差异历史和人工修复流程 |
| REQ-3.1.1 | 账号维度 (Site 多对多 + 部门/角色) | `blocked_by_source_schema` | unified_users 当前 4 行；可读 source_site_id 和源端 role 编码，但无 Site 多对多、部门与标准化角色关系 | tbl_user 源端无 Site 多对多关系、部门关系和标准化角色映射 | 等源端补字段 |
| REQ-3.1.2 | 全 Site 提醒 (跨站点消息推送) | `blocked_by_site_change` | 0 | 源端无 push 通道 | 等站点 push 通道 |
| REQ-3.1.3 | 账号生命周期 (创建/启用/禁用/删除) | `blocked_by_auth` | 写入 API 不存在 | POST/PATCH/DELETE /api/users/* | 解锁 Auth |
| REQ-3.2.1 | 权限分配流程 (站点→设备→数据 两步) | `blocked_by_auth` | — | CLAUDE.md 禁 + 源端无 role 字段 | 解锁 CLAUDE.md + 5.x Sprint |
| REQ-3.2.2 | 权限生效 (实时 + 事务回滚) | `blocked_by_auth` | — | 依赖 REQ-3.2.1 | 等 REQ-3.2.1 |
| REQ-3.3.1 | 部门管理 (集团/部门/站点三级) | `blocked_by_source_schema` | 源 tbl_depa 0 行 | 源 tbl_depa 0 行 + CLAUDE.md 禁 | 等源端补数据 |
| REQ-3.3.2 | 权限审计 (操作/变更/撤销, ≥1 年不可篡改) | `blocked_by_auth` | — | 依赖 RBAC 体系 | 等 REQ-3.2.1 |
| REQ-4.1.1 | 跨维度检索 (名称/后缀/部门/卷/盘) | `not_started` | /api/search 路由 R.4 显式返回 source=not_implemented + blocker=blocked_by_external_system, 不再 404 | 跨站 ES 集群 + 千万级索引 | 领导决策: 引入 ES 集群 (估时 8d ES + 8d 项目) |
| REQ-4.1.2 | 检索性能 (≤3 秒, 千万级) | `blocked_by_external_system` | 当前 4 行任务级, 千万级未测 | ES 集群 + 千万级索引 | 领导决策: 接 ES (估时 8d ES + 8d 项目) |
| REQ-4.1.3 | 检索结果导出 (Excel/CSV) | `not_started` | 页面无导出按钮 | 导出 API + UI 按钮 | 后续 Sprint, 1 API + 1 按钮 |
| REQ-4.2.1 | 新建备份/恢复任务 | `partial` | 任务列表和运行字段真实；总控尚无通过 Site Agent 被站点接受的新建备份/恢复任务闭环。 | 任务创建命令协议；站点 Agent 创建适配器；站点接受结果和同步回读 | R.23 通过控制协议实现任务创建 |
| REQ-4.2.2 | 任务控制 (暂停/重置/恢复 + 优先执行恢复任务) | `partial` | 控制队列、poll/ack/result API、测试执行器和审计存在。pause status=20、resume status=0 有官方依据并可写测试站点库；生产 Site Agent 尚未部署。reset 语义未确认，priority 缺字段。 | 生产 Site Agent HTTP 闭环；pause/resume 生产站点验证；reset 官方语义；priority schema/API | R.19 建 Agent，R.22 关闭 pause/resume 两个原子动作 |
| REQ-4.2.3 | 数据巡检任务 (批量抽取 + SM3/哈希校验) | `partial` | inspect/recovery 命令类型和 unsupported 路径存在；站点候选表为空且缺必要字段，没有真实执行。 | 巡检 schema/API；恢复任务 schema/API；Agent 执行适配器；SM3/结果回传 | R.23 在官方 schema/API 明确后逐项实现 |
| REQ-4.2.4 | 任务监控: 进度/状态/告警 push (≤10s 刷新) | `partial` | 中心任务列表、进度字段和告警展示存在；缺 Agent 关键状态实时推送和责任人通知。 | 任务状态 <=10 秒同步；失败/超时告警；邮箱通知 | R.21 实时同步，R.24 告警 |
| REQ-4.3.1 | 盘笼移位登记 (原/目标/审批/状态) | `blocked_by_source_schema` | 源 tbl_magzines 无 from_site/to_site/approver/status 字段 | 源端补字段 + 站点推移位事件 | 等源端补 |
| REQ-4.3.2 | 盘笼统一查询 (在线/离线 + 导出) | `partial` | unified_devices 当前 13 台；SH01 4 台；R.11A 支持按 siteCode/status 导出真实 CSV，并返回记录数与 SHA-256 摘要 | Auth/RBAC 与站点权限过滤尚未接入 | Auth/RBAC 可用后补导出权限过滤与审计 |
| REQ-5.1.1 | 日志采集 (刻录/回迁全量 + 错误码) | `partial` | 已采集同步、调度、一致性、控制和审计日志；未采集站点刻录/回迁任务全量日志及文件列表。 | 刻录任务全量日志；回迁任务全量日志；错误码/文件列表完整字段；异步不丢失采集 | R.20 接必要摘要；完整高频日志待 ClickHouse |
| REQ-5.1.2 | 日志导出 (Excel/CSV + 数字签名) | `partial` | R.11B 真实导出 package/table/scheduler/consistency 四类日志，支持 CSV/JSON、siteCode、记录数和 SHA-256 完整性摘要 | Excel；证书或私钥数字签名；大数据分片/异步导出；两年留存策略；/logs 页面真实化 | 设计签名密钥托管、异步分片与留存策略后继续 |
| REQ-5.1.3 | 日志检索 (关键字/错误码/任务类型) | `partial` | 表格 + 基础筛选, 无模糊匹配 | 模糊匹配 API + UI 输入 | 后续 Sprint |
| REQ-5.2.1 | 索引范围 (按盘笼 + 校验码) | `blocked_by_source_schema` | 源 tbl_file 0 行 | 源 tbl_file 真实数据 + 校验码 | 等源端补 |
| REQ-5.2.2 | 导出方式 (手动触发 + 推送) | `not_started` | 无导出 API | 异步导出 + 推送 | 后续 Sprint |
| REQ-6.1.1 | 性能: 普通 ≤1s / 复杂 ≤2s / 导出 ≤30s | `partial` | 现有小数据 API/e2e 可运行；尚无 10 万条导出、复杂检索和统一性能报告。 | 普通/复杂查询基准；10 万条导出 <=30 秒；控制响应 <=1 秒验证 | R.25 性能验收 |
| REQ-6.1.2 | 并发 ≥20 用户 | `partial` | 单进程 dev 即可, 生产需 cluster | cluster 模式部署 | 后续 Sprint 部署 |
| REQ-6.1.3 | 数据同步时效 (增量 ≤10s / 全量 ≤30min) | `partial` | 手动 trigger 与 scheduler 记录可查；R.11C 聚合每站点最近运行时间和状态，周期同步仍由站点侧负责 | 站点侧周期同步客户端 | 等站点侧 |
| REQ-6.2.1 | 传输加密 (敏感字段) | `partial` | sync package 使用 HMAC 做完整性和身份校验，但 HMAC 不是敏感字段加密；site-control 仍是简化 secret 比对。 | TLS 部署证据；敏感字段额外加密；site-control 请求级 HMAC；凭据轮换 | R.19 不落 secret，R.25 请求级 HMAC 和传输验收 |
| REQ-6.2.2 | 存储加密 (不可逆 + 分区隔离) | `not_started` | 无密码字段, 无 TDE | 密码字段 + 不可逆加密 + 分区 | 等 Auth |
| REQ-6.2.3 | 操作审计 (不可篡改) | `partial` | 同步层有, 业务层无 (需 Auth) | 业务操作 audit_log | 等 Auth |
| REQ-6.2.4 | 防越权 (跨站/跨部门) | `blocked_by_auth` | 无 RBAC | RBAC 体系 | 等 Auth + RBAC |
| REQ-6.3.1 | 前端兼容 (Chrome/Firefox/Edge ≥1920) | `partial` | 当前前端基于 Tailwind/Radix，主要在 Chromium e2e 验证；未完成 Firefox/Edge 和 1920x1080 验收。 | Firefox 验证；Edge 验证；1920x1080 关键页面截图 | R.25 跨浏览器验收 |
| REQ-6.3.2 | 接口兼容 (不修改原接口) | `complete` | Adapter 模式, 不改原接口 |  | — |
| REQ-6.3.3 | 数据库兼容 (PG 17+, 不破坏原结构) | `complete` | PG 17 + 独立 unified_* 命名空间, 不写原表 |  | — |
| REQ-6.4.1 | 日志 (运行/错误/审计分类) | `partial` | Next.js stdout + sync log 有, 错误分类 partial | 错误分类 + 业务层日志 | 后续 Sprint |
| REQ-6.4.2 | 监控 (CPU/内存/磁盘/接口) | `partial` | 系统进程与中心数据库健康 API 真实可读 | CPU/内存/磁盘完整监控；历史趋势与告警 | 接入真实主机指标源后补 CPU/内存/磁盘与趋势 |
| REQ-6.4.3 | 配置 (同步周期/告警阈值可页面配置) | `partial` | 真实读取 sync_sites 周期，并聚合每站点最近 scheduler/package/consistency；secret 仅返回环境变量键引用 | 告警阈值页面配置；配置写入 API；配置变更权限与审计 | 设计配置写入权限、审计与告警阈值真实来源后再开放写操作 |

## 3. Schema Source Priority

1. `docs/source/requirements.md`
2. `databases/disc_files.sql`
3. 完整站点库 `star_storage_db`（当前 170 表）
4. `source_restore`（同步测试源，不代表完整 schema）
5. `unified_disc_platform`（中心汇总结果）

R.18 实测关键行数: `tbl_file=4`、`tbl_folder=0`、`tbl_role=4`、`tbl_fuc=53`、`tbl_drivers=4`。零行或缺表只能证明链路边界，不能证明业务需求完成。

## 4. 控制专项

| 原子动作 | 当前事实 | R.18 后续 |
|---|---|---|
| pause | 官方 `status=20`，测试站点 DB 可写 | R.22 通过生产 Agent 闭环 |
| resume | 官方 `status=0`，需校验任务类型和前态 | R.22 通过生产 Agent 闭环 |
| reset | 当前 SQL 与官方语义不一致 | 保持 unsupported |
| priority restore | `priority` 字段不存在 | 保持 blocked_by_source_schema |
| inspect | 候选表缺必要字段且无站点行为 | 保持 blocked_by_source_schema |
| recovery | 候选表缺必要字段且无站点行为 | 保持 blocked_by_source_schema |

生产链路必须是 `control_command -> Agent poll -> ack -> local adapter -> result -> immediate sync -> UI final state`。

## 5. 维护规则

- 每个 Sprint 后更新 JSON 和本文件。
- 每个 Req ID 只能使用一个合法状态。
- 状态变化必须有 SQL/API/UI/e2e 证据。
- mock/simulator/DRY_RUN 不计入 complete。
- 完整字段、API、表、UI、blocker 和验证命令以 JSON 为准。
