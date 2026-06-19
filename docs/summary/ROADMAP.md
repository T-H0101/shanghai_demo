# Roadmap

> **统一路线图 (取代分散在多个 sprint 文档中的路线图)**
> 截至: 2026-06-18

## R.24 日志 XLSX 导出与签名边界 (2026-06-19)

- [x] `/api/logs/export` 真实支持 XLSX。
- [x] `x-manifest` 增加 `signature` 元数据边界。
- [x] `e2e:exports` 改为 logs xlsx=200，其余端点继续显式 501。
- [x] `e2e:logs` 增加 xlsx/signature 校验。
- [x] 修复 `pnpm-workspace.yaml` 的 `sharp` build approval 占位值。
- [ ] 真实证书/私钥数字签名。
- [ ] 大文件分片/异步导出。
- [ ] 默认 ≥2 年留存策略。
- [ ] 刻录/回迁全量业务日志接入中心库。

## R.25 悬浮助手去 mock (2026-06-19)

- [x] `GlobalControlBall` 移除 mock notifications。
- [x] 接真实 health/db-health/alerts/control-commands/site-status。
- [x] 去掉假 CPU/内存百分比和“正常运行/已同步/已保护”硬编码。
- [x] 新增 blocker 页展示 `blocked_by_auth` / `blocked_by_external_system` / `blocked_by_site_change`。
- [x] 新增 `e2e:floating-assistant` 并纳入 `e2e:all`。
- [ ] 主机 CPU/内存/磁盘真实 runtime source。
- [ ] 历史趋势和阈值告警。

## R.23 同步时效白盒证据 (2026-06-18)

- [x] `e2e:site-agent-sync` 增加任务增量同步 `<=10s` 断言。
- [x] 当前白盒样本: Agent→中心落库 `<100ms`。
- [x] 文档明确该证据不替代生产持续样本或百万级全量验收。
- [ ] 生产站点持续增量时延采样。
- [ ] 百万级文件索引全量同步 <=30min 验收。
- [ ] R.25 性能报告。

## R.22 手动同步触发 fail-closed (2026-06-18)

- [x] 新增 `/api/sync/trigger` 501 `blocked_by_site_change` 边界。
- [x] `/sync` 明示网页手动同步触发尚未开放。
- [x] `e2e:sync` 验证 API fail-closed 和页面阻塞态。
- [ ] Site Agent manual-sync command 通道。
- [ ] 网页触发全量/增量同步并写入审计。
- [ ] 同步延迟计时验收。

## R.21 同步告警摘要闭环 (2026-06-18)

- [x] `/sync` 新增真实同步告警摘要。
- [x] 复用现有 `/api/alerts`，聚合 `sync_package_log` / `sync_table_log` 失败记录。
- [x] `e2e:sync` 增加告警 API 和页面接线断言。
- [x] 文档明确不宣称 ClickHouse/ES、硬件告警、通知通道或生产部署完成。
- [ ] 页面手动触发 Agent 全量/增量同步。
- [ ] 设备状态增量同步 ≤10s 和关键接口性能计时验收。
- [ ] 失败告警通知通道、责任人推送和告警阈值配置。

## R.20 Command Center + 日志检索完成 (2026-06-18)

- [x] 首页 Command Center 首屏改造，展示站点、同步、控制队列、告警和 KPI。
- [x] Command Center 只消费现有真实 API，不新增页面/API/表。
- [x] `e2e:all` 增加 `.env.local` 预加载、健康检查和自动 dev server。
- [x] `/logs` 支持关键字、错误码、设备ID、任务类型、站点、状态和时间范围检索。
- [x] `REQ-5.1.3` 提升为 `complete`。
- [x] requirements 完成率提升为 `4/45 = 8.9%`。
- [ ] Firefox/Edge 和 1920×1080 实机验收留待 R.25。

## R.18 基线重构和 Site Agent 协议冻结 (2026-06-12 完成)

- [x] 允许 Site Agent 主动轮询总控并在本地调用数据库/API。
- [x] 生产环境禁止总控直连站点数据库。
- [x] 固化 Site Agent sync/control/heartbeat/HMAC v1 协议。
- [x] 建立 requirement-table integration matrix。
- [x] 建立 pause/resume/reset/priority/inspect/recovery capability matrix。
- [x] 修正 traceability 非法状态和统计冲突。
- [x] requirements 完成率校准为 `3/45 = 6.7%`。
- [x] 编写 `/sites`、`/sync`、`/tasks`、`/control` 网页验收指南。

## R.19 可部署 Site Agent (开发闭环完成，待生产部署)

- [x] 独立 Agent 入口和环境变量引用配置模型。
- [x] heartbeat API、请求级 HMAC、防重放和运行状态表。
- [x] `/sync` 展示真实 Agent 在线/过期/未注册状态。
- [x] systemd 模板、空值环境模板和运维验收说明。
- [x] 真实小表 package push、重试、spool 和幂等。
- [x] HTTP control poll/ack/result，请求级 HMAC、nonce 和租约。
- [x] PostgreSQL action adapter，首期 pause/resume。
- [x] 完整 Agent 白盒 e2e：heartbeat、同步、19→20→19 控制、audit 和回读。
- [ ] 生产站点安装、TLS、长期运行和故障演练。
- [ ] reset/priority/inspect/recovery 官方语义与 adapter。

## R.19E 前端信息架构整合 (2026-06-15)

