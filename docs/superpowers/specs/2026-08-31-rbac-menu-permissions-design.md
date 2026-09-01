# 总控 RBAC 中期方案（菜单级细粒度）

> 对应实现 Sprint：RBAC-M  
> 审查：`docs/database-analysis/sprint-rbac-m-requirements-review.md`

## 原则

1. **一套权限码**：菜单显隐、路由守卫、API、按钮共用。
2. **不存 role_menus**：可访问菜单 = `menusForPermissions(permissions)`。
3. **账号管站点范围**（`accessible_sites`）；**角色管功能**。
4. **`platform:read` 降级为兼容别名**，新种子不再授予。

## 权限码（节选）

| 码 | 用途 |
|---|---|
| `dashboard:read` … `audit:read` | 各菜单「查看」 |
| `sync:operate` / `control:submit` / `racks:operate` … | 写操作 |
| `sites:read` | 历史码：SSO 跳转（非站点列表） |
| `sites:list` | 站点管理菜单/列表 |

## 内置角色目标

| 角色 | 菜单结果 |
|---|---|
| group_admin | 全部（权限矩阵锁定不可改） |
| site_admin | 业务菜单 + 用户只读等 |
| operator | 任务/检索等，无用户/审计 |
| auditor | **仅审计日志** |
| viewer | 业务只读 |

## 页面

`/users` → Tab「账号」|「角色权限」  
角色详情：可访问菜单（推导）+ 功能权限勾选 → `PUT /api/auth/roles/:code`

## 迁移

`auth_system_config.rbac.menu_permissions_v1=1` 后不再自动覆写内置角色。

## 操作提示

改角色权限后，相关用户需**重新登录**后侧栏与 API 权限才更新。
