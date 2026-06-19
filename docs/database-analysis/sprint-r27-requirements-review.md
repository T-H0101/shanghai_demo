# Sprint R.27 Requirements Review

> REQ-2.2.3: 登录审计与异常管控
> 日期: 2026-06-19
> 审查人: Claude

## A. Requirement 对照

**原始需求 (requirements.md §2.2)**:
> 登录审计与异常管控:
> 1. 记录所有登录行为（账号、登录时间、IP、登录站点、登录状态），审计日志保留≥1年；
> 2. 连续失败登录≥5次触发账号锁定（可配置阈值），支持管理员解锁。
> 技术约束: 锁定策略支持按账号/IP维度配置，审计日志支持按条件检索/导出。

## B. 前端变更清单

| # | 变更 | 类型 | 真实后端 |
|---|---|---|---|
| 1 | `/logs` 新增 "登录审计" Tab | 修改 | ✅ fetch /api/auth/audit |
| 2 | `/users` 新增 "Auth 账号管理" Tab | 修改 | ✅ fetch /api/auth/accounts |
| 3 | `/users` 解锁按钮 | 新增 | ✅ POST /api/auth/accounts/[id]/unlock |
| 4 | `/logs` 更新 blocked 横幅文案 | 修改 | ✅ 登录审计已接入 |
| 5 | `/logs` statusBadgeColor 新增 locked/logout | 修改 | ✅ |

## C. API 变更清单

| # | Endpoint | Method | 说明 |
|---|---|---|---|
| 1 | `/api/auth/audit` | GET | 登录审计检索, 支持 username/result/siteCode/ip/from/to 过滤 |
| 2 | `/api/auth/audit/export` | GET | 登录审计导出 CSV/JSON, 含 SHA-256 |
| 3 | `/api/auth/accounts` | GET/POST | Auth 账号列表/创建 |
| 4 | `/api/auth/accounts/[id]` | GET/PATCH/DELETE | Auth 账号详情/更新/删除 |
| 5 | `/api/auth/accounts/[id]/unlock` | POST | 管理员解锁 |
| 6 | `/api/auth/accounts/[id]/reset-password` | POST | 重置密码 |

## D. 数据库变更清单

| # | 变更 | 说明 |
|---|---|---|
| 1 | `auth_system_config` 表 | key-value 配置表, 存储锁定阈值 |
| 2 | `auth_login_audit` 表 | 已有 (R.26), R.27 新增检索/导出 API |
| 3 | `lib/auth/server.ts` | SCHEMA_SQL 新增 auth_system_config DDL + seed |
| 4 | `lib/auth/server.ts` | LOCK_THRESHOLD/LOCK_MINUTES 改为 let, 从 DB 读取 |
| 5 | `lib/control/audit.ts` | AuditEntry 接口 commandNo/siteCode/dryRun 改为可选 |

## E. 事件测试清单 (10 项验证)

| # | 交互 | 验证 |
|---|---|---|
| 1 | 用户在哪里点击 | `/logs` 页面 "登录审计" Tab |
| 2 | 点击前页面状态 | 默认显示 sync_package 日志 |
| 3 | 点击后请求了哪个 API | GET /api/auth/audit?limit=200 |
| 4 | API 返回什么 | HTTP 200 + items[] + total |
| 5 | 数据库是否变化 | auth_login_audit 有 success/failed 记录 |
| 6 | 页面是否刷新 | Tab 切换自动重新加载 |
| 7 | toast 是否准确 | 无 toast (静默加载) |
| 8 | 是否存在 mock/fallback | 无 mock, dataSource=database |
| 9 | 是否误导用户 | 不展示 "blocked_by_auth" 阻断横幅 |
| 10 | 是否符合 requirements.md | ✅ 支持按条件检索 |

## F. 浏览器验证结果

- Logs 页面 Tab 栏新增 "登录审计" ✅
- Users 页面 Tab 栏新增 "Auth 账号管理" ✅
- 解锁按钮在锁定账号行显示 ✅
- 导出 CSV/JSON 正常下载 ✅

## G. Mock/Simulator/DRY_RUN 标记

| 项目 | 标记 | 说明 |
|---|---|---|
| 登录审计检索 | **真实** | 直接查 auth_login_audit 表 |
| 登录审计导出 | **真实** | 真实 SQL 查询 + SHA-256 |
| 管理员解锁 | **真实** | UPDATE auth_accounts + audit_log |
| 锁定阈值配置 | **真实** | auth_system_config 表读取 |
| 登录锁定 | **真实** | failed_attempts >= LOCK_THRESHOLD |

## H. 未完成项

| 项目 | 状态 | 说明 |
|---|---|---|
| IP 维度锁定 | blocked_by_auth | 当前仅按账号维度锁定, IP 维度需 Redis/内存存储 |
| 审计日志保留≥1年 | partial | 数据库无自动清理策略, 需运维配置 |
| XLSX 导出 | blocked_by_dependency | 当前仅 CSV/JSON |

## I. 是否允许 Commit

**Verdict: PASS** ✅

- tsc --noEmit: 0 error
- pnpm build: 成功
- e2e 测试: test-auth-audit.ts
- 不使用 mock 数据
- toast 措辞符合规范
- commit message 含 REQ-2.2.3