- [x] 任务列表和控制命令合并到 `/tasks` 双视图。
- [x] `/control` 保留 307 兼容跳转。
- [x] 侧栏移除重复控制入口。
- [x] 顶部伪搜索替换为真实 `/search` 导航并标记外部系统阻塞。
- [x] 新增白盒事件测试并纳入 `e2e:all`。
- [ ] Firefox/Edge 和 1920×1080 实机验收留待 R.25。

详细路线: `docs/summary/ROADMAP_R18_R25.md`

## R.16-Review 控制执行真相审计 (2026-06-12 完成)

> **核心**: 仅审查 R.16, 不新增功能。复核 "任务控制真执行" / "status=20 paused" / "同步回读" 三件事证据, 显式标 blocked_by_site_change, 避免过度宣称。

### 审计发现
- ✅ **status=20 官方证据闭环**: `docs/source/tbl_task_status.docx` L118-119 明确写 "20=任务暂停" (type=0/2/3), L150-151 (type=1); executor.ts L131 `PAUSED_STATUS = 20` 与官方一致
- ✅ **2/6 commandType 与官方枚举完全对齐**: task_pause=20, task_resume=0
- ⚠️ **1/6 是历史 workaround**: task_reset 写 `status=1, burn_status=0` — disc_files.sql L291-292 官方语义不匹配 (status=1=数据准备中, burn_status=0=已完成数据库表合并), R.4 沿用原 SQL; **R.16-Review 显式标注, 不修改**
- ❌ **3/6 是 unsupported**: task_priority_restore/inspect_start/recovery_start 源端缺字段 (R.4 已知)
- ❌ **L7 站点 app 消费 evidence = 0**: 维持 blocked_by_site_change, 不解除

### 真控制 7 层 evidence (R.16-Review 新公式)
| 层 | 完成度 | 证据 |
|---|---|---|
| L1 控制队列框架 | 100% | control_command 表 + 5 函数 |
| L2 总控写入 + 列表 | 100% | POST 201 + GET 列表 |
| L3 executor 6 dispatch | 100% | 6 exec 函数全支持 |
| L4 真写测试站点库 (DRY_RUN=false) | 50% | 3 真写 + 3 unsupported |
| L5 audit_log 落 | 100% | 19 行 task_pause, before/after 完整 |
| L6 状态机 + 同步回读 | 100% | execute 端点 + import:tasks |
| L7 站点应用消费 | 0% | **0 evidence, blocked_by_site_change** |
| **总完成度** | **50.0%** (6/7 层) | L7 阻塞 |

### 风险文案修正
- R.16 文档 `sprint-r.16-task-progress-control-closure.md` L29-32 增补 task_reset workaround 标注
- 前端 toast 全部合规, 无需改 (L292/L324/L334 显式"待确认" / "等待站点拉取")
- 0 处 "暂停成功" / "控制成功" / "真控制完成" 误宣

### 新增 e2e
- `scripts/e2e/test-r16-postreview-truth-audit.ts` (8 步 26 项, **26/26 pass**)
- 重点: 严格区分 4 类 status (success/dry_run_success/unsupported/failed) + UI 静态扫描 9 禁用词 + 边界声明 3 项硬约束

### 验证
- e2e:r16-postreview **26/26**
- e2e:r16-control-loop 17/17 (R.16 原 e2e 维持)
- e2e:tasks 11/11, e2e:control 19/19
- tsc/build/smoke/consistency/baseline/e2e:worker 全过

### 完成率
- **不变**: 6/45 = 13.3% (R.16-Review 不触发 blocked→complete)
- R.16-Review 是**审计强化**非**功能新增**, 完成度公式保持 R.16 后的口径

### 文档
- `docs/database-analysis/sprint-r.16-postreview-control-truth-audit.md` (新增, R.16-Review 主报告)
- `docs/database-analysis/sprint-r.16-task-progress-control-closure.md` (1 处校准: task_reset workaround 标注)

### 后续 Sprint 候选 (R.17+)
- 🚨 L7 站点 app 消费 evidence (领导决策 + 站点 app 团队投入)
- ⚠️ L4 3 DDL patch (priority/source_id/verify_result, 站点运维评估)
- ℹ️ unified_tasks 加 `last_control_at` (R.16 已知缺口)
- ℹ️ disc_files.sql 注释补 status=20
- ℹ️ task_reset SQL 重构 (与站点应用方确认"重置"官方语义)

---

## R.13 统一导出框架 (2026-06-12 完成)

> **核心**: lib/export 单一框架收敛 3 套不一致 CSV/header 实现, 新增 users 导出, audit_log 落库, secret 双层 sanitize, XLSX 显式 partial: blocked_by_dependency_policy。

### 改造
- `lib/export/` 9 文件 ~430 行 (index/csv/json/xlsx/sha256/manifest/sanitize/audit/next-response)
- 重构 3 端点: racks/export (104→90), sync/export (178→130), logs/export (267→220)
- 新增 `/api/users/export` (~130 行, unified_users 白名单 13 列)
- 4 页面接 format 下拉 (logs/sync/racks/users), toast "导出完成 + SHA-256 摘要已生成"
- 头部兼容: 同时输出 x-sha256/x-record-count (新) + x-content-sha256/x-export-record-count (旧)

