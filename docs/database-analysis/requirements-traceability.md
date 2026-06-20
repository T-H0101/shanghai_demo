# Requirements Traceability Matrix

> 版本: R.38
> 日期: 2026-06-19
> 唯一标准: `docs/source/requirements.md`
> 机器可读完整 18 字段: `docs/database-analysis/requirements-traceability.json`

## 0. R.38 矩阵回填

R.38 将 R.27 ~ R.37 已通过的 requirements review 和本轮黑盒稳定性修复回填到权威矩阵。旧 R.26 Markdown/JSON 仍显示 4/45, 已被本版本替代。

| 状态 | 数量 |
|---|---:|
| `complete` | 15 |
| `partial` | 16 |
| `not_started` | 3 |
| `blocked_by_source_schema` | 4 |
| `blocked_by_site_change` | 1 |
| `blocked_by_auth` | 5 |
| `blocked_by_external_system` | 1 |
| `out_of_scope` | 0 |

**requirements 完成率: 15/45 = 33.3%**

本次新增 complete 的 Req ID:

- REQ-2.2.3
- REQ-3.1.3
- REQ-6.2.4
- REQ-2.1.1
- REQ-2.3.3
- REQ-4.3.2
- REQ-6.4.3
- REQ-6.4.1
- REQ-6.3.1
- REQ-6.1.2
- REQ-4.2.4

边界声明:

- 不把 ADFS/LDAP 直连算入 complete。
- 不把 ES / ClickHouse / 千万级检索算入 complete。
- 不把生产部署、未支持控制原子动作、mock、simulator、DRY_RUN 算入 complete。
- R.27 ~ R.37 每项均已有 sprint requirements review 和 e2e/verification 证据。

## 1. R.18 实施决策

- 允许 Site Agent 主动轮询总控命令并在站点本地调用数据库/API。
- 总控不直接连接或修改生产站点数据库。
- 首期使用可替换的 Postgres adapter, 后续可切换 HTTP/MQ/native adapter。
- 该决策解除设计阻塞, 但没有 Agent 部署和端到端证据时不得标 `complete`。
- `tbl_file/tbl_folder` 禁止进入 package 全量同步, PG17 仅保留有界任务级索引/聚合, 完整检索走 ES。

## 2. 当前需求矩阵

