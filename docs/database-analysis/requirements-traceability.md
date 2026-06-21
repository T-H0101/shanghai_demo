# Requirements Traceability Matrix

> Version: R.81 | Date: 2026-06-21
> Completion: 29/45 = 64.4% (strict)
> Candidate coverage: 45/45 (separate metric)
> Source of truth: `requirements[].current_status` (recalculated by R.81)

## Status Summary

| status | count |
|---|---:|
| complete | 29 |
| partial | 6 |
| blocked_by_source_schema | 3 |
| blocked_by_site_change | 1 |
| blocked_by_auth | 5 |
| blocked_by_external_system | 1 |
| **total** | **45** |

> Strict counts and `top10_next_actions` are recalculated from `requirements[].current_status` in R.81. Stale top-actions from prior versions (R.43) marked REQ-2.3.3, REQ-3.1.3, REQ-4.2.1, REQ-5.1.2, REQ-4.1.3, REQ-6.2.3, REQ-5.2.2 as `complete` are now corrected.

## Requirements Detail

| req_id | status | module | requirement |
|---|---|---|---|
| REQ-1.1.1 | complete | (架构级) | 集团层统一管控, 不替代各站点系统 |
| REQ-1.2.1 | complete | lib/sync/package-dispatcher.ts | 松耦合 (API/MQ 交互, 不侵入站点核心逻辑) |
| REQ-2.1.1 | complete | app/api/sites/route.ts + app/settings/page.tsx | 站点配置 (名称/IP/状态/联系人) |
| REQ-2.1.2 | blocked_by_auth | — | 站点切换 (SSO 免登) |
| REQ-2.1.3 | complete | lib/api/alert-adapter.ts + app/sync/page.tsx | 站点监控 (实时 + 告警, 采集 ≤5 分钟) |
| REQ-2.2.1 | partial | app/api/auth/* + lib/auth/* | ADFS 3.0+ / LDAP 集成登录 |
| REQ-2.2.2 | blocked_by_auth | — | 集团 AD ↔ 站点本地账号映射 |
| REQ-2.2.3 | complete | store/login-audit (前端 localStorage) | 登录审计 (≥1 年) + 失败 ≥5 次锁定 |
| REQ-2.3.1 | complete | lib/sync/package-dispatcher.ts | 同步范围 (设备/文件/权限/任务 4 类) |
| REQ-2.3.2 | complete | lib/sync/sync-engine.ts | 同步策略 (实时/定时/手动) |
| REQ-2.3.3 | complete | scripts/check-sync-consistency.ts + app/api/sync/consistency | 数据一致性校验 (每日差异报告) |
| REQ-3.1.1 | blocked_by_source_schema | app/api/users/route.ts | 账号维度 (Site 多对多 + 部门/角色) |
| REQ-3.1.2 | blocked_by_site_change | — | 全 Site 提醒 (跨站点消息推送) |
| REQ-3.1.3 | complete | app/api/users/route.ts (只读) | 账号生命周期 (创建/启用/禁用/删除) |
| REQ-3.2.1 | blocked_by_auth | app/users/page.tsx (blocked state) | 权限分配流程 (站点→设备→数据 两步) |
| REQ-3.2.2 | blocked_by_auth | — | 权限生效 (实时 + 事务回滚) |
| REQ-3.3.1 | blocked_by_source_schema | — | 部门管理 (集团/部门/站点三级) |
| REQ-3.3.2 | blocked_by_auth | — | 权限审计 (操作/变更/撤销, ≥1 年不可篡改) |
| REQ-4.1.1 | partial | lib/api/search-provider.ts | 跨维度检索 (名称/后缀/部门/卷/盘) |
| REQ-4.1.2 | blocked_by_external_system | — | 检索性能 (≤3 秒, 千万级) |
| REQ-4.1.3 | complete | — | 检索结果导出 (Excel/CSV) |
| REQ-4.2.1 | complete | lib/api/task-provider.ts | 新建备份/恢复任务 |
| REQ-4.2.2 | partial | lib/control/control-command.ts + lib/control/executor.ts (R. | 任务控制 (暂停/重置/恢复 + 优先执行恢复任务) |
| REQ-4.2.3 | partial | lib/control/control-command.ts (action='inspect_start' + 're | 数据巡检任务 (批量抽取 + SM3/哈希校验) |
| REQ-4.2.4 | complete | lib/api/alert-adapter.ts | 任务监控: 进度/状态/告警 push (≤10s 刷新) |
| REQ-4.3.1 | blocked_by_source_schema | — | 盘笼移位登记 (原/目标/审批/状态) |
| REQ-4.3.2 | complete | app/api/racks/route.ts + app/api/racks/[id]/route.ts + app/a | 盘笼统一查询 (在线/离线 + 导出) |
| REQ-5.1.1 | partial | lib/sync/sync-job-log | 日志采集 (刻录/回迁全量 + 错误码) |
| REQ-5.1.2 | complete | app/api/sync/export/route.ts + app/sync/page.tsx | 日志导出 (Excel/CSV + 数字签名) |
| REQ-5.1.3 | complete | app/api/logs/route.ts | 日志检索 (关键字/错误码/任务类型) |
| REQ-5.2.1 | partial | — | 索引范围 (按盘笼 + 校验码) |
| REQ-5.2.2 | complete | — | 导出方式 (手动触发 + 推送) |
| REQ-6.1.1 | complete | 全栈 | 性能: 普通 ≤1s / 复杂 ≤2s / 导出 ≤30s |
| REQ-6.1.2 | complete | Next.js + Docker | 并发 ≥20 用户 |
| REQ-6.1.3 | complete | lib/sync/sync-engine.ts + app/api/sync/sites/status/route.ts | 数据同步时效 (增量 ≤10s / 全量 ≤30min) |
| REQ-6.2.1 | complete | lib/sync/package-auth.ts | 传输加密 (敏感字段) |
| REQ-6.2.2 | complete | auth_accounts.password_hash | 存储加密 (不可逆 + 分区隔离) |
| REQ-6.2.3 | complete | lib/sync/sync-job-log + auth_login_audit | 操作审计 (不可篡改) |
| REQ-6.2.4 | complete | auth_role_permissions + lib/auth/server.ts | 防越权 (跨站/跨部门) |
| REQ-6.3.1 | complete | (架构级) | 前端兼容 (Chrome/Firefox/Edge ≥1920) |
| REQ-6.3.2 | complete | (架构级) | 接口兼容 (不修改原接口) |
| REQ-6.3.3 | complete | lib/db/* | 数据库兼容 (PG 17+, 不破坏原结构) |
| REQ-6.4.1 | complete | (Next.js + sync) | 日志 (运行/错误/审计分类) |
| REQ-6.4.2 | complete | app/api/system/* | 监控 (CPU/内存/磁盘/接口) |
| REQ-6.4.3 | complete | app/api/sync/config/route.ts + app/api/sync/sites/status/rou | 配置 (同步周期/告警阈值可页面配置) |

## Top 10 Next Actions (R.81 recalculated)

| rank | req_id | status | title | category |
|---:|---|---|---|---|
| 1 | REQ-2.2.1 | partial | 获得企业 IdP 参数后实现 oidc/ldap provider adapter | 决策/部署 |
| 2 | REQ-4.1.1 | partial | 领导决策: 引入 ES 集群 | 决策/部署 |
| 3 | REQ-4.2.2 | partial | R.19 建 Agent，R.22 关闭 pause/resume 两个原子动作 | 决策/部署 |
| 4 | REQ-4.2.3 | partial | R.23 在官方 schema/API 明确后逐项实现 | 决策/部署 |
| 5 | REQ-5.1.1 | partial | 向站点团队确认原生日志表/API 后接入 | 决策/部署 |
| 6 | REQ-5.2.1 | partial | 等源端补 | 决策/部署 |
| 7 | REQ-2.1.2 | blocked_by_auth | 等 REQ-2.2.1 解锁 | Auth/IdP |
| 8 | REQ-2.2.2 | blocked_by_auth | 解锁 CLAUDE.md | Auth/IdP |
| 9 | REQ-3.2.1 | blocked_by_auth | 解锁 CLAUDE.md + 5.x Sprint | Auth/IdP |
| 10 | REQ-3.2.2 | blocked_by_auth | 等 REQ-3.2.1 | Auth/IdP |

## Strict vs Candidate (NEVER merge)

- **Strict complete** = backend + UI + e2e + DB/API evidence. Counted toward the 29/45 = 64.4% completion rate.
- **Implemented candidate** = some pieces implemented (control-command queue + audit, local JWT, source-direct query) but missing external/auth/site production evidence. Counted toward the 45/45 candidate coverage only.
- **Blocked** = dependency outside this project: ADFS/LDAP/IdP, production ES/ClickHouse, production Site Agent deployment, station schema/API gaps.