### 验证
- e2e:exports **173/173** (R.13 新增, 7 端点 × CSV+JSON+XLSX 矩阵 + 审计 + selector + 措辞)
- e2e:all 全过 (11 脚本含 exports)
- 10 项基线全绿
- audit_log 实测 +1 (before=22 → after=23)
- secret/password/database_url 0 命中 (14 项检查)

### 需求状态
- REQ-5.1.2 (日志导出): partial 强化, XLSX 显式 blocked_by_dependency_policy
- REQ-4.3.2 (盘笼导出): partial 强化, 3 格式
- REQ-4.1.2 (检索导出): partial, /api/users/export 落地
- 完成率 6/45 = **13.3%** (R.13 不升 complete)

### 下一 Sprint (R.14 候选)
- 引 exceljs 真实 XLSX (需领导批准依赖)
- /api/logs/export 大文件分片 / 异步导出
- audit_log "谁导了什么" 反查 UI

---

## R.12 /logs 真实日志检索与导出 (2026-06-11 完成)

> **核心**: /logs 页面从 mockAuditLogs 切换到 /api/logs 整合 6 类日志, 含 CSV/JSON 真实下载与 SHA-256 摘要。

### 改造
- `app/logs/page.tsx` 移除 mockAuditLogs / useLoginAuditStore / 假证书, 改 `fetch /api/logs` + `fetch /api/logs/export`
- 6 Tab 真实: sync_package / sync_table / sync_scheduler / sync_consistency / control / audit
- 4 筛选: siteCode / status / keyword / dateFrom-dateTo (debounce 500ms)
- 数字签名按钮显式 "未接入", 不伪造证书 (R.1 §7)
- 登录流水 amber banner 显式 blocked_by_auth

### 新增 API
- `GET /api/logs` (~340 行): 整合 6 表, 6 筛选, 显式 dataSource
- `GET /api/logs/export` (~280 行): CSV/JSON, 真实数据库, x-sha256 头

### 验证
- e2e:logs **37/37** (R.12 新增, 含 SHA-256 摘要校验)
- e2e:all 全过 (10 脚本, 含 logs)
- 7 项基线全绿 (tsc/build/smoke/consistency/baseline/e2e:logs/e2e:all)
- REQ-5.1.2 / REQ-5.1.3 partial 强化, 完成率仍 13.3%

### 下一 Sprint (R.13 候选)
- Excel (xlsx) 导出
- 数字签名密钥托管方案
- 登录审计 (依赖 ADFS)
- /api/logs 性能优化 (分页/索引)

---

## R.11D Settings 多站点真实集成

- [x] Settings 读取 `/api/sites`
- [x] Settings 读取 `/api/sync/sites/status`
- [x] 分开展示 derived/registered provenance 与中心调度配置
- [x] 展示同步周期、最近调度和一致性状态
- [x] 刷新事件浏览器验收
- [ ] 源端 `tbl_site` 真实注册资料
- [ ] 配置写入权限、审计与真实告警阈值

---

## R.11C 每站点最新状态

- [x] `sync_sites` 关联最近 scheduler/package/consistency
- [x] 无日志站点返回 `not_run`
- [x] `/sync` 展示每站点最新状态
- [x] API 不返回连接值或 secret
- [ ] 每日自动执行保证
- [ ] 差异历史、人工修复和按类型配置

---

## R.11B 同步日志真实导出

- [x] package/table/scheduler/consistency 四类真实日志
- [x] CSV/JSON 与 siteCode 过滤
- [x] 记录数和 SHA-256 完整性摘要
- [x] `/sync` 类型选择与真实下载事件
- [ ] Excel 与证书/私钥数字签名
- [ ] 大数据分片/异步导出与两年留存策略
- [ ] `/logs` 页面移除 mock

---

## R.11A 设备真实 CSV 导出

- [x] `GET /api/racks/export` 读取 `unified_devices`
- [x] 支持 siteCode/status 过滤
- [x] 返回记录数与 SHA-256 内容摘要
- [x] `/racks` 导出按钮接真实 API
- [x] e2e 验证附件正文、记录数和摘要
- [ ] Auth/RBAC 可用后补权限过滤与审计

---

## R.10D Racks API fail-closed

- [x] API 失败和空集不回退 mock
- [x] 页面显示 database/empty/error
- [x] `e2e:racks` 纳入 `e2e:all`
- [x] 修正 REQ-4.3.2 过度完成声明
- [x] 实现真实设备导出与事件 e2e (R.11A)

---

## R.10C Users 真实只读化

- [x] `/api/users` 移除 mock fallback
- [x] `/users` 改读 `unified_users`
- [x] 移除假创建、封禁、删除、密码重置和权限同步
- [x] Auth/RBAC 缺口显式 blocked
- [x] `e2e:users` 纳入 `e2e:all`
- [ ] 等真实 Auth、Site 多对多和权限模型后实现写能力

---

## R.10B Settings 真实只读化

- [x] 移除 Settings mock 配置和假成功事件
- [x] 展示真实同步策略、env key 引用、应用与数据库健康
- [x] 写配置、告警发送与认证能力显式 blocked/not_implemented
- [x] `e2e:settings` 纳入 `e2e:all`
- [ ] 配置写入权限与审计
- [ ] CPU/内存/磁盘真实指标源

---

## R.10A 调度参数与多站点安全配置