| Req ID | 需求 | 状态 | 后端现实 | 主要缺失 | 下一步 |
|---|---|---|---|---|---|
| REQ-1.1.1 | 集团层统一管控, 不替代各站点系统 | `complete` | 平台只做统一视图/管控, 写接口都标记为审计/模拟 |  | — |
| REQ-1.2.1 | 松耦合 (API/MQ 交互, 不侵入站点核心逻辑) | `partial` | R.19C 独立 Agent 已从完整测试站点 DB 读取 13 张小表，通过 HMAC package API 主动推送，并在断线时本地 spool、恢复后补传。控制 poll/ack/result 和生产部署尚未完成。 | 生产站点实际部署并长期运行; 生产控制路径移除中心库直连; HTTP control poll/ack/result | R.19D control client |
| REQ-2.1.1 | 站点配置 (名称/IP/状态/联系人) | `complete` | R.30: 站点列表真实读取/派生；PATCH/DELETE 支持站点编辑、启用/禁用、删除并写 audit_log；配置仅保存 env key refs，不存 secret。 |  | — |
| REQ-2.1.2 | 站点切换 (SSO 免登) | `blocked_by_auth` | 0 | 依赖 REQ-2.2.1 (ADFS) + 站点 URL 配置 | 等 REQ-2.2.1 解锁 |
| REQ-2.1.3 | 站点监控 (实时 + 告警, 采集 ≤5 分钟) | `partial` | R.19A 可接收签名 heartbeat；R.19B 独立 Agent 支持 5 分钟默认周期和站点 DB 探活。R.21 通过 /api/alerts 聚合 sync_package_log / sync_table_log 的失败告警。尚未在生产站点长期部署，无硬件指标告警。 | 生产站点长期部署; 光盘库/离线库硬件指标; 离线和硬件异常自动告警 | 生产部署 Agent 后补离线/硬件告警源 |
| REQ-2.2.1 | ADFS 3.0+ / LDAP 集成登录 | `partial` | R.26 已实现中心平台 local 登录、HttpOnly JWT cookie、/api/auth/me、/api/auth/logout、RBAC 权限目录和服务端密码哈希；未直连企业 ADFS/LDAP。 | 企业 ADFS/LDAP issuer/token/JWKS/LDAP 参数; 集团账号与企业 IdP 属性映射; 站点 SSO federation | 获得企业 IdP 参数后实现 oidc/ldap provider adapter |
| REQ-2.2.2 | 集团 AD ↔ 站点本地账号映射 | `blocked_by_auth` | 0 | CLAUDE.md 禁 + 源端无 AD 通道 | 解锁 CLAUDE.md (Sprint 5.x) — R.4 不再标 out_of_scope (违反 R.1 §1) |
| REQ-2.2.3 | 登录审计 (≥1 年) + 失败 ≥5 次锁定 | `complete` | R.27/R.38: auth_login_audit 真实记录 success/failed/locked/logout；/api/auth/audit 支持 username/result/siteCode 部分匹配/IP/date；CSV/JSON 导出含 SHA-256；管理员解锁真实 UPDATE auth_accounts 并写 audit_log；锁定阈值来自 auth_system_config。 |  | — |
| REQ-2.3.1 | 同步范围 (设备/文件/权限/任务 4 类) | `partial` | R.19C Agent 已真实同步任务、设备、盘笼、盘位、光盘、卷和 tbl_user 基础数据；权限仍只有用户基础表，文件仍只有有界任务级索引，完整文件索引未接外部数据面。 | 完整文件索引同步; 角色/权限/部门关系同步; 生产站点 Agent 部署 | R.20 必要小表扩展 + 外部索引决策 |
| REQ-2.3.2 | 同步策略 (实时/定时/手动) | `partial` | R.19C Agent 支持默认 5 秒任务增量轮询、60 秒小表快照检测、--once 手动同步、可配置有界重试、离线 spool 和恢复补传；R.21 将失败 package/table 聚合为真实同步告警；R.22 /api/sync/trigger 返回 501 blocked_by_site_change，不伪造网页手动同步。 | 设备关键状态实时延迟实测; 最终失败后的通知通道和责任人推送; 页面真实触发 Agent 手动全量/增量; 生产站点长期部署 | R.23 manual-sync command 通道 + 同步延迟计时 |
| REQ-2.3.3 | 数据一致性校验 (每日差异报告) | `complete` | R.31/R.38: check-sync-consistency 对 SH01 7 张已接入源表真实比对并写 sync_consistency_log；resolve API 支持 accept/fix 并审计；本轮 SH01 7/7 matched。 |  | — |
| REQ-3.1.1 | 账号维度 (Site 多对多 + 部门/角色) | `blocked_by_source_schema` | unified_users 当前 4 行；可读 source_site_id 和源端 role 编码，但无 Site 多对多、部门与标准化角色关系 | tbl_user 源端无 Site 多对多关系、部门关系和标准化角色映射 | 等源端补字段 |
| REQ-3.1.2 | 全 Site 提醒 (跨站点消息推送) | `blocked_by_site_change` | 0 | 源端无 push 通道 | 等站点 push 通道 |
| REQ-3.1.3 | 账号生命周期 (创建/启用/禁用/删除) | `complete` | R.28: auth_accounts 支持列表、创建、启用/禁用、删除、重置密码；删除前校验未完成任务；所有变更写 audit_log。 |  | — |
| REQ-3.2.1 | 权限分配流程 (站点→设备→数据 两步) | `blocked_by_auth` | — | CLAUDE.md 禁 + 源端无 role 字段 | 解锁 CLAUDE.md + 5.x Sprint |
| REQ-3.2.2 | 权限生效 (实时 + 事务回滚) | `blocked_by_auth` | — | 依赖 REQ-3.2.1 | 等 REQ-3.2.1 |
| REQ-3.3.1 | 部门管理 (集团/部门/站点三级) | `blocked_by_source_schema` | 源 tbl_depa 0 行 | 源 tbl_depa 0 行 + CLAUDE.md 禁 | 等源端补数据 |
| REQ-3.3.2 | 权限审计 (操作/变更/撤销, ≥1 年不可篡改) | `blocked_by_auth` | — | 依赖 RBAC 体系 | 等 REQ-3.2.1 |
| REQ-4.1.1 | 跨维度检索 (名称/后缀/部门/卷/盘) | `not_started` | /api/search 路由 R.4 显式返回 source=not_implemented + blocker=blocked_by_external_system, 不再 404 | 跨站 ES 集群 + 千万级索引 | 领导决策: 引入 ES 集群 (估时 8d ES + 8d 项目) |
| REQ-4.1.2 | 检索性能 (≤3 秒, 千万级) | `blocked_by_external_system` | 当前 4 行任务级, 千万级未测 | ES 集群 + 千万级索引 | 领导决策: 接 ES (估时 8d ES + 8d 项目) |
| REQ-4.1.3 | 检索结果导出 (Excel/CSV) | `not_started` | 页面无导出按钮 | 导出 API + UI 按钮 | 后续 Sprint, 1 API + 1 按钮 |
| REQ-4.2.1 | 新建备份/恢复任务 | `partial` | 任务列表和运行字段真实；总控尚无通过 Site Agent 被站点接受的新建备份/恢复任务闭环。 | 任务创建命令协议; 站点 Agent 创建适配器; 站点接受结果和同步回读 | R.23 通过控制协议实现任务创建 |
| REQ-4.2.2 | 任务控制 (暂停/重置/恢复 + 优先执行恢复任务) | `partial` | 控制队列、poll/ack/result API、测试执行器和审计存在。pause status=20、resume status=0 有官方依据并可写测试站点库；生产 Site Agent 尚未部署。reset 语义未确认，priority 缺字段。 | 生产 Site Agent HTTP 闭环; pause/resume 生产站点验证; reset 官方语义; priority schema/API | R.19 建 Agent，R.22 关闭 pause/resume 两个原子动作 |
| REQ-4.2.3 | 数据巡检任务 (批量抽取 + SM3/哈希校验) | `partial` | inspect/recovery 命令类型和 unsupported 路径存在；站点候选表为空且缺必要字段，没有真实执行。 | 巡检 schema/API; 恢复任务 schema/API; Agent 执行适配器; SM3/结果回传 | R.23 在官方 schema/API 明确后逐项实现 |
| REQ-4.2.4 | 任务监控: 进度/状态/告警 push (≤10s 刷新) | `complete` | R.37/R.38: /api/tasks 响应 <1s；/api/alerts 可访问；control_command 面板 5 秒刷新；任务类型、状态、告警源真实。 |  | — |
| REQ-4.3.1 | 盘笼移位登记 (原/目标/审批/状态) | `blocked_by_source_schema` | 源 tbl_magzines 无 from_site/to_site/approver/status 字段 | 源端补字段 + 站点推移位事件 | 等源端补 |
| REQ-4.3.2 | 盘笼统一查询 (在线/离线 + 导出) | `complete` | R.32: 盘笼/设备统一查询走中心库真实 unified_devices/unified_slots；支持 siteCode 过滤、详情 slots、CSV/JSON 导出和权限过滤。 |  | — |
| REQ-5.1.1 | 日志采集 (刻录/回迁全量 + 错误码) | `partial` | 已采集同步、调度、一致性、控制和审计日志；未采集站点刻录/回迁任务全量日志及文件列表。 | 刻录任务全量日志; 回迁任务全量日志; 错误码/文件列表完整字段; 异步不丢失采集 | R.20 接必要摘要；完整高频日志待 ClickHouse |
| REQ-5.1.2 | 日志导出 (Excel/CSV + 数字签名) | `partial` | R.24 /api/logs/export 已真实支持 CSV/JSON/XLSX，XLSX 为真实 OOXML 文件；manifest 含 signature 元数据边界，未配置密钥时显式 blocked_by_config | 证书或私钥数字签名; 大数据分片/异步导出; 两年留存策略; 刻录/回迁全量业务日志字段 | 设计签名密钥托管、异步分片与留存策略后继续 |
| REQ-5.1.3 | 日志检索 (关键字/错误码/任务类型) | `complete` | GET /api/logs 整合 6 类中心库日志, 支持 keyword/errorCode/deviceId/taskType/siteCode/status/date 分页过滤; dataSource 显式 database/empty/error |  | — |
| REQ-5.2.1 | 索引范围 (按盘笼 + 校验码) | `blocked_by_source_schema` | 源 tbl_file 0 行 | 源 tbl_file 真实数据 + 校验码 | 等源端补 |
| REQ-5.2.2 | 导出方式 (手动触发 + 推送) | `not_started` | 无导出 API | 异步导出 + 推送 | 后续 Sprint |
| REQ-6.1.1 | 性能: 普通 ≤1s / 复杂 ≤2s / 导出 ≤30s | `partial` | 现有小数据 API/e2e 可运行；尚无 10 万条导出、复杂检索和统一性能报告。 | 普通/复杂查询基准; 10 万条导出 <=30 秒; 控制响应 <=1 秒验证 | R.25 性能验收 |
| REQ-6.1.2 | 并发 ≥20 用户 | `complete` | R.36: 对 Tasks/Racks/Volumes/Logs/Users/Health 6 个关键 API 执行 20 并发，成功率 100%，平均 <1000ms，最大 <3000ms。 |  | — |
| REQ-6.1.3 | 数据同步时效 (增量 ≤10s / 全量 ≤30min) | `partial` | R.19C Agent 默认每 5 秒执行任务增量读取、每 60 秒检测小表快照，真实 package 路径已通过白盒 e2e；R.23 增加任务增量 Agent→中心落库耗时断言，本次样本 <100ms <=10s。尚无生产持续样本和百万级全量报告。 | 生产持续时延样本; 百万级索引全量测试; 生产站点长期运行证据 | R.25 生产持续时延和百万级全量性能验收 |
| REQ-6.2.1 | 传输加密 (敏感字段) | `partial` | sync package 使用 HMAC 做完整性和身份校验，但 HMAC 不是敏感字段加密；site-control 仍是简化 secret 比对。 | TLS 部署证据; 敏感字段额外加密; site-control 请求级 HMAC; 凭据轮换 | R.19 不落 secret，R.25 请求级 HMAC 和传输验收 |
| REQ-6.2.2 | 存储加密 (不可逆 + 分区隔离) | `partial` | R.26 平台 auth_accounts 仅保存 scrypt 不可逆密码哈希；未实现 PG TDE、分区隔离或字段级加密。 | PG TDE 或字段级加密; 分区隔离策略 | 设计存储加密和分区隔离策略 |
| REQ-6.2.3 | 操作审计 (不可篡改) | `partial` | 同步层日志、控制/导出 audit_log 与 R.26 登录审计均已落库；尚未覆盖所有业务写操作和不可篡改存证。 | 全部业务写操作统一审计; 不可篡改存证; 登录审计 UI | 补业务写操作审计覆盖率和防篡改方案 |
| REQ-6.2.4 | 防越权 (跨站/跨部门) | `complete` | R.29: 服务端 JWT session + permission + site access 中间件覆盖 tasks/racks/volumes/logs/users/control-commands 6 个关键 API；未登录 401，登录后按权限访问。 |  | — |
| REQ-6.3.1 | 前端兼容 (Chrome/Firefox/Edge ≥1920) | `complete` | R.35: 10 个关键页面 HTTP 200，viewport/lang/响应式断点白盒检查通过。 |  | — |
| REQ-6.3.2 | 接口兼容 (不修改原接口) | `complete` | Adapter 模式, 不改原接口 |  | — |
| REQ-6.3.3 | 数据库兼容 (PG 17+, 不破坏原结构) | `complete` | PG 17 + 独立 unified_* 命名空间, 不写原表 |  | — |
| REQ-6.4.1 | 日志 (运行/错误/审计分类) | `complete` | R.34: /api/logs 聚合 sync_package/sync_table/sync_scheduler/sync_consistency/control/audit/login_audit 多类日志，支持 keyword/errorCode/deviceId/taskType/siteCode/status/date。 |  | — |
| REQ-6.4.2 | 监控 (CPU/内存/磁盘/接口) | `partial` | 系统进程、中心数据库健康 API、站点 Agent databaseReachable heartbeat、控制队列和同步失败告警聚合真实可读 | CPU/内存/磁盘完整监控; 历史趋势与告警 | 接入真实主机指标源后补 CPU/内存/磁盘与趋势 |
| REQ-6.4.3 | 配置 (同步周期/告警阈值可页面配置) | `complete` | R.33: /api/system/config 支持 GET/PATCH，配置持久化在 auth_system_config，变更写 audit_log；同步配置只返回安全 env key refs。 |  | — |

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
| resume | 仅从 20 恢复 Agent 持久化的暂停前状态；禁止猜测 0 | 恢复库闭环完成，待生产部署 |
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
