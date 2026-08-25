-- Sprint R.99: 账号员工号/邮箱 + 站点账号映射
-- requirements.md §2.2：AD 写入 auth_accounts；跳站点按当前账号映射 tbl_user.name

ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(200);
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) NOT NULL DEFAULT 'local';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_employee_id_unique
  ON auth_accounts (employee_id)
  WHERE employee_id IS NOT NULL AND employee_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_email_unique
  ON auth_accounts (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS auth_site_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(100),
  email VARCHAR(200),
  auth_account_id UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
  site_code VARCHAR(50) NOT NULL,
  site_local_username VARCHAR(200) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_site_local
  ON auth_site_user_mappings (site_code, lower(site_local_username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_employee_site
  ON auth_site_user_mappings (employee_id, site_code)
  WHERE employee_id IS NOT NULL AND employee_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_email_site
  ON auth_site_user_mappings (lower(email), site_code)
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_account_site
  ON auth_site_user_mappings (auth_account_id, site_code)
  WHERE auth_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_oidc_id_tokens (
  account_id UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  id_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