- [x] scheduler 支持 `--siteCode=SH01`
- [x] `GET /api/sync/config` 去敏读取 `sync_sites`
- [x] `/sync` 只读展示多站点同步配置
- [x] Settings 展示真实运行配置和健康状态 (R.10B)
- [ ] 配置写入、权限和审计

---

## R.9A /sites 页面真实化 (2026-06-11 完成)

> **核心**: /sites 页面从 mockSites 切换到 /api/sites, 写操作按钮 disabled, 真实一致性校验。

### 改造
- `app/sites/page.tsx` 移除 mockSites / mockSiteProvider, 改 `fetch /api/sites`
- 4 个 StatCard 改为 `useMemo` 派生
- 4 个按钮: 注册/启用禁用/SSO → disabled + toast 提示; 一致性 → 真实 R.7 API

### dataSource 显示
- database / derived / empty / error 四态显式 Badge
- 派生态: 顶部标识 + 列表标题说明 + 详情面板 amber 框

### 验证
- e2e:sites 9/9 → **22/22** (新增 13 项 R.9A 检查)
- e2e:all 78/78 → **91/91** (其他 5 脚本不受影响)
- 7 项基线全绿 (tsc/build/smoke/consistency/baseline/e2e:sites/e2e:all)

### 需求状态
- REQ-2.1.1 仍为 `partial` (实现层修复, 源端 blocker 不变)

### 下一 Sprint (R.9B 候选)
- `unified_site_registry` 表落库
- 站点 CRUD + 启用/禁用联动
- ADFS / SSO 接入 (需领导决策)

---

## R.8A-1 Post-Review + 多站点架构确认 (2026-06-11 完成)

> **核心**: e2e 78/78 修复 + 多站点架构结论文档化 + /sites 真实状态检查

### e2e 修复
- control 18/19 → 19/19 (limit=20→200 + DB 连接修正)
- **78/78 全过**

### 多站点架构
- SH01 单站点测试库 (170 表)
- 每站点独立原数据库
- site_registry 设计 (暂不落库)

### /sites 问题
- API: derived (正确)
- **页面: 仍用 mockSites** 🔴
- 下一 Sprint: /sites 真实化

---

## R.8 自动同步与一致性校验调度器 (2026-06-11 完成)

> **对应**: REQ-2.3.3 + REQ-6.1.3

### 新增
- `scripts/scheduler/sync-scheduler.ts` (export→push→consistency→log)
- `sync_scheduler_log` 表 + `GET /api/sync/scheduler/logs` API
- `/sync` 页面 scheduler-card
- `scripts/e2e/test-scheduler.ts` (14/14)
- package scripts: `scheduler:sync` / `scheduler:sync:once` / `e2e:scheduler`

### 下一 Sprint (R.9)
- 站点 app 配合 (poll control_command)
- ADFS 接入 (需领导决策)

---

## R.7C 基线冻结 (2026-06-10 完成)

> **核心**: baseline:check 13 项自动检查，后续 Sprint 必须通过。

### baseline:check 13 项
一致性 7/7 / 污染清零 / executor 无假执行 / /api 状态 / traceability / disc_files.sql / 表数

### CLAUDE.md
§8 新增 `pnpm baseline:check` (任一失败不允许 commit)

---

## R.7B 清理中心库污染 + Schema 基线 (2026-06-10 完成)

> **核心**: 清理 13 行测试污染，7/7 matched；disc_files.sql 纳入基线。

### 清理
- unified_tasks 7 行 / unified_devices 4 行 / unified_volumes 2 行
- 清理后一致性 7/7 matched

### Schema 基线
- disc_files.sql 147 张表解析
- CLAUDE.md 附录 C: 5 级优先级 + 4 项禁止

---

## R.3 Executor 假执行修复 (2026-06-10 完成)

> **核心**: 修正 R.3 审计误判，executor 从假执行改为真连接站点库。

### 修复
- `.env.local` 加 `SITE_DATABASE_URL=postgresql://starxdb:starxdb@localhost:5434/star_storage_db`
- executor 改为 `status=20` (paused) / `status=0` (恢复) / `status=1` (重置)
- `selectTaskSnapshot` 连站点库读 before/after 快照

### 验证
- tbl_task.id=9: 0→20 (暂停)→0 (恢复) ✅ 真改
- DRY_RUN=true: dry_run_success (不改表) ✅
- DRY_RUN=false: success (真改) ✅

### 任务控制真实完成度修正
- 暂停/恢复/重置: ⚠️ **降级为"DB 字段写入可行，真实执行未证实"** (无站点程序消费 evidence)
- 巡检/恢复任务: ⚠️ 仍需站点 app 配合
- 优先恢复: ⚠️ 仍需 priority 字段

---

## R.7A 一致性差异修复 + 控制真执行 Post-Review (2026-06-10 完成)

> **核心**: 不新增功能，只修/查真实性问题。

### 一致性差异
- 3 个 mismatched 表全部是**历史测试数据污染**，非 bug，标记 `accepted_difference`

### 控制真执行 Post-Review
- "真控制可行" → **降级为"DB 字段写入可行，真实执行未证实"**
- 无站点程序消费 status=20 的 evidence
- executor 改的是测试库 star_storage_db (5434)，不是生产库

---

## R.7 数据一致性校验 Job (2026-06-10 完成)

> **核心**: REQ-2.3.3 实施, 7 表 source vs unified count_diff 校验, fail-closed。

