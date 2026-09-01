# Sprint RBAC-M：菜单级细粒度权限（中期方案落地）

对应 `requirements.md` §3.2 账号权限分配 / §6.2 防越权（总控侧菜单与 API 对齐；站点内设备/卷细粒度仍属站点范围）。

## Requirement IDs

- REQ-3.2（总控侧：角色→能力→菜单/API；站点→设备→卷细粒度仍 `blocked_by_site_change` / 后置）
- REQ-6.2.4 防越权（接口权限校验）

## Requirement 原始文本（摘录）

> 3.2 核心：按“站点→设备→数据”的层级分配权限…  
> 6.2 防越权：严格的接口权限校验…

本 Sprint **不宣称**完成站点内设备/卷 ACL；完成的是总控 **菜单 + 读 API + 角色矩阵** 对齐。

## Implementation

| 项 | 文件 |
|---|---|
| 权限目录/内置矩阵 | `lib/auth/permissions-catalog.ts` |
| 菜单映射 | `lib/auth/menu-permissions.ts` |
| 兼容展开 `platform:read` | `hasPermission` / `requirePermission` |
| 种子 + 一次性迁移 | `lib/auth/server.ts` (`rbac.menu_permissions_v1`) |
| 角色 API | `GET /api/auth/roles`、`PUT /api/auth/roles/[code]` |
| 角色 UI | `components/users/builtin-roles-panel.tsx`（可访问菜单 + 勾选保存） |
| 侧栏过滤 | `components/dashboard/sidebar.tsx` |
| 路由守卫 | `components/auth/route-guard.tsx` |
| 读 API 细权限 | tasks/sites/racks/volumes/sync/dashboard/… |

## Backend reality

- 权限真相：`auth_role_permissions`
- 迁移：首次 `ensureAuthSchema` 覆写五套内置角色；之后 UI 修改不被自动覆盖
- 审计员种子：**仅** `audit:read`
- `platform:read`：兼容别名（持有则视为全部业务 `*:read`），新种子不再写入
- 角色权限变更写 `audit_log`（`role_permissions_update`）
- **未做**：自定义新建角色表 `auth_roles`（M5）；权限变更后强制踢下线（需重新登录）

## UI reality

- 「可访问菜单」只读推导，不单独勾选
- 除 `group_admin` 外内置角色可改权限；保存后 toast 提示重新登录
- 侧栏按 session.permissions 过滤；无权限 URL 重定向到首个可访问菜单

## Mock / Simulator / DRY_RUN / 真控制

- 无 mock；无 DRY_RUN；真实读写中心库 RBAC 表

## Missing pieces

- 自定义角色 CRUD
- 改权限后 JWT/会话即时刷新
- 按钮级隐藏（部分写按钮仍可能可见但 API 403）
- 站点内设备/卷 ACL（需求 §3.2 完整层级）

## Blocker type

- 站点细粒度：`blocked_by_site_change`
- 本 Sprint 总控菜单/API：`partial` → 菜单+读链路可标接近 complete，整体 §3.2 仍 `partial`

## Verdict

`partial`（总控菜单级 RBAC 可用；§3.2 完整层级与自定义角色未完成）

## 是否允许 commit

代码与静态自检通过后方可；需跑：

```bash
pnpm exec tsx scripts/e2e/test-rbac-menus.ts
pnpm exec tsc --noEmit
```
