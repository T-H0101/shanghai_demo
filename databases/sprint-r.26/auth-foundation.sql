-- Sprint R.26 - central platform auth foundation
-- Real ADFS/LDAP federation is not claimed here. These tables support the
-- platform-local auth base, login audit, lockout, and RBAC boundary.

CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  department VARCHAR(100),
  accessible_sites TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  linked_unified_user_id UUID REFERENCES unified_users(id) ON DELETE SET NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_accounts_status_check CHECK (status IN ('active', 'disabled', 'locked'))
  -- auth_accounts_role_check 已移除：支持自定义角色（见 ensureAuthSchema / sprint-rbac-m）
);

CREATE TABLE IF NOT EXISTS auth_login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL,
  account_id UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
  site_code VARCHAR(50),
  ip_address VARCHAR(100),
  user_agent TEXT,
  result VARCHAR(30) NOT NULL,
  failure_reason TEXT,
  provider VARCHAR(30) NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_login_audit_result_check CHECK (result IN ('success', 'failed', 'locked', 'logout'))
);

CREATE TABLE IF NOT EXISTS auth_role_permissions (
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission)
);

CREATE INDEX IF NOT EXISTS idx_auth_login_audit_username_created
  ON auth_login_audit(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_result_created
  ON auth_login_audit(result, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_status
  ON auth_accounts(status);

-- 细粒度菜单权限种子（中期 RBAC；不再写入 platform:read）
INSERT INTO auth_role_permissions(role, permission) VALUES
  ('group_admin', 'dashboard:read'),
  ('group_admin', 'sites:list'),
  ('group_admin', 'sites:read'),
  ('group_admin', 'search:read'),
  ('group_admin', 'sync:read'),
  ('group_admin', 'sync:operate'),
  ('group_admin', 'tasks:read'),
  ('group_admin', 'control:submit'),
  ('group_admin', 'task:create'),
  ('group_admin', 'racks:read'),
  ('group_admin', 'volumes:read'),
  ('group_admin', 'cage_moves:read'),
  ('group_admin', 'racks:operate'),
  ('group_admin', 'early_warning:read'),
  ('group_admin', 'users:read'),
  ('group_admin', 'users:write'),
  ('group_admin', 'user:manage'),
  ('group_admin', 'audit:read'),
  ('group_admin', 'platform:operate'),
  ('site_admin', 'dashboard:read'),
  ('site_admin', 'sites:list'),
  ('site_admin', 'sites:read'),
  ('site_admin', 'search:read'),
  ('site_admin', 'sync:read'),
  ('site_admin', 'sync:operate'),
  ('site_admin', 'tasks:read'),
  ('site_admin', 'control:submit'),
  ('site_admin', 'task:create'),
  ('site_admin', 'racks:read'),
  ('site_admin', 'volumes:read'),
  ('site_admin', 'cage_moves:read'),
  ('site_admin', 'racks:operate'),
  ('site_admin', 'early_warning:read'),
  ('site_admin', 'users:read'),
  ('operator', 'dashboard:read'),
  ('operator', 'search:read'),
  ('operator', 'tasks:read'),
  ('operator', 'control:submit'),
  ('operator', 'task:create'),
  ('operator', 'racks:read'),
  ('operator', 'volumes:read'),
  ('operator', 'cage_moves:read'),
  ('operator', 'early_warning:read'),
  ('auditor', 'audit:read'),
  ('viewer', 'dashboard:read'),
  ('viewer', 'sites:list'),
  ('viewer', 'search:read'),
  ('viewer', 'sync:read'),
  ('viewer', 'tasks:read'),
  ('viewer', 'racks:read'),
  ('viewer', 'volumes:read'),
  ('viewer', 'cage_moves:read'),
  ('viewer', 'early_warning:read')
ON CONFLICT (role, permission) DO NOTHING;

-- Local development bootstrap account. Replace through ops/admin process before production use.
INSERT INTO auth_accounts (
  username,
  display_name,
  password_hash,
  role,
  department,
  accessible_sites,
  status
) VALUES (
  'admin',
  '平台管理员',
  'scrypt$N=16384,r=8,p=1$MqzxIjkj5OZolvaiDTzfzw$v0W4xKxwsJhblVcHUVwfEPyUAxU-Vzr2DqZ2cSV5O43QEB8-Zy8jqnzttIs3jaFd4hxeHFpMBuE5F_LE0n9Phg',
  'group_admin',
  '信息技术部',
  ARRAY['*']::TEXT[],
  'active'
) ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE auth_accounts IS '中心平台认证账号: 本地 auth 基座, 可关联 unified_users; 不代表 ADFS/LDAP 直连完成';
COMMENT ON TABLE auth_login_audit IS '登录审计: 登录/失败/锁定/登出记录, 支持检索和导出';
COMMENT ON TABLE auth_role_permissions IS 'RBAC 权限目录: 平台内权限判断边界, 站点权限同步另行实现';