### 新增
- `scripts/check-sync-consistency.ts` (7 表校验 + log 写入)
- `GET /api/sync/consistency?siteCode=...`
- DB: `sync_consistency_log` (11 字段)
- `/sync` 一致性卡片
- `package.json` check:sync-consistency

### 真实结果 (SH01)
- 4 匹配 / 3 异常 (mismatched 真实暴露)
- tbl_task +7 / tbl_disc_lib +4 / tbl_logical_volume +2

### 7 项验证
tsc 0 / build 24/24 / smoke / e2e:worker / e2e:sync 17/17 / e2e:all 78/78 / check ✅

### 下一 Sprint (R.8+)
- cron 自动每日校验
- missing/extra 跨 DB 真实差异

---

## R.6 前端事件 e2e 实施 (2026-06-10 完成)

> **核心**: 6 个占位脚本 → 真实可运行 e2e, 70/70 通过。

### 6 脚本 (70/70)

- test-dashboard 9/9 / test-tasks 11/11 / test-sync 9/9
- test-control 19/19 / test-sites 9/9 / test-search 13/13

### 5 项验证

- tsc 0 错 / build 23/23 / smoke passed / e2e:worker passed / e2e:all 70/70

### 修复 3 类

- TS2451 (export {}) / HTTP 201 接受 / 同步包 failed 直查

### 下一 Sprint (R.7+)

- Playwright 浏览器截图
- 6 脚本扩展 (新页面/新按钮)
- CI 集成 e2e:all

---

## R.5 前端事件测试强约束 (2026-06-10 完成)

> **核心**: CLAUDE.md §10 强约束, 0 业务功能, 仅规则 + 占位。

### 落地

- CLAUDE.md §10 (一票否决, 10 项禁止, 9 项验收模板 A-I)
- `docs/database-analysis/frontend-event-test-standard.md` (6 类事件 + 9 项验收)
- `scripts/e2e/README.md` + 6 个占位脚本
- `package.json` 加 7 个 `e2e:*` scripts

### 下一 Sprint (R.5+) 强制

任何前端/事件 Sprint 必须:

1. 复制 R.5 §7 验收模板到 `sprint-<X.Y>-requirements-review.md`
2. 完成 9 项 (A-I) 才能 commit
3. 不允许 10 项禁止任何一项

### 缺口清单 (R.5+ 候选)

- 6 个占位脚本实际实施 (~7 人天)
- Playwright 浏览器截图 (R.6, 3 天)
- CI 集成 e2e 自动化 (R.6+)

---

## R.4 Bug 修复周 (2026-06-10 完成)

> **核心**: 修 Sprint R.3 发现的 6 个真实 bug, 0 业务功能, 严格符合 R.1 模板。

### 6 个🔴 bug 修复

| # | Bug | 修复 | 估时 |
|---|---|---|---|
| 1 | /api/tasks/[id] 100% 404 | 接 unified_tasks 真实查, UUID 校验, siteCode 过滤 | 0.5h |
| 2 | /api/search 404 | 显式 not_implemented + blocker banner | 0.5h |
| 3 | /api/sites 100% mock | 真实读 + 派生 fallback | 1h |
| 4 | executor L342 假执行 | schema 检测 + dry_run_success/unsupported | 1h |
| 5 | priority commandType 缺失 | 加 task_priority_restore (5→6 原子) | 1h |
| 6 | R.2 out_of_scope 违规 | REQ-2.2.2/3.2.1 改 blocked_by_auth | 0.5h |

**合计**: 4.5 小时, 0 阻塞。

### R.4 文档更新

- requirements-traceability.md (R.4 stats 修正)
- requirements-traceability.json (R.4 stats + r4_bug_fixes)
- PROJECT_STATUS.md / ROADMAP.md (本段)
- sprint-r.4-requirements-review.md (R.4 严格审查)

### 下一 Sprint (R.5)

- 0 阻塞新功能: REQ-2.3.3 / 4.1.3 / 5.1.2 / 5.1.3 / 5.2.2 / 6.4.3 (~10 人天)
- 决策点: 站点表能否加 paused/priority 字段 (REQ-4.2.2 真控制前提)

---

## R.2 Requirements Traceability Matrix (2026-06-09 完成)

> **核心**: 建立 43 原子需求 × 18 字段追踪矩阵, 作为后续所有开发的唯一验收依据。

### 关键产出

- ✅ `docs/database-analysis/requirements-traceability.md` (人类可读)
- ✅ `docs/database-analysis/requirements-traceability.json` (机器可读, 自动化校验)
- ✅ 任务控制 6 原子专项 (暂停/恢复/重置/巡检/恢复/优先)
- ✅ 4 项站点 schema DDL patch
- ✅ Top 10 按 requirements.md 优先级 (非 UI 排序)
- ✅ `docs/database-analysis/sprint-r.2-requirements-review.md`

### 完成度统计

| 指标 | 数值 |
|---|---|
| 总需求数 | 43 |
| requirements 完成率 | **22.0%** (9/41) |
| 已着手 (complete+partial) | 48.8% (20/41) |
| 依赖外部 (站点/源端/Auth) | 39.6% |
| 永久阻塞 (out_of_scope) | 4.7% |

### Top 3 阻塞 (待领导)

1. **REQ-2.2.1 (ADFS)** — 解锁带动 6 项 (~25 人天)
2. **站点 schema patch** — 任务控制 6 原子真正落地
3. **站点 app poll** — 任务控制 6 原子真执行

