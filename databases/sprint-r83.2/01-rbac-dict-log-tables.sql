-- ============================================================
-- Sprint R.83.2 — RBAC + 字典 + 日志 15 张业务表 DDL (第一段: 8 张)
-- ============================================================
-- 源: databases/disc_files.sql 严格按字段类型映射
-- 通用列: id / source_site_id / source_table / source_record_id / synced_at / raw_data
-- 必备: UNIQUE(source_site_id, source_record_id) + GIN(raw_data) + B-tree(source_site_id)
-- ============================================================

-- 1. unified_dict_categories ← tbl_dict_category
CREATE TABLE IF NOT EXISTS unified_dict_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_dict_category',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_dict_category_id BIGINT,
  category_code VARCHAR(100),
  category_name VARCHAR(200),
  description TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_dict_categories_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_dict_categories IS 'Unified mirror of source tbl_dict_category';
COMMENT ON COLUMN unified_dict_categories.src_dict_category_id IS '自增字典分类ID';
COMMENT ON COLUMN unified_dict_categories.category_code IS '字典分类编码';
COMMENT ON COLUMN unified_dict_categories.category_name IS '字典分类名称';
CREATE INDEX IF NOT EXISTS idx_unified_dict_categories_site ON unified_dict_categories (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_dict_categories_raw_gin ON unified_dict_categories USING GIN (raw_data jsonb_path_ops);

-- 2. unified_dicts ← tbl_dict
CREATE TABLE IF NOT EXISTS unified_dicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_dict',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_dict_id BIGINT,
  category_id BIGINT,
  dict_code VARCHAR(100),
  dict_name VARCHAR(200),
  dict_value TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_dicts_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_dicts IS 'Unified mirror of source tbl_dict';
COMMENT ON COLUMN unified_dicts.src_dict_id IS '自增字典ID';
COMMENT ON COLUMN unified_dicts.category_id IS '所属字典分类ID';
CREATE INDEX IF NOT EXISTS idx_unified_dicts_site ON unified_dicts (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_dicts_raw_gin ON unified_dicts USING GIN (raw_data jsonb_path_ops);

-- 3. unified_dict_items ← tbl_dict_item
CREATE TABLE IF NOT EXISTS unified_dict_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_dict_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_item_id BIGINT,
  dict_id BIGINT,
  item_key VARCHAR(100),
  item_value TEXT,
  extra TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_dict_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_dict_items IS 'Unified mirror of source tbl_dict_item';
COMMENT ON COLUMN unified_dict_items.src_item_id IS '自增字典项ID';
COMMENT ON COLUMN unified_dict_items.dict_id IS '所属字典ID';
CREATE INDEX IF NOT EXISTS idx_unified_dict_items_site ON unified_dict_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_dict_items_raw_gin ON unified_dict_items USING GIN (raw_data jsonb_path_ops);

-- 4. unified_sys_logs ← tbl_sys_log
CREATE TABLE IF NOT EXISTS unified_sys_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_sys_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  log_level VARCHAR(20),
  module VARCHAR(100),
  message TEXT,
  user_id BIGINT,
  ip_address VARCHAR(50),
  log_time TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_sys_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_sys_logs IS 'Unified mirror of source tbl_sys_log';
COMMENT ON COLUMN unified_sys_logs.src_log_id IS '自增日志ID';
COMMENT ON COLUMN unified_sys_logs.log_level IS '日志级别(INFO/WARN/ERROR)';
CREATE INDEX IF NOT EXISTS idx_unified_sys_logs_site ON unified_sys_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_sys_logs_raw_gin ON unified_sys_logs USING GIN (raw_data jsonb_path_ops);

-- 5. unified_api_logs ← tbl_api_log
CREATE TABLE IF NOT EXISTS unified_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_api_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  api_path VARCHAR(500),
  method VARCHAR(10),
  status_code INTEGER,
  duration_ms INTEGER,
  user_id BIGINT,
  ip_address VARCHAR(50),
  called_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_api_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_api_logs IS 'Unified mirror of source tbl_api_log';
COMMENT ON COLUMN unified_api_logs.api_path IS 'API 路径';
COMMENT ON COLUMN unified_api_logs.method IS 'HTTP 方法';
CREATE INDEX IF NOT EXISTS idx_unified_api_logs_site ON unified_api_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_api_logs_raw_gin ON unified_api_logs USING GIN (raw_data jsonb_path_ops);

-- 6. unified_api_interfaces ← tbl_api_interface
CREATE TABLE IF NOT EXISTS unified_api_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_api_interface',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_interface_id BIGINT,
  interface_code VARCHAR(100),
  interface_name VARCHAR(200),
  path VARCHAR(500),
  method VARCHAR(10),
  required_auth SMALLINT DEFAULT 1,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_api_interfaces_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_api_interfaces IS 'Unified mirror of source tbl_api_interface';
COMMENT ON COLUMN unified_api_interfaces.interface_code IS '接口编码';
COMMENT ON COLUMN unified_api_interfaces.required_auth IS '是否需鉴权 0/1';
CREATE INDEX IF NOT EXISTS idx_unified_api_interfaces_site ON unified_api_interfaces (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_api_interfaces_raw_gin ON unified_api_interfaces USING GIN (raw_data jsonb_path_ops);

-- 7. unified_user_mfas ← tbl_user_mfa
CREATE TABLE IF NOT EXISTS unified_user_mfas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_user_mfa',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_mfa_id BIGINT,
  user_id BIGINT,
  mfa_type VARCHAR(20),
  mfa_secret TEXT,
  enabled SMALLINT DEFAULT 1,
  bound_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_user_mfas_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_user_mfas IS 'Unified mirror of source tbl_user_mfa';
COMMENT ON COLUMN unified_user_mfas.src_mfa_id IS '自增 MFA 绑定ID';
COMMENT ON COLUMN unified_user_mfas.mfa_type IS 'MFA 类型(TOTP/SMS/EMAIL)';
CREATE INDEX IF NOT EXISTS idx_unified_user_mfas_site ON unified_user_mfas (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_user_mfas_raw_gin ON unified_user_mfas USING GIN (raw_data jsonb_path_ops);

-- 8. unified_archives_types ← tbl_archives_type
CREATE TABLE IF NOT EXISTS unified_archives_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_archives_type',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_archives_type_id BIGINT,
  type_code VARCHAR(50),
  type_name VARCHAR(100),
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_archives_types_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_archives_types IS 'Unified mirror of source tbl_archives_type';
COMMENT ON COLUMN unified_archives_types.src_archives_type_id IS '自增档案类型ID';
CREATE INDEX IF NOT EXISTS idx_unified_archives_types_site ON unified_archives_types (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_archives_types_raw_gin ON unified_archives_types USING GIN (raw_data jsonb_path_ops);

-- ============================================================
-- 第二段: 7 张 (含角色族 / 凭据族 / 字典扩展)
-- ============================================================

-- 9. unified_archives_levels ← tbl_archives_level
CREATE TABLE IF NOT EXISTS unified_archives_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_archives_level',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_archives_level_id BIGINT,
  level_code VARCHAR(50),
  level_name VARCHAR(100),
  retention_years INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_archives_levels_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_archives_levels IS 'Unified mirror of source tbl_archives_level';
COMMENT ON COLUMN unified_archives_levels.src_archives_level_id IS '自增档案级别ID';
COMMENT ON COLUMN unified_archives_levels.level_code IS '级别编码';
COMMENT ON COLUMN unified_archives_levels.retention_years IS '保留年限';
CREATE INDEX IF NOT EXISTS idx_unified_archives_levels_site ON unified_archives_levels (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_archives_levels_raw_gin ON unified_archives_levels USING GIN (raw_data jsonb_path_ops);

-- 10. unified_platform_types ← tbl_platform_type
CREATE TABLE IF NOT EXISTS unified_platform_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_platform_type',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_platform_type_id BIGINT,
  type_code VARCHAR(50),
  type_name VARCHAR(100),
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_platform_types_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_platform_types IS 'Unified mirror of source tbl_platform_type';
COMMENT ON COLUMN unified_platform_types.src_platform_type_id IS '自增平台类型ID';
COMMENT ON COLUMN unified_platform_types.type_code IS '平台类型编码';
CREATE INDEX IF NOT EXISTS idx_unified_platform_types_site ON unified_platform_types (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_platform_types_raw_gin ON unified_platform_types USING GIN (raw_data jsonb_path_ops);

-- 11. unified_fucs ← tbl_fuc
CREATE TABLE IF NOT EXISTS unified_fucs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_fuc',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_fuc_id BIGINT,
  fuc_code VARCHAR(100),
  fuc_name VARCHAR(200),
  parent_id BIGINT,
  path VARCHAR(500),
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_fucs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_fucs IS 'Unified mirror of source tbl_fuc';
COMMENT ON COLUMN unified_fucs.src_fuc_id IS '自增功能/权限点ID';
COMMENT ON COLUMN unified_fucs.fuc_code IS '权限点编码';
COMMENT ON COLUMN unified_fucs.parent_id IS '父级功能ID(支持权限树)';
CREATE INDEX IF NOT EXISTS idx_unified_fucs_site ON unified_fucs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_fucs_raw_gin ON unified_fucs USING GIN (raw_data jsonb_path_ops);

-- 12. unified_roles ← tbl_role
CREATE TABLE IF NOT EXISTS unified_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_role',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_role_id BIGINT,
  role_code VARCHAR(50),
  role_name VARCHAR(100),
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_roles_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_roles IS 'Unified mirror of source tbl_role';
COMMENT ON COLUMN unified_roles.src_role_id IS '自增角色ID';
COMMENT ON COLUMN unified_roles.role_code IS '角色编码';
COMMENT ON COLUMN unified_roles.role_name IS '角色名称';
CREATE INDEX IF NOT EXISTS idx_unified_roles_site ON unified_roles (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_roles_raw_gin ON unified_roles USING GIN (raw_data jsonb_path_ops);

-- 13. unified_role_fucs ← tbl_role_fuc (复合 PK role_id+fuc_id)
-- source_record_id 格式: "<role_id>::<fuc_id>"
CREATE TABLE IF NOT EXISTS unified_role_fucs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_role_fuc',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role_id BIGINT,
  fuc_id BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_role_fucs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_role_fucs IS 'Unified mirror of source tbl_role_fuc; composite PK (role_id, fuc_id) flattened to "<role_id>::<fuc_id>"';
COMMENT ON COLUMN unified_role_fucs.role_id IS '角色ID';
COMMENT ON COLUMN unified_role_fucs.fuc_id IS '功能/权限点ID';
CREATE INDEX IF NOT EXISTS idx_unified_role_fucs_site ON unified_role_fucs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_role_fucs_role ON unified_role_fucs (source_site_id, role_id);
CREATE INDEX IF NOT EXISTS idx_unified_role_fucs_raw_gin ON unified_role_fucs USING GIN (raw_data jsonb_path_ops);

-- 14. unified_credible_proves ← tbl_credible_prove
CREATE TABLE IF NOT EXISTS unified_credible_proves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_credible_prove',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_prove_id BIGINT,
  user_id BIGINT,
  prove_type VARCHAR(50),
  prove_value TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_credible_proves_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_credible_proves IS 'Unified mirror of source tbl_credible_prove';
COMMENT ON COLUMN unified_credible_proves.src_prove_id IS '自增凭据证明ID';
COMMENT ON COLUMN unified_credible_proves.prove_type IS '凭据类型(ID_CARD/PASSPORT)';
COMMENT ON COLUMN unified_credible_proves.prove_value IS '凭据值(本轮不加密,后续 Sprint 改造)';
CREATE INDEX IF NOT EXISTS idx_unified_credible_proves_site ON unified_credible_proves (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_credible_proves_raw_gin ON unified_credible_proves USING GIN (raw_data jsonb_path_ops);

-- 15. unified_credible_verifies ← tbl_credible_verify
CREATE TABLE IF NOT EXISTS unified_credible_verifies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_credible_verify',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_verify_id BIGINT,
  prove_id BIGINT,
  verifier_user_id BIGINT,
  verify_result SMALLINT,
  verify_remark TEXT,
  verified_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_credible_verifies_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_credible_verifies IS 'Unified mirror of source tbl_credible_verify';
COMMENT ON COLUMN unified_credible_verifies.src_verify_id IS '自增凭据验证记录ID';
COMMENT ON COLUMN unified_credible_verifies.verify_result IS '验证结果 0=未通过 1=通过';
CREATE INDEX IF NOT EXISTS idx_unified_credible_verifies_site ON unified_credible_verifies (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_credible_verifies_raw_gin ON unified_credible_verifies USING GIN (raw_data jsonb_path_ops);
