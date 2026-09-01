-- Sprint RBAC-M: 清除残留 platform:read
-- 该码不在角色编辑 UI 中展示，但鉴权会展开为全部业务 *:read，
-- 导致「功能权限勾选不全、可访问菜单却全亮」。

DELETE FROM auth_role_permissions WHERE permission = 'platform:read';

INSERT INTO auth_system_config(key, value, description)
VALUES (
  'rbac.strip_platform_read_v1',
  '1',
  '已清除角色权限中的残留 platform:read'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
