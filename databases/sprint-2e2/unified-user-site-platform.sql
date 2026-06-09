-- ============================================================
-- Sprint 2E.2 - User / Site / Platform 中心表
-- ============================================================
-- 用户/站点/平台基础域接入
-- 每张表都包含 source_site_id / source_table / source_id 唯一
-- raw_data 保留源记录 (脱敏后)
-- ============================================================

CREATE TABLE IF NOT EXISTS unified_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_user',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  user_id VARCHAR(100),
  username VARCHAR(100),
  display_name VARCHAR(200),
  status VARCHAR(50),
  role_hint VARCHAR(100),
  department_id VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(200),

  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unified_users_source_unique UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_users_user_id
  ON unified_users(source_site_id, user_id);
CREATE INDEX IF NOT EXISTS idx_unified_users_username
  ON unified_users(source_site_id, username);

COMMENT ON TABLE unified_users IS '用户中心表，源 tbl_user，pwd 已脱敏';

-- ============================================================

CREATE TABLE IF NOT EXISTS unified_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_site',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  site_code VARCHAR(100),
  site_name VARCHAR(200),
  status VARCHAR(50),
  location VARCHAR(200),
  endpoint_url VARCHAR(500),
  description TEXT,

  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unified_sites_source_unique UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_sites_code
  ON unified_sites(source_site_id, site_code);

COMMENT ON TABLE unified_sites IS '站点中心表，源 tbl_site';

-- ============================================================

CREATE TABLE IF NOT EXISTS unified_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_platform',
  source_id VARCHAR(100) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  platform_id VARCHAR(100),
  platform_name VARCHAR(200),
  platform_type VARCHAR(50),
  status VARCHAR(50),
  version VARCHAR(50),
  endpoint_url VARCHAR(500),

  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unified_platforms_source_unique UNIQUE (source_site_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_unified_platforms_id
  ON unified_platforms(source_site_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_unified_platforms_type
  ON unified_platforms(source_site_id, platform_type);

COMMENT ON TABLE unified_platforms IS '平台中心表，源 tbl_platform，pwd 已脱敏';