### 后续所有 Sprint 必须

- 引用 `requirements-traceability.md` 相关 REQ-ID
- 产出 `sprint-<X.Y>-requirements-review.md` (R.1 模板)
- 更新 `requirements-traceability.{md,json}` 反映新状态
- 禁止跳过 traceability 直接宣称"需求完成 X%"

---

## R.1 requirements.md 上升为最高验收标准 (2026-06-09 完成)

> **核心**: 从"按数据库倒推需求"切换到"严格按需求验收"。

### 9 大强约束 (CLAUDE.md 落地)

1. **requirements.md 最高优先级** — 每次开发前后必须确认 / 审查
2. **需求状态枚举** — 8 选 1 (complete / partial / not_started / blocked_by_source_schema / blocked_by_site_change / blocked_by_auth / blocked_by_external_system / out_of_scope)
3. **严格验收** — 每次 Sprint 完成必须产出 10 字段审查文件
4. **任务控制硬约束** — 暂停/恢复/重置/巡检/恢复 6 原子动作, 缺字段提 schema patch, 不允许伪造
5. **同步策略** — 完整 170 表库为审计基线
6. **控制策略** — 总控必须保留控制能力路线
7. **禁止误导** — 措辞规范
8. **提交前检查** — tsc + build + smoke + (worker e2e) 必须全绿
9. **文档同步** — PROJECT_STATUS + ROADMAP + requirements review 三件套

### 新增文件

- ✅ `docs/database-analysis/requirements-strict-review-template.md` — 13 段严格审查模板

### 任务控制需求标记状态 (R.1 启动后)

| 需求 (REQ ID) | 状态 | Blocker | 真实完成路径 |
|---|---|---|---|
| REQ-4.2.1 新建任务 | `complete` | — | — |
| REQ-4.2.1 暂停 | `partial` | blocked_by_source_schema | 站点表加 `paused` 字段 |
| REQ-4.2.1 恢复 | `partial` | blocked_by_source_schema | 同上 |
| REQ-4.2.1 重置 | `partial` | blocked_by_site_change | 站点 app 改 `tbl_task.status` |
| REQ-4.2.2 优先执行恢复 | `partial` | blocked_by_source_schema | 站点表加 `priority` 字段 |
| REQ-4.2.3 数据巡检 | `partial` | blocked_by_site_change | 站点 app poll `tbl_check_patrol_task` |
| REQ-4.2.3 恢复任务 | `partial` | blocked_by_site_change | 站点 app poll `tbl_hot_restore_record` |
| REQ-4.2.4 任务监控 | `partial` | — | 已有 UI |

### R.1 后续所有 Sprint 强制要求

- 必须产出 `docs/database-analysis/sprint-<X.Y>-requirements-review.md`
- 必须用本模板 13 段全部填写
- 不允许使用"业务完成度"代替"requirements 完成度"
- 不允许把 mock / simulator / DRY_RUN 算入 complete

---

## 4.5 control_command 控制队列 MVP (刚完成)

Sprint 4.5: 总控具备可落地的命令下发骨架, 不假实现。

- 1 张表 (`control_command`, 16 字段 + 4 索引 + 1 触发器)
- 1 service (`lib/control/control-command.ts`, 5 函数)
- 5 个 API (3 总控 + 2 站点轮询)
- Tasks 页面 3 按钮接通 (暂停/恢复/重置, **不改 unified_tasks**)
- `/control` 控制命令列表页 + sidebar 入口
- 端到端 8 步全过 + tsc + build + smoke 干净
- 详情见 `docs/database-analysis/sprint-4.5-control-command-mvp.md`

## 4.6 (下一步)

**目标**: TaskControlProvider 抽象 + 9 thin API + 站点侧完整 HMAC

- 2d TaskControlProvider 抽象 (Sprint 4.1 已设计)
- 0.5d 站点侧完整 HMAC 升级 (nonce + 时间窗)
- 0.5d `/control` 批量操作 (按 status 批量取消)
- 3d WebSocket 推送 (可选, ROI 3)
- 依赖: Sprint 4.5 已完成

## 4.7

**目标**: SSO 跳转入口占位 (Sprint 4.2-C 方案 1 落地)

- 1d `lib/site/site-urls.ts` + `components/site-jump-button.tsx`
- 集成: Tasks/Racks/Volumes 详情页加"在站点管理" 跳转
- 依赖: 站点 URL 配置 (`SITE_URL_*` 环境变量)
- 风险: URL 未配置时按钮 disabled

## 4.8

**目标**: 巡检/恢复/优先控制方案 (Sprint 4.2-C 方案 2 完整版)

- 2d 巡检命令接入 (control_command.action='inspect_start')
- 2d 恢复命令接入 (action='recovery_start')
- 1d 真实站点拉取脚本示例
- 4d 总估时, 站点侧同步开发

### 4.8.2 站点控制真相审计 (2026-06-09 完成 + 重审)

