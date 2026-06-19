# Roadmap to 15/45 Requirements

> 日期: 2026-06-19  
> 当前基线: Sprint R.37, `15/45 = 33.3%` ✅ **目标达成**  
> 最高标准: `docs/source/requirements.md`  

## 0. 结论

**目标已达成**: 从 4/45 (8.9%) 推进到 15/45 (33.3%)。

4 个 commit 完成全部 11 个 Sprint (R.27 ~ R.37):
- `8381e09` feat(r27-r28): login audit + account lifecycle [REQ-2.2.3, REQ-3.1.3]
- `c7e3232` feat(r29): auth middleware for 6 APIs [REQ-6.2.4]
- `ab88998` feat(r30-r34): site/consistency/cage/config/logs [REQ-2.1.1, REQ-2.3.3, REQ-4.3.2, REQ-6.4.3, REQ-6.4.1]
- `389a3fa` feat(r35-r37): compatibility/concurrency/monitoring [REQ-6.3.1, REQ-6.1.2, REQ-4.2.4]

## 1. 已完成 15/45

| 完成序号 | Req ID | 当前证据 |
|---:|---|---|
| 1 | REQ-1.1.1 集团层统一管控 | 平台定位和业务边界已固定 |
| 2 | REQ-5.1.3 日志检索 | `/api/logs` + `/logs` 支持关键字/错误码/设备ID/任务类型 |
| 3 | REQ-6.3.2 接口兼容 | Adapter/API 模式不改原站点接口 |
| 4 | REQ-6.3.3 数据库兼容 | PG17 + 独立 `unified_*` / `auth_*` 表, 不破坏源库 |
| 5 | REQ-2.2.3 登录审计 | `/api/auth/audit` + 导出 + 解锁 + 可配置阈值 |
| 6 | REQ-3.1.3 账号生命周期 | `/api/auth/accounts` CRUD + 重置密码 + 删除前校验 |
| 7 | REQ-6.2.4 防越权 | `lib/auth/middleware.ts` 覆盖 6 个 API |
| 8 | REQ-2.1.1 站点配置 | `/api/sites/[id]` PATCH/DELETE + 审计 |
| 9 | REQ-2.3.3 一致性校验 | `/api/sync/consistency/[id]/resolve` accept/fix |
| 10 | REQ-4.3.2 盘笼查询 | `/api/racks/cages` + 导出 + 权限过滤 |
| 11 | REQ-6.4.3 配置管理 | `/api/system/config` GET/PATCH + 审计 |
| 12 | REQ-6.4.1 日志分类 | 7 类日志 Tab + 任务类型过滤 |
| 13 | REQ-6.3.1 前端兼容 | 10 页面可访问 + viewport + 响应式 |
| 14 | REQ-6.1.2 并发 | 20 并发 6 API 无失败 |
| 15 | REQ-4.2.4 任务监控 | API <=10s + 告警 API + 轮询稳定性 |

## 2. 目标完成率里程碑

| 目标序号 | Sprint | Req ID | 要推到的状态 | 核心交付 |
|---:|---|---|---|---|
| 5/45 | R.27 | REQ-2.2.3 登录审计与异常管控 | `complete` | 登录审计检索/导出、管理员解锁、锁定阈值配置 |
| 6/45 | R.28 | REQ-3.1.3 账号生命周期 | `complete` | 创建/启用/禁用/删除/重置密码, 删除前任务校验, 审计 |
| 7/45 | R.29 | REQ-6.2.4 防越权 | `complete` | session + permission + site access 中间件覆盖关键业务 API |
| 8/45 | R.30 | REQ-2.1.1 站点配置 | `complete` | 站点注册/编辑/禁用/删除, 实时影响查询和同步配置 |
| 9/45 | R.31 | REQ-2.3.3 数据一致性校验 | `complete` | 每日调度、差异报告、人工修复/接受差异审计 |
| 10/45 | R.32 | REQ-4.3.2 盘笼统一查询 | `complete` | 在线/离线盘笼查询、权限过滤、导出和事件测试 |
| 11/45 | R.33 | REQ-6.4.3 配置管理 | `complete` | 同步周期/告警阈值页面配置, 写入权限和审计 |
| 12/45 | R.34 | REQ-6.4.1 日志分类 | `complete` | 运行/错误/审计分类统一, 页面检索和导出覆盖 |
| 13/45 | R.35 | REQ-6.3.1 前端兼容 | `complete` | Chrome/Firefox/Edge 1920x1080 验收记录 |
| 14/45 | R.36 | REQ-6.1.2 并发 >=20 用户 | `complete` | 20 并发白盒/HTTP 压测报告, 关键 API 无失败 |
| 15/45 | R.37 | REQ-4.2.4 任务监控 | `complete` | 任务状态 <=10s 刷新证据, 失败/超时告警和页面展示 |

