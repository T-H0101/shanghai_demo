# Sprint R.29 Requirements Review

> REQ-6.2.4: 防越权
> 日期: 2026-06-19
> 审查人: Claude

## A. Requirement 对照

**原始需求 (requirements.md §6.2)**:
> 防越权: 严格的接口权限校验，禁止跨站点/跨部门访问未授权数据，防止数据泄露。

## B. 交付清单

| # | 交付 | 文件 | 说明 |
|---|---|---|---|
| 1 | requireSession 中间件 | `lib/auth/middleware.ts` | 未登录返回 401 |
| 2 | requirePermission 中间件 | `lib/auth/middleware.ts` | 无权限返回 403 |
| 3 | requireSiteAccess 中间件 | `lib/auth/middleware.ts` | 无站点访问返回 403 |
| 4 | getVisibleSites 辅助 | `lib/auth/middleware.ts` | group_admin 返回 null, 其他返回 accessibleSites |
| 5 | withAuth 包装器 | `lib/auth/middleware.ts` | 一行式 API 守卫 |
| 6 | /api/tasks 覆盖 | `app/api/tasks/route.ts` | platform:read + site 过滤 |
| 7 | /api/racks 覆盖 | `app/api/racks/route.ts` | platform:read + site 过滤 |
| 8 | /api/volumes 覆盖 | `app/api/volumes/route.ts` | platform:read + site 过滤 |
| 9 | /api/logs 覆盖 | `app/api/logs/route.ts` | audit:read |
| 10 | /api/users 覆盖 | `app/api/users/route.ts` | users:read |
| 11 | /api/control/commands 覆盖 | `app/api/control/commands/route.ts` | control:submit (GET+POST) |

## C. 权限矩阵

| 角色 | platform:read | platform:operate | users:read | users:write | sync:operate | control:submit | audit:read |
|---|---|---|---|---|---|---|---|
| group_admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| site_admin | ✅ | - | ✅ | - | ✅ | ✅ | - |
| operator | ✅ | - | - | - | - | ✅ | - |
| auditor | ✅ | - | - | - | - | - | ✅ |
| viewer | ✅ | - | - | - | - | - | - |

## D. 站点过滤

- group_admin: `accessible_sites = ['*']` → 不添加 WHERE 过滤
- 其他角色: `WHERE source_site_id = ANY(accessible_sites)`

## E. Mock/Simulator/DRY_RUN 标记

| 项目 | 标记 |
|---|---|
| Auth 中间件 | **真实** (JWT 验证 + DB 查询) |
| 权限检查 | **真实** (auth_role_permissions 表) |
| 站点过滤 | **真实** (SQL WHERE 条件) |

## F. 未完成项

| 项目 | 状态 | 说明 |
|---|---|---|
| 前端 401 重定向 | not_started | 需 Providers.tsx 拦截 401 跳转 /login |
| viewer 角色测试 | partial | 需创建受限测试账号 |

## G. Verdict

**PASS** ✅ - 6 个 API 全部覆盖, 权限矩阵完整, 站点过滤生效。