**初版 (基于 source_restore 13 张表)**:
- **结论**: 站点库**没有原生控制机制** (0 control/command 表, 0 函数/触发器/视图)
- **状态**: Site Worker = framework + audit + simulator, **不是执行器**
- **5 个 commandType 全部降级为"审计总控意图"**, 真控制需站点侧 schema 变更
- **等待领导**: 站点表能否加新字段? 站点应用是否读新行? 是否提供真 API 文档?
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md`

**重审版 (基于 star_storage_db 170 张表) — Sprint 4.8.2-R**:
- **数据库**: 完整 PG 物理备份恢复 (`/Users/tian/Desktop/20260601`), 170 张表 (vs source_restore 13 张)
- **新发现**: 3 张表 cron + 7 张表 progress + 79 张表 status — **调度/进度/状态机基础设施完整**
- **仍然没有**: `paused` / `priority` / `pause` / `resume` / `reset` 字段 (全库 0 命中)
- **结论修正**: D 完全没有 → **A + B + C 部分支持** (有基础设施, 但缺 paused 字段, 无应用代码 evidence)
- **Site Worker 角色升级**: simulator → **调度编排 + 审计监控**
- **5 dispatch 重映射候选** (Sprint 4.9+ 实施, 需领导确认):
  - inspect_start → `tbl_check_patrol_task` / `tbl_data_receive_list`
  - recovery_start → `tbl_hot_restore_record`
  - task_pause/resume/reset → 维持 audit (无 paused 字段)
- **前端按钮恢复** (Sprint 4.8.2-R 落地, 2026-06-09):
  - Tasks 表格 + 详情抽屉新增 **暂停 / 恢复 / 重置** 3 按钮
  - 走 `POST /api/control/commands` (audit/simulator, 不改 `unified_tasks`)
  - Toast 文案明确"已提交到控制队列, 等待站点拉取执行"
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (重写版)

**Overnight Verification (2026-06-09)**:
- **DB**: `star_storage_db` 170 张表确认, 全库扫描 0 paused/priority 命中
- **Site Worker DRY_RUN**: 5/5 命令 (task_pause/resume/reset/inspect_start/recovery_start) 拉取执行, audit_log 5 行 (1:1)
- **UI 按钮**: 暂停/恢复/重置 3 按钮接通 control_command POST (3/3 ok), toast 合规, API mode only
- **smoke + siteCode**: smoke:sync passed, Tasks/Racks/Volumes/Sync 4 端点 siteCode 过滤一致
- **统计**: control_command 37 total (29 success / 7 failed / 1 inflight), audit_log 35 total (11 in last hour)
- **报告**: `docs/audit/sprint-4.8.2-r/REPORT.md` (含 CSV/JSON/Markdown)

### 4.8.3 (下一步) 等待领导决策后再开

- A. 站点表加 control_command 镜像字段 → Site Worker 升级为真控制
- B. 提供站点 API 文档 → 直接走 API
- C. 维持 simulator (当前) → 仅总控侧审计 + 事后追溯

## 5.x (需上级解锁 CLAUDE.md)

5.1 ADFS 集成登录 (5d) → 5.2 JWT 令牌 (4d) → 5.3 账号生命周期 (3d) → 5.4 RBAC (5d) → 5.5 审计 (3d) → 5.6 登录审计 (4d) → 5.7 部门管理 (5d) → 5.8 SSO 跳转真接入 (3d)

**总计 32 人天**, 解锁 REQ-003/006/007/009/017/019/023/040 共 8 项需求。

Sprint 3.0 审计结论: **业务完成度 85%**, 13/146 源端理论表 = 8.9% 真实存在率, 不再大规模接表。

- 13/13 源端实际表全部接入 (11 A + 2 C, 0 D)
- 4/4 同步数据类型覆盖 (设备/文件/权限/任务)
- 11 类需求源端 schema 缺失或 CLAUDE.md 禁止项, **不可实现**
- 详情见 `docs/database-analysis/sprint-3.0-business-value-audit.md`

## 3.1 (下一步)

**目标**: Racks slot 真实明细 drawer (ROI 5)

396 行 unified_slots 真实数据已有, Racks 页面缺 slot 明细。改 1 个 drawer, 调 /api/racks/[id]/slots。

## 3.2

**目标**: Tasks 详情页 _aggregate 来源 badge (ROI 4)

33/44 任务 runtime 真实 + 27/44 user_task_count 真实, 加 badge 标"来自 lib_task 聚合"。

## 3.3

**目标**: Dashboard unified_volumes 总数 tile (ROI 4)

5 个真实 volume, 但 Dashboard 没显示。

## 3.4

**目标**: 同步日志页 dispatcher A/B/C/D 分类 (ROI 3)

sync_table_log 已有 status, 加分类徽章让用户知道哪些表真实可用。

## 3.5

**目标**: unified_tasks.user_task_count 透传 + UI (ROI 3)

TaskDTO.aggregate 字段, drawer 展示 user_task_count。

## 3.6

**目标**: 系统操作 / 运维文档 (ROI 3)

写 4 篇: 启动 / 接入新站点 / 接新表 / 故障排查。



## 已完成

- ✅ **2C.18A-2C.20**: file-index reader/mapper/upsert/importer
- ✅ **2C.18D**: file-index 端到端验证 (独立测试库)
- ✅ **2D.1**: 全表同步分类矩阵
- ✅ **2D.2**: `/api/sync/package` + dispatch registry (2 表: tbl_task + tbl_disc_lib)
- ✅ **2D.3**: 10 张小表 package 化 + Summary 收口
- ✅ **2D.4**: Sync Center + package log API
- ✅ **2E.1**: 任务域字段缺口审查
- ✅ **2E.2**: 用户/站点/平台域接入 (tbl_user + tbl_site + tbl_platform)
- ✅ **2E.3**: 站点域真实性审查 (tbl_site/tbl_platform 是监控域, 不继续)
- ✅ **2F.1**: 任务域 P0 字段补全 (8 字段: task_mode/error_message/runtime_seconds/package_count/success_count/error_count/progress/current_phase)
- ✅ **2F.2A**: tbl_task_items 接入策略审查 (结论: source_restore 中不存在, 不接入, 文档化待源表)
- ✅ **2F.3**: 任务详情页收口 (数据源徽章 / 字段空态 / runtime 格式化 / 计数 0 保留 / API vs mock 差异)
- ✅ **2F.4**: siteCode 全局筛选 (Header 站点选择器 + Tasks/Racks/Sync 联动 + localStorage + URL 同步 + file-index 防跨站)
- ✅ **2G.1**: `/api/sync/package` HMAC 鉴权 (rawBody 优先签名 + 5min 时间窗 + timingSafeEqual + strict/dev 双模式)
- ✅ **2G.2**: Dashboard 真实总览 (`/api/dashboard/summary` + `/api/dashboard/recent-syncs` + SummaryBar + RecentSyncs 组件, 7/7 SQL 对账匹配, 跟随全局 siteCode)
- ✅ **2G.3**: 任务域盘点 (13 张 tbl_* 中仅 3 张任务表, 7 张"假定存在"表全不存在, runtime 推算 P0 唯一可补)
- ✅ **2H.1**: 站点 Package Exporter 模拟器 (`export:package` + `push:package` + `export-and-push` 端到端, 7 张表 HMAC 签名推送)
- ✅ **2H.1R**: Dispatcher 覆盖率审计 (5 A / 5 C / 3 D, D 类为 sourceIdField 错配)
- ✅ **2H.2**: Dispatcher 真实落库修复 (3 D → 0 D, 8 A 类, 真实可用率 38.5% → 61.5%, inlineUpsert 统计口径修正)
- ✅ **2H.3**: 3 张占位表聚合器 (tbl_lib_task / tbl_volume_slot / tbl_user_task 从 C → A, 真实可用率 61.5% → 84.6%, runtime_seconds 真实数据从 0 → 33 个 task)
- ✅ **2H.4**: /volumes 页面 + VolumeDTO.aggregate 透传 + 侧边栏入口 (2H.3 数据落地最后一公里, 5 个真实 volume / 3 个含 _aggregate, API 透传, 页面展示)
- ✅ **2H.5**: Tasks 列表 runtime 列 (来自 2H.3 真实数据, 33/44 任务有真实 runtime 75% 覆盖, formatRuntime 展示)
- ✅ **2H.6**: inlineUpsert inserted/updated 区分 (RETURNING xmax = 0 技巧, 13 张表全部支持真实区分, 端到端 5+5 验证通过)

## 2H.7 (下一步)

**目标**: Racks 页面 slot 真实明细 + 任务详情页 runtime 展示

| 任务 | 说明 |
|---|---|
| Racks 页面 slot 真实明细 (来自 unified_slots) | 396 行真实数据, 缺一个 slot 列表 drawer |
| 任务详情页接 runtime 真实数据 | Tasks 列表 33/44 任务有真实 runtime, 需要 UI 展示 |
| `tbl_hd_info` 5 个缺失列 (disk_id/capacity/used_capacity/total_capacity/slot_index) | 需要从其它表 join 或扩展 source schema |
| inlineUpsert inserted/updated 区分 | 加 `RETURNING (xmax = 0)` 让 PG 返回 inserted/updated 区分 |

## 2D.4 (下一步)

**目标**: 站点同步调度 + 同步日志 UI

| 任务 | 说明 |
|---|---|
| 站点侧推送脚本示例 | bash 包装站点导入 → 推 /api/sync/package |
| 同步日志页面增强 | 在 /logs 页面集成 sync_package_log 列表 |
| package 鉴权骨架 | API key 中间件 (HMAC) |
| package 严格 checksum | SHA-256 |

## 2D.5

**目标**: 用户/站点/平台 P0 小表接入

| 任务 | 说明 |
|---|---|
| tbl_user → unified_users | 用户主表 |
| tbl_site → unified_sites | 站点主表 |
| tbl_platform → unified_platforms | 平台主表 |
| 角色/部门/权限三件套 | P1 权限系统基础 |
| 全部 5 张走 package 化 | dispatch registry 扩展 |

## 2D.6

**目标**: ES 接入 + ClickHouse 日志骨架

| 任务 | 说明 |
|---|---|
| ES 客户端骨架 | lib/elasticsearch/* |
| tbl_file → ES (保持 file-index 作为 PG17 索引) | ES 仅用于全文检索 |
| tbl_sys_log → ClickHouse | 日志分析 |
| tbl_api_log → ClickHouse | API 日志分析 |
| ES 检索 API | /api/search/files?keyword= |

## P2: 大表索引/分析

- dynamic 7 模板表 → ES
- tbl_data_receive_* / tbl_evidence_* / tbl_receipt_* 索引化
- tbl_check_* / tbl_patrol_* 全文检索

## P3: 增强功能

- 审计 (谁/什么时候/改了什么)
- 报表 (周报/月报/年度)
- 运维告警 (容量/温度/失败)
- 多站点策略 (隔离/聚合/对比)
- SSO