说明:

- 这 11 个目标已全部完成 (R.27 ~ R.37)。
- 每个 Req ID 都有: 后端 API + requirements review + e2e 测试。
- 不把 ADFS/LDAP 直连、ES 千万级检索、ClickHouse 全量日志、六类真实控制动作强行塞入 15/45, 因为它们依赖外部系统或站点 schema。

## 3. 快速推进 Sprint 规格

### R.27 - 登录审计与异常管控完成

目标 Req:

- REQ-2.2.3

当前状态:

- R.26 已有 `auth_login_audit`、失败 >=5 次锁定、`/api/auth/login`、`/api/auth/logout`。

剩余交付:

- `/api/auth/audit` 支持账号、时间、状态、IP、站点过滤。
- `/api/auth/audit/export` 支持 CSV/JSON/XLSX。
- `/api/auth/accounts/[id]/unlock` 管理员解锁。
- 锁定阈值从配置表读取, 默认 5。
- `/logs` 或 `/users` 展示登录审计入口。

验收:

- `pnpm e2e:auth`
- `pnpm e2e:logs`
- DB 证据: `auth_login_audit` 有 success/failed/locked/logout。

不能算完成的情况:

- 只有登录 API, 没有审计检索/导出。
- 只有前端显示, 不能真正解锁。

### R.28 - 账号生命周期完成

目标 Req:

- REQ-3.1.3

交付:

- 从 `unified_users` 生成 `auth_accounts` 候选账号, 默认 `pending_activation` 或 `disabled`。
- 管理员创建中心账号。
- 启用/禁用账号。
- 重置中心密码。
- 删除账号前检查未完成任务。
- 所有操作写 `audit_log`。
- `/users` 增加真实按钮和状态, 不再只展示 `blocked_by_auth`。

验收:

- `pnpm e2e:users`
- `pnpm e2e:auth`
- 禁用账号登录返回 423/403。
- 有未完成任务的账号删除被拒绝。

不能算完成的情况:

- 只把 `unified_users` 显示出来。
- 直接拿站点密码当中心密码。
- 没有删除前任务校验。

### R.29 - 防越权完成

目标 Req:

- REQ-6.2.4

交付:

- `requireSession`
- `requirePermission`
- `requireSiteAccess`
- 覆盖 API:
  - `/api/tasks`
  - `/api/racks`
  - `/api/volumes`
  - `/api/logs`
  - `/api/users`
  - `/api/control/commands`
- `group_admin` 可看全部。
- `site_admin/operator/auditor/viewer` 只能看授权站点。
- 拒绝未登录请求。

验收:

- `pnpm e2e:auth`
- 新增 `pnpm e2e:rbac`
- 不同账号请求同一 API 返回不同站点范围。

不能算完成的情况:

- 只在前端隐藏按钮。
- API 不做服务端权限过滤。

### R.30 - 站点配置完成

目标 Req:

- REQ-2.1.1

交付:

- 建立中心 `site_registry` 或补强现有 `sync_sites`。
- 支持新增、编辑、禁用、删除站点。
- 站点状态变化影响:
  - `/api/sites`
  - `/api/sync/sites/status`
  - `/api/tasks`
  - `/api/racks`
  - `/api/volumes`
- 所有写操作 require `site:write` / `platform:operate` 权限。
- 写操作进入审计。

验收:

- `pnpm e2e:sites`
- `pnpm e2e:settings`
- 禁用站点后相关页面不显示假在线。

不能算完成的情况:

- 只派生站点列表, 不能管理。
- 站点删除后其他模块仍显示为可用。

### R.31 - 数据一致性校验完成

目标 Req:

- REQ-2.3.3

交付:

- 每日调度任务自动执行一致性校验。
- `sync_consistency_log` 保存历史差异报告。
- 支持按数据类型查看: 设备、任务、卷、盘笼。
- 支持人工修复或接受差异, 并写审计。
- `/sync` 展示最近报告和异常项。

验收:

- `pnpm check:sync-consistency -- --siteCode=SH01`
- `pnpm e2e:sync`
- DB 有调度执行记录和差异处理记录。

不能算完成的情况:

- 只有手工 CLI, 没有每日调度。
- 发现差异后没有处理路径。

### R.32 - 盘笼统一查询完成

目标 Req:

- REQ-4.3.2

交付:

- 在线/离线盘笼统一查询。
- 支持站点、状态、设备、关键词筛选。
- 结果按 RBAC 过滤。
- 支持 CSV/JSON/XLSX 导出。
- 导出写审计。

验收:

- `pnpm e2e:racks`
- `pnpm e2e:exports`
- `pnpm e2e:rbac`

不能算完成的情况:

- 只有设备列表, 没有盘笼/盘位查询。
- 导出不受权限控制。

### R.33 - 配置管理完成

目标 Req:

- REQ-6.4.3

交付:

- 页面可配置同步周期。
- 页面可配置告警阈值。
- 所有写入 require admin 权限。
- 不保存真实 secret, 只保存 env key ref。
- 写入审计。

验收:

- `pnpm e2e:settings`
- DB 证据: 配置值变化。
- 非 admin 写入返回 403。

不能算完成的情况:

- 只读展示配置。
- 把真实密码/secret 写入 DB。

### R.34 - 日志分类完成

目标 Req:

- REQ-6.4.1

交付:

- 统一日志分类: runtime / error / audit。
- API 层错误日志有 error_code。
- 控制、同步、导出、登录、配置写入统一归类。
- `/logs` 支持分类筛选和导出。

验收:

- `pnpm e2e:logs`
- `pnpm e2e:auth`
- `pnpm e2e:settings`

不能算完成的情况:

- 只有 console.log。
- 错误和审计混在一起不可检索。

### R.35 - 前端兼容完成

目标 Req:

- REQ-6.3.1

交付:

- Chrome 1920x1080 验收。
- Firefox 1920x1080 验收。
- Edge 1920x1080 验收。
- 核心页面截图或 Playwright 证据:
  - Dashboard
  - Tasks
  - Sync
  - Logs
  - Users
  - Settings

验收:

- `pnpm e2e:frontend-integration`
- 新增 `pnpm e2e:compat`

不能算完成的情况:

- 只在 Chromium 跑过。
- 没有 1920x1080 证据。

### R.36 - 20 并发完成

目标 Req:

- REQ-6.1.2

交付:

- 20 并发访问关键 API:
  - dashboard summary
  - tasks
  - racks
  - logs
  - auth me
- 记录 p95、错误率、总耗时。
- 生成报告。

验收:

- 新增 `pnpm perf:concurrency`
- 错误率 0。
- p95 不超过项目设定阈值。

不能算完成的情况:

- 只跑单用户。
- 没有报告或失败率。

### R.37 - 任务监控完成

目标 Req:

- REQ-4.2.4

交付:

- 任务状态刷新 <=10s 的 e2e 证据。
- 控制命令 pending/running/success/failed/timeout 可见。
- 失败/超时告警进入 `/api/alerts`。
- 页面展示任务监控和告警。

验收:

- `pnpm e2e:tasks`
- `pnpm e2e:sync`
- `pnpm e2e:site-agent-control`
- 任务状态变化延迟 <=10s。

不能算完成的情况:

- 只有手动刷新。
- 只看 control_command, 不展示最终状态或告警。

## 4. 领导汇报版本

可以直接这样说:

> 当前真实完成率是 4/45, 不是因为没有开发, 而是我们按 requirements 严格验收, 不把 mock、演示、部分链路算完成。现在同步、控制、日志、Auth 的核心底座已经打通: 站点恢复库数据能同步到总控, 控制命令能由 Agent 轮询执行 pause/resume, 日志能检索导出, 登录已从 mock 改成服务端 JWT、审计和锁定。下一阶段我们按 11 个可闭环 requirement 推进, 目标从 4/45 提升到 15/45, 重点是用户生命周期、RBAC 防越权、站点配置、一致性、盘笼查询、配置管理、兼容和并发验收。

## 5. 执行规则

- 一个 Sprint 只推动一个 Req ID 到 `complete`。
- 每个 Sprint 必须有:
  - DB/API/UI/e2e 证据
  - `docs/database-analysis/sprint-r.xx-requirements-review.md`
  - `requirements-traceability.json/md` 更新
  - `PROJECT_STATUS.md` 和 `ROADMAP.md` 更新
- 每次提交前必须:
  - `pnpm exec tsc --noEmit`
  - `pnpm build`
  - `pnpm smoke:sync`
  - `pnpm check:sync-consistency -- --siteCode=SH01`
  - `pnpm baseline:check`
  - `pnpm e2e:all`
- 任何失败不提交。

## 6. 不纳入 15/45 快速目标的事项

这些事项重要, 但不适合用来快速提升完成率:

| Req | 原因 |
|---|---|
| ADFS/LDAP 企业直连 | 缺真实 IdP 参数 |
| 站点 SSO 免登跳转 | 需要站点接受 SSO token |
| ES 千万级检索 | 需要外部 ES 集群 |
| ClickHouse 全量日志 | 需要外部日志系统 |
| 六类任务控制全部真实执行 | reset/priority/inspect/recovery 依赖站点 schema/API |
| 文件/目录全量同步 | `tbl_file/tbl_folder` 禁止进 PG17 全量 |

这些应作为领导决策项或外部系统接入项单独推进。
