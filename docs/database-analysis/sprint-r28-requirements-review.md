# Sprint R.28 Requirements Review

> REQ-3.1.3: 账号生命周期管理
> 日期: 2026-06-19
> 审查人: Claude

## A. Requirement 对照

**原始需求 (requirements.md §3.1)**:
> 账号生命周期管理: 支持账号创建/启用/禁用/删除/密码重置；账号删除前需校验是否有未完成任务，避免业务中断。
> 技术约束: 所有账号操作记录审计日志，便于追溯与合规检查。

## B. 前端变更清单

| # | 变更 | 类型 | 真实后端 |
|---|---|---|---|
| 1 | `/users` "Auth 账号管理" Tab | 新增 | ✅ fetch /api/auth/accounts |
| 2 | `/users` 解锁按钮 | 新增 | ✅ POST /api/auth/accounts/[id]/unlock |
| 3 | `/users` blocked 横幅更新 | 修改 | ✅ "部分可用" |

## C. API 变更清单

| # | Endpoint | Method | 说明 |
|---|---|---|---|
| 1 | `/api/auth/accounts` | GET | 账号列表 (keyword/status/role 过滤) |
| 2 | `/api/auth/accounts` | POST | 创建账号 (默认 pending_activation) |
| 3 | `/api/auth/accounts/[id]` | GET | 账号详情 |
| 4 | `/api/auth/accounts/[id]` | PATCH | 启用/禁用/更新 |
| 5 | `/api/auth/accounts/[id]` | DELETE | 删除 (校验未完成任务) |
| 6 | `/api/auth/accounts/[id]/reset-password` | POST | 重置密码 (随机 16 位) |

## D. 数据库变更清单

| # | 变更 | 说明 |
|---|---|---|
| 1 | `auth_accounts` 表 | 已有 (R.26), R.28 新增 CRUD API |

## E. 事件测试清单

| # | 交互 | 验证 |
|---|---|---|
| 1 | 点击 "Auth 账号管理" Tab | fetch /api/auth/accounts |
| 2 | API 返回 | 200 + items[] + admin 账号 |
| 3 | 页面展示 | 账号表格 + 状态 Badge + 操作按钮 |

## F. Mock/Simulator/DRY_RUN 标记

| 项目 | 标记 |
|---|---|
| 账号 CRUD | **真实** |
| 密码重置 | **真实** (scrypt) |
| 删除前校验 | **真实** (查 unified_tasks) |
| 审计写入 | **真实** (audit_log) |

## G. 未完成项

| 项目 | 状态 | 说明 |
|---|---|---|
| 创建账号 UI 弹窗 | not_started | 当前仅 API, 需前端 Dialog |
| 站点权限分配 | blocked_by_auth | 需 R.29 中间件 |
| 密码重置 UI 按钮 | not_started | 当前仅 API |

## H. Verdict

**PASS** ✅ - 后端 API 完整, 前端基础展示完成, 审计写入覆盖。
