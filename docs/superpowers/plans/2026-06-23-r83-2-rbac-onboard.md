# Sprint R.83.2 — RBAC + 字典 + 日志 15 张业务表接入实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中心库 `unified_*` 从 28 张扩到 43 张(R.83.2 +15),新增 5 个 CRUD API 端点,在 `/users` 页加 3 个 Tabs,audit 矩阵升级为实时查仓储。

**Architecture:** 沿用 R.83.1 模式 — 15 张 DDL → `ALLOWED_PACKAGE_TABLES` 28→43 → 15 个新 dispatcher → 5 个 CRUD API → `/users` 页 3 个新 Tabs → audit `--matrix` round 字段查仓储实时算 → 治理矩阵文档 + 15 行 R.83.2 标记 → requirements review + push。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg。

**Base branch:** `codex/center-db-governance`(基于 R.83.1 完成态,HEAD = e323b02 R.83.2 spec commit)。

---

## Task 1: 15 张 DDL(分两段写,先写 8 张非角色)

**Files:**
- Create: `databases/sprint-r83.2/01-rbac-dict-log-tables.sql`
- Modify: `databases/sprint-2b0/init-docker.sh` (加入新 DDL 到 MIGRATION_FILES 数组)
- Test: `databases/sprint-r83.2/__tests__/ddl-self-check.ts`

**强约束(沿用 R.83.1):**
- 6 列标准:`id UUID PK DEFAULT gen_random_uuid()`, `source_site_id VARCHAR(50) NOT NULL`, `source_table VARCHAR(100) NOT NULL DEFAULT '<src>'`, `source_record_id TEXT NOT NULL`, `synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `raw_data JSONB DEFAULT '{}'`
- `UNIQUE(source_site_id, source_record_id)` 约束命名 `unified_<stripped>_site_record_uniq`
- 每张必备索引:`source_site_id` B-tree + GIN on raw_data(`USING GIN (raw_data jsonb_path_ops)`)
- `COMMENT ON TABLE` + `COMMENT ON COLUMN`(关键字段必有注释)

- [ ] **Step 1: 写 ddl-self-check 失败态脚本**

写 `databases/sprint-r83.2/__tests__/ddl-self-check.ts`,该脚本应:
1. 连接 `DATABASE_URL` 中心库
2. 期望 15 张表全部存在(否则列出缺失项并 exit 1)
3. 每张表期望必备 6 列 + UNIQUE 约束 + GIN 索引
4. 每张表期望 COMMENT ON TABLE 已设
5. 期望 `source_site_id VARCHAR(50) NOT NULL`(精确字符数)
6. 期望 `synced_at TIMESTAMPTZ NOT NULL`
7. 期望 `raw_data JSONB` 允许空(无 NOT NULL)
8. 输出 PASS/FAIL summary

- [ ] **Step 2: 跑 ddl-self-check,验证失败**

```bash
pnpm exec tsx databases/sprint-r83.2/__tests__/ddl-self-check.ts
```
预期:FAIL,15 张表全缺失(中心库尚无)。

- [ ] **Step 3: 写 8 张非角色表 DDL**

写 `databases/sprint-r83.2/01-rbac-dict-log-tables.sql` 第一段(8 张):

```sql
-- Header
-- Sprint R.83.2 — RBAC + 字典 + 日志 8 张非角色业务表 DDL
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
```

- [ ] **Step 4: 把 DDL 接到 db:init 迁移链**

编辑 `databases/sprint-2b0/init-docker.sh`,在 MIGRATION_FILES 数组追加一行:

```bash
"databases/sprint-r83.2/01-rbac-dict-log-tables.sql"
```

放在 R.83.1 那一行之后,保持顺序:R.83.1 部门 → R.83.2 第一段 8 张 → 第二段 7 张(Task 2 写)。

- [ ] **Step 5: 应用 DDL 到中心库**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.2/01-rbac-dict-log-tables.sql
```

- [ ] **Step 6: 跑 ddl-self-check 验证 8 张过**

```bash
pnpm exec tsx databases/sprint-r83.2/__tests__/ddl-self-check.ts
```
预期:第一段 8 张 PASS(第二段 7 张未写应 FAIL,但脚本应输出 8/15 OK 状态)。

- [ ] **Step 7: Commit Task 1 第一段**

```bash
git add databases/sprint-r83.2/01-rbac-dict-log-tables.sql databases/sprint-r83.2/__tests__/ddl-self-check.ts databases/sprint-2b0/init-docker.sh
git commit -m "feat(db): R.83.2 first 8 unified_* tables (dict/sys_log/api/user_mfa/archives_type)"
```

---

## Task 2: 15 张 DDL 第二段(7 张:含角色/凭据)

**Files:**
- Modify: `databases/sprint-r83.2/01-rbac-dict-log-tables.sql`(追加 7 张)
- Test: `databases/sprint-r83.2/__tests__/ddl-self-check.ts`(已含,本任务只需跑过)

- [ ] **Step 1: 追加 7 张 DDL**

在文件末尾追加:

```sql
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
```

- [ ] **Step 2: 应用 7 张 DDL**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.2/01-rbac-dict-log-tables.sql 2>&1 | tail -5
```
应无 `ERROR`,输出 `CREATE TABLE / CREATE INDEX / COMMENT` 全部 OK。

- [ ] **Step 3: 跑 ddl-self-check 全过**

```bash
pnpm exec tsx databases/sprint-r83.2/__tests__/ddl-self-check.ts
```
预期:15/15 PASS,exit 0。

- [ ] **Step 4: 验证 15 张表名清单**

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'unified_%'
ORDER BY table_name;" | grep -E "^(unified_dict_categories|unified_dicts|unified_dict_items|unified_sys_logs|unified_api_logs|unified_api_interfaces|unified_user_mfas|unified_archives_types|unified_archives_levels|unified_platform_types|unified_fucs|unified_roles|unified_role_fucs|unified_credible_proves|unified_credible_verifies)$" | wc -l
```
预期:`15`。

- [ ] **Step 5: Commit Task 2**

```bash
git add databases/sprint-r83.2/01-rbac-dict-log-tables.sql
git commit -m "feat(db): R.83.2 second 7 unified_* tables (role/fuc/credential/archives)"
```

---

## Task 3: 白名单 28→43 + 自检脚本

**Files:**
- Modify: `lib/sync/package-schema.ts`(`ALLOWED_PACKAGE_TABLES` 数组追加 15 项)
- Create: `scripts/test-r83.2-whitelist.ts`(白名单 43 项自检)
- Modify: `package.json`(加 `test:r83.2-whitelist` 脚本)

- [ ] **Step 1: 写自检脚本**

写 `scripts/test-r83.2-whitelist.ts`,应:
1. 导入 `ALLOWED_PACKAGE_TABLES`、`FORBIDDEN_PACKAGE_TABLES` from `@/lib/sync/package-schema`
2. 校验总数 = 43(13 既有 + 15 R.83.1 + 15 R.83.2)
3. 校验 R.83.2 新 15 项全部存在:`tbl_role`、`tbl_role_fuc`、`tbl_fuc`、`tbl_dict_category`、`tbl_dict`、`tbl_dict_item`、`tbl_sys_log`、`tbl_api_log`、`tbl_api_interface`、`tbl_user_mfa`、`tbl_archives_type`、`tbl_archives_level`、`tbl_platform_type`、`tbl_credible_prove`、`tbl_credible_verify`
4. 校验无重复
5. 校验 `tbl_file` / `tbl_folder` 仍在 `FORBIDDEN_PACKAGE_TABLES`
6. 校验每个表名格式正确:`^tbl_[a-z0-9_]+$`
7. 输出 PASS/FAIL summary(38 checks)

- [ ] **Step 2: 跑自检,验证当前 FAIL**

```bash
pnpm exec tsx scripts/test-r83.2-whitelist.ts
```
预期:FAIL(白名单 28,新 15 项未加)。

- [ ] **Step 3: 修改 package-schema.ts**

在 `ALLOWED_PACKAGE_TABLES` 数组 R.83.1 段之后追加:

```typescript
  // R.83.2 RBAC + 字典 + 日志 15 张
  'tbl_role',
  'tbl_role_fuc',
  'tbl_fuc',
  'tbl_dict_category',
  'tbl_dict',
  'tbl_dict_item',
  'tbl_sys_log',
  'tbl_api_log',
  'tbl_api_interface',
  'tbl_user_mfa',
  'tbl_archives_type',
  'tbl_archives_level',
  'tbl_platform_type',
  'tbl_credible_prove',
  'tbl_credible_verify',
```

更新顶部注释,把"Sprint 2E.2: 扩展到 13 张"改为"Sprint 2E.2: 13 / R.83.1: +15 (28) / R.83.2: +15 (43)"。

- [ ] **Step 4: 在 package.json 加 script**

```json
"test:r83.2-whitelist": "tsx scripts/test-r83.2-whitelist.ts"
```

- [ ] **Step 5: 跑自检全过**

```bash
pnpm test:r83.2-whitelist
```
预期:38/38 PASS,exit 0。

- [ ] **Step 6: 跑 tsc 验证**

```bash
pnpm exec tsc --noEmit
```
预期:clean(无 type error)。

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/sync/package-schema.ts scripts/test-r83.2-whitelist.ts package.json
git commit -m "feat(sync): extend package whitelist 28 → 43 with R.83.2 batch + self-check"
```

---

## Task 4: 15 个 dispatcher handler

**Files:**
- Modify: `lib/sync/package-dispatcher.ts`(追加 15 个 dispatch function + REGISTRY 15 项)
- Test: 复用 `pnpm smoke:sync`(验证 dispatcher 可被注册中心派发)

- [ ] **Step 1: 写 7 个非角色 dispatcher**

在文件 R.83.1 段后追加:

```typescript
// ============================================================
// R.83.2 RBAC + 字典 + 日志 15 张 — inline UPSERT
// 全部走 source_record_id 溯源(与 R.83.2 DDL 对齐)
// ============================================================

// tbl_dict_category (id)
async function dispatchDictCategory(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dict_categories', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_dict_category_id' },
      { source: 'category_code', target: 'category_code' },
      { source: 'category_name', target: 'category_name' },
      { source: 'description', target: 'description' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_dict (id)
async function dispatchDict(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dicts', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_dict_id' },
      { source: 'category_id', target: 'category_id' },
      { source: 'dict_code', target: 'dict_code' },
      { source: 'dict_name', target: 'dict_name' },
      { source: 'dict_value', target: 'dict_value' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_dict_item (id)
async function dispatchDictItem(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_dict_items', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_item_id' },
      { source: 'dict_id', target: 'dict_id' },
      { source: 'item_key', target: 'item_key' },
      { source: 'item_value', target: 'item_value' },
      { source: 'extra', target: 'extra' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_sys_log (id)
async function dispatchSysLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_sys_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'log_level', target: 'log_level' },
      { source: 'module', target: 'module' },
      { source: 'message', target: 'message' },
      { source: 'user_id', target: 'user_id' },
      { source: 'ip_address', target: 'ip_address' },
      { source: 'log_time', target: 'log_time' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_api_log (id)
async function dispatchApiLog(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_api_logs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_log_id' },
      { source: 'api_path', target: 'api_path' },
      { source: 'method', target: 'method' },
      { source: 'status_code', target: 'status_code' },
      { source: 'duration_ms', target: 'duration_ms' },
      { source: 'user_id', target: 'user_id' },
      { source: 'ip_address', target: 'ip_address' },
      { source: 'called_at', target: 'called_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_api_interface (id)
async function dispatchApiInterface(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_api_interfaces', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_interface_id' },
      { source: 'interface_code', target: 'interface_code' },
      { source: 'interface_name', target: 'interface_name' },
      { source: 'path', target: 'path' },
      { source: 'method', target: 'method' },
      { source: 'required_auth', target: 'required_auth' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_user_mfa (id)
async function dispatchUserMfa(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_user_mfas', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_mfa_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'mfa_type', target: 'mfa_type' },
      { source: 'mfa_secret', target: 'mfa_secret' },
      { source: 'enabled', target: 'enabled' },
      { source: 'bound_at', target: 'bound_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}
```

- [ ] **Step 2: 追加 8 张 dispatcher(含 2 张字典扩展 + 角色族 3 张 + 凭据 2 张)**

```typescript
// tbl_archives_type (id)
async function dispatchArchivesType(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_archives_types', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_archives_type_id' },
      { source: 'type_code', target: 'type_code' },
      { source: 'type_name', target: 'type_name' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_archives_level (id)
async function dispatchArchivesLevel(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_archives_levels', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_archives_level_id' },
      { source: 'level_code', target: 'level_code' },
      { source: 'level_name', target: 'level_name' },
      { source: 'retention_years', target: 'retention_years' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_platform_type (id)
async function dispatchPlatformType(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_platform_types', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_platform_type_id' },
      { source: 'type_code', target: 'type_code' },
      { source: 'type_name', target: 'type_name' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_fuc (id)
async function dispatchFuc(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_fucs', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_fuc_id' },
      { source: 'fuc_code', target: 'fuc_code' },
      { source: 'fuc_name', target: 'fuc_name' },
      { source: 'parent_id', target: 'parent_id' },
      { source: 'path', target: 'path' },
      { source: 'sort_order', target: 'sort_order' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_role (id)
async function dispatchRole(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_roles', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_role_id' },
      { source: 'role_code', target: 'role_code' },
      { source: 'role_name', target: 'role_name' },
      { source: 'description', target: 'description' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// 复合 PK: tbl_role_fuc (role_id, fuc_id) → source_record_id = "<role_id>::<fuc_id>"
async function dispatchRoleFuc(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_role_fucs', {
    sourceIdField: '__composite__',
    sourceIdTransform: (rec) => `${String((rec as Record<string, unknown>).role_id ?? '')}::${String((rec as Record<string, unknown>).fuc_id ?? '')}`,
    columns: [
      { source: 'role_id', target: 'role_id' },
      { source: 'fuc_id', target: 'fuc_id' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_credible_prove (id)
async function dispatchCredibleProve(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_credible_proves', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_prove_id' },
      { source: 'user_id', target: 'user_id' },
      { source: 'prove_type', target: 'prove_type' },
      { source: 'prove_value', target: 'prove_value' },
      { source: 'issued_at', target: 'issued_at' },
      { source: 'expires_at', target: 'expires_at' },
      { source: 'enabled', target: 'enabled' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}

// tbl_credible_verify (id)
async function dispatchCredibleVerify(input: DispatchInput): Promise<DispatchResult> {
  return inlineUpsert(input, 'unified_credible_verifies', {
    sourceIdField: 'id',
    columns: [
      { source: 'id', target: 'src_verify_id' },
      { source: 'prove_id', target: 'prove_id' },
      { source: 'verifier_user_id', target: 'verifier_user_id' },
      { source: 'verify_result', target: 'verify_result' },
      { source: 'verify_remark', target: 'verify_remark' },
      { source: 'verified_at', target: 'verified_at' },
    ],
    sourceIdColumn: 'source_record_id',
  })
}
```

- [ ] **Step 3: 在 REGISTRY 注册 15 项**

找到 `const REGISTRY: Record<...> = { ... }`,在末尾追加 15 项:

```typescript
  // R.83.2 RBAC + 字典 + 日志 15 张
  tbl_dict_category: dispatchDictCategory,
  tbl_dict: dispatchDict,
  tbl_dict_item: dispatchDictItem,
  tbl_sys_log: dispatchSysLog,
  tbl_api_log: dispatchApiLog,
  tbl_api_interface: dispatchApiInterface,
  tbl_user_mfa: dispatchUserMfa,
  tbl_archives_type: dispatchArchivesType,
  tbl_archives_level: dispatchArchivesLevel,
  tbl_platform_type: dispatchPlatformType,
  tbl_fuc: dispatchFuc,
  tbl_role: dispatchRole,
  tbl_role_fuc: dispatchRoleFuc,
  tbl_credible_prove: dispatchCredibleProve,
  tbl_credible_verify: dispatchCredibleVerify,
```

- [ ] **Step 4: tsc 验证**

```bash
pnpm exec tsc --noEmit
```
预期:clean。

- [ ] **Step 5: smoke:sync 验证 dispatcher 注册成功**

```bash
pnpm smoke:sync
```
预期:`Sync smoke passed, 1 task + 1 device`(原 R.83.1 既有用例,验证 dispatcher 整体编译/注册无问题)。

- [ ] **Step 6: Commit Task 4**

```bash
git add lib/sync/package-dispatcher.ts
git commit -m "feat(sync): add 15 R.83.2 dispatcher handlers (RBAC/dict/log/credential)"
```

---

## Task 5: 5 个 CRUD API 端点

**Files:**
- Create: `app/api/rbac/roles/route.ts`
- Create: `app/api/rbac/dicts/route.ts`
- Create: `app/api/rbac/logs/route.ts`
- Create: `app/api/rbac/credentials/route.ts`
- Create: `app/api/rbac/users-mfa/route.ts`
- Create: `app/api/rbac/__tests__/self-check.ts`

**通用模式(每个 route.ts):**
- 接收 `siteCode`(query) 多站筛选
- 接收 `limit/offset`(query) 分页
- GET 返回 `{ code, data: { items, total, sourceTables }, traceId }`
- POST 接收 JSON body,upsert 到对应 `unified_*` 表
- PUT 接收 JSON body 含 `source_site_id` + `source_record_id`,更新对应行
- DELETE 接收 query `source_site_id` + `source_record_id`,删对应行
- 全部走 `lib/db` 的 `query()` 跑参数化 SQL
- 错误处理统一:catch → 500 + `{ code, message, traceId }`

- [ ] **Step 1: 写 roles route(最复杂,含 role + role_fuc + fuc + user_mfa 联合查询)**

```typescript
// app/api/rbac/roles/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query, transaction } from '@/lib/db'

const ROLE_TABLES = ['unified_roles', 'unified_role_fucs', 'unified_fucs', 'unified_user_mfas']

async function list(siteCode: string | null, limit: number, offset: number) {
  const params: unknown[] = []
  let where = ''
  if (siteCode) {
    params.push(siteCode)
    where = `WHERE source_site_id = $${params.length}`
  }
  params.push(limit, offset)
  const result = await query<Record<string, unknown>>(
    `SELECT source_site_id, source_record_id, source_table, synced_at, raw_data
     FROM unified_roles
     ${where}
     ORDER BY synced_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM unified_roles ${where}`,
    siteCode ? [siteCode] : []
  )
  return { items: result.rows, total: Number(countResult.rows[0]?.count ?? 0) }
}

async function create(body: Record<string, unknown>) {
  const { source_site_id, source_table, source_record_id, raw_data } = body as {
    source_site_id?: string
    source_table?: string
    source_record_id?: string
    raw_data?: Record<string, unknown>
  }
  if (!source_site_id || !source_record_id) {
    throw new Error('source_site_id and source_record_id are required')
  }
  return transaction(async (client) => {
    const result = await client.query<{ id: string }>(
      `INSERT INTO unified_roles (source_site_id, source_table, source_record_id, raw_data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (source_site_id, source_record_id) DO UPDATE
         SET raw_data = EXCLUDED.raw_data, synced_at = NOW()
       RETURNING id`,
      [source_site_id, source_table ?? 'manual', source_record_id, JSON.stringify(raw_data ?? {})]
    )
    return { id: result.rows[0]?.id }
  })
}

async function update(body: Record<string, unknown>) {
  const { source_site_id, source_record_id, raw_data } = body as {
    source_site_id?: string
    source_record_id?: string
    raw_data?: Record<string, unknown>
  }
  if (!source_site_id || !source_record_id) {
    throw new Error('source_site_id and source_record_id are required')
  }
  return transaction(async (client) => {
    const result = await client.query(
      `UPDATE unified_roles
       SET raw_data = $3::jsonb, synced_at = NOW()
       WHERE source_site_id = $1 AND source_record_id = $2`,
      [source_site_id, source_record_id, JSON.stringify(raw_data ?? {})]
    )
    return { updated: result.rowCount ?? 0 }
  })
}

async function remove(siteCode: string, recordId: string) {
  return transaction(async (client) => {
    const result = await client.query(
      `DELETE FROM unified_roles WHERE source_site_id = $1 AND source_record_id = $2`,
      [siteCode, recordId]
    )
    return { deleted: result.rowCount ?? 0 }
  })
}

export async function GET(req: NextRequest) {
  const traceId = `rbac-roles-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get('siteCode')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0)
    const data = await list(siteCode, limit, offset)
    return NextResponse.json({ code: 0, data: { ...data, sourceTables: ROLE_TABLES }, traceId })
  } catch (err) {
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : 'unknown', traceId },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const traceId = `rbac-roles-${Date.now()}`
  try {
    const body = await req.json()
    const data = await create(body)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      { code: 400, message: err instanceof Error ? err.message : 'invalid request', traceId },
      { status: 400 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const traceId = `rbac-roles-${Date.now()}`
  try {
    const body = await req.json()
    const data = await update(body)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      { code: 400, message: err instanceof Error ? err.message : 'invalid request', traceId },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const traceId = `rbac-roles-${Date.now()}`
  try {
    const url = new URL(req.url)
    const siteCode = url.searchParams.get('siteCode')
    const recordId = url.searchParams.get('sourceRecordId')
    if (!siteCode || !recordId) {
      throw new Error('siteCode and sourceRecordId are required')
    }
    const data = await remove(siteCode, recordId)
    return NextResponse.json({ code: 0, data, traceId })
  } catch (err) {
    return NextResponse.json(
      { code: 400, message: err instanceof Error ? err.message : 'invalid request', traceId },
      { status: 400 }
    )
  }
}
```

- [ ] **Step 2: 写 dicts / logs / credentials / users-mfa route(每个 80-120 行,模板同 roles)**

按 roles 模板,对应:
- `dicts/route.ts` → `unified_dicts`(主表),sourceTables 数组含 `['unified_dict_categories', 'unified_dicts', 'unified_dict_items', 'unified_archives_types', 'unified_archives_levels', 'unified_platform_types']`
- `logs/route.ts` → `unified_sys_logs`(主表),**只 GET,无 POST/PUT/DELETE**
- `credentials/route.ts` → `unified_credible_proves`(主表),sourceTables 数组含 `['unified_credible_proves', 'unified_credible_verifies']`
- `users-mfa/route.ts` → `unified_user_mfas`(主表)

每个文件结构与 `roles/route.ts` 一致,只是主表名不同。PUT/DELETE 路径里如果有 FK 关联(role_fuc → role),不需要级联删除,各自管理。

- [ ] **Step 3: 写 self-check 脚本**

写 `app/api/rbac/__tests__/self-check.ts`,应:
1. **dev server 必须先启动**(`pnpm dev` 后台)
2. 对 5 个端点都跑:
   - `GET /api/rbac/roles?siteCode=SH01&limit=10` → 200 + `{ code: 0, data: { items, total, sourceTables } }`
   - `POST /api/rbac/roles` body `{ source_site_id, source_record_id, raw_data: { role_name: 'TEST_R83_2' } }` → 200
   - `PUT /api/rbac/roles` body 同上但 raw_data 改 → 200 + `updated: 1`
   - `DELETE /api/rbac/roles?siteCode=SH01&sourceRecordId=test-r83-2-1` → 200 + `deleted: 1`
   - 错误路径:无 siteCode 的 DELETE → 400
3. 5 端点 × 6 路径 = 30 checks
4. 输出 PASS/FAIL summary

- [ ] **Step 4: 后台启动 dev server,跑 self-check**

```bash
pnpm dev &
sleep 8
pnpm exec tsx app/api/rbac/__tests__/self-check.ts
```
预期:30/30 PASS,exit 0。dev server 不关。

- [ ] **Step 5: tsc 验证**

```bash
pnpm exec tsc --noEmit
```
预期:clean。

- [ ] **Step 6: Commit Task 5**

```bash
git add app/api/rbac/ package.json
git commit -m "feat(api): 5 CRUD endpoints for RBAC/dict/log/credential + self-check"
```

- [ ] **Step 7: 加 npm script**

在 `package.json` 加:
```json
"test:r83.2-api": "tsx app/api/rbac/__tests__/self-check.ts"
```

---

## Task 6: 3 个 Rbac Tabs UI 组件

**Files:**
- Create: `components/rbac/role-permissions-tab.tsx`
- Create: `components/rbac/dictionaries-tab.tsx`
- Create: `components/rbac/logs-credentials-tab.tsx`
- Create: `components/rbac/__tests__/self-check.ts`
- Modify: `app/users/page.tsx`(在 Tabs 列表追加 3 个 trigger + 3 个 TabsContent)

- [ ] **Step 1: 写 role-permissions-tab.tsx 框架**

```typescript
// components/rbac/role-permissions-tab.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"

interface RbacItem {
  source_site_id: string
  source_record_id: string
  source_table: string
  synced_at: string
  raw_data: Record<string, unknown>
}

const TABLE = "unified_roles"
const ROLE_TABLES = ["unified_roles", "unified_role_fucs", "unified_fucs", "unified_user_mfas"]

export function RolePermissionsTab() {
  const [items, setItems] = useState<RbacItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/rbac/roles?limit=100`, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setItems(json.data?.items ?? [])
      setTotal(json.data?.total ?? 0)
    } catch (e) {
      toast({ title: "加载失败", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>角色权限 ({total})</span>
          <Button size="sm" onClick={load} disabled={loading}>刷新</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无数据。从 /sites 触发同步后会显示。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>站点</TableHead>
                <TableHead>源记录 ID</TableHead>
                <TableHead>角色名</TableHead>
                <TableHead>同步时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={`${it.source_site_id}-${it.source_record_id}`}>
                  <TableCell>{it.source_site_id}</TableCell>
                  <TableCell className="font-mono text-xs">{it.source_record_id}</TableCell>
                  <TableCell>{String(it.raw_data?.role_name ?? "—")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(it.synced_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          数据来源:{ROLE_TABLES.join(" / ")}(统一库只读视图)
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 写 dictionaries-tab.tsx**

按 Step 1 模板,`/api/rbac/dicts` 端点,表头加 字典名 / 字典值 / 启用,sourceTables 提示含 6 张字典表。

- [ ] **Step 3: 写 logs-credentials-tab.tsx**

按 Step 1 模板,`/api/rbac/logs` 端点,表头加 日志级别 / 模块 / 消息 / 时间,sourceTables 提示含 3 张日志表 + 凭据表。**Read-only**(无 CRUD 按钮)。

- [ ] **Step 4: 修改 app/users/page.tsx 挂载 3 个 Tabs**

a) 加 import:
```typescript
import { RolePermissionsTab } from "@/components/rbac/role-permissions-tab"
import { DictionariesTab } from "@/components/rbac/dictionaries-tab"
import { LogsCredentialsTab } from "@/components/rbac/logs-credentials-tab"
```

b) `authTab` 状态扩 union type:
```typescript
const [authTab, setAuthTab] = useState<"unified" | "auth" | "rbac" | "dict" | "logs">("unified")
```

c) TabsList 追加 3 个 trigger:
```tsx
<TabsTrigger value="rbac" className="text-xs">角色权限</TabsTrigger>
<TabsTrigger value="dict" className="text-xs">字典</TabsTrigger>
<TabsTrigger value="logs" className="text-xs">日志与凭据</TabsTrigger>
```

d) TabsContent 追加 3 段(在 `</TabsContent>` of "auth" 之后):
```tsx
<TabsContent value="rbac" className="mt-4">
  <RolePermissionsTab />
</TabsContent>
<TabsContent value="dict" className="mt-4">
  <DictionariesTab />
</TabsContent>
<TabsContent value="logs" className="mt-4">
  <LogsCredentialsTab />
</TabsContent>
```

- [ ] **Step 5: 写 UI self-check**

写 `components/rbac/__tests__/self-check.ts`,应:
1. 启动 dev server(若未运行)
2. `GET /users` 页面 → 200
3. HTML 中包含 5 个 tab trigger 文字:"统一用户视图"、"Auth 账号管理"、"角色权限"、"字典"、"日志与凭据"
4. HTML 中包含 data-testid 标记(TabsContent)
5. 验证 fetch `/api/rbac/roles` `/dicts` `/logs` 都能 200
6. 24 checks PASS

- [ ] **Step 6: 跑 self-check**

```bash
pnpm exec tsx components/rbac/__tests__/self-check.ts
```
预期:24/24 PASS。

- [ ] **Step 7: tsc + build**

```bash
pnpm exec tsc --noEmit && pnpm build
```
预期:clean。

- [ ] **Step 8: Commit Task 6**

```bash
git add components/rbac/ app/users/page.tsx
git commit -m "feat(ui): 3 Rbac tabs (角色权限/字典/日志与凭据) + self-check"
```

- [ ] **Step 9: 加 npm script**

```json
"test:r83.2-ui": "tsx components/rbac/__tests__/self-check.ts"
```

---

## Task 7: audit matrix round 字段升级为实时查仓储

**Files:**
- Modify: `scripts/audit/center-db-integrity.ts`(`--matrix` 块中 round 生成逻辑)
- Create: `scripts/audit/__tests__/matrix-round-source.ts`

- [ ] **Step 1: 写自检脚本**

写 `scripts/audit/__tests__/matrix-round-source.ts`,应:
1. 跑 `pnpm audit:center-db -- --strict --matrix`
2. 读 `audit/center-db-matrix.json`
3. 校验 `unifiedCount >= 43`
4. 校验 entries 数组中 R.83.2 15 张表的 round 字段 === "R.83.2"
5. 校验 entries 数组中 R.83.1 15 张表的 round 字段 === "R.83.1"
6. 校验 entries 数组中既有 13 张表的 round 字段 === "already"
7. 校验 29 张 tbl_file_*/tbl_folder_* 不在 entries(因为不在 unified_*)
8. 校验 entries 长度 === unifiedCount
9. 12 checks

- [ ] **Step 2: 跑自检,验证当前 round 字段不对**

```bash
pnpm exec tsx scripts/audit/__tests__/matrix-round-source.ts
```
预期:FAIL(R.83.2 15 张 round 字段还在用 doc 包含判断,会是 R.83.2+ 而非 R.83.2)。

- [ ] **Step 3: 修改 center-db-integrity.ts 的 --matrix 块**

找到 `const entries = unified.map((t) => ({...}))`,替换为:

```typescript
// 实时查仓储: round 字段从 ALLOWED_PACKAGE_TABLES 顺序 + 文档 round 标记生成
// 0..12   = already (R.83.1 之前的 13 张既有)
// 13..27  = R.83.1
// 28..42  = R.83.2
// 文档 round 标记如 "| 31 | tbl_depa ... | R.83.1 |" 优先级最高
const ROUND_INDEX: Record<string, string> = {}
ALLOWED_PACKAGE_TABLES.forEach((t, i) => {
  if (i < 13) ROUND_INDEX[t] = 'already'
  else if (i < 28) ROUND_INDEX[t] = 'R.83.1'
  else if (i < 43) ROUND_INDEX[t] = 'R.83.2'
})

const entries = unified.map((t) => {
  const src = t.replace(/^unified_/, 'tbl_')
  // 文档 round 标记优先
  const docRoundMatch = docRef.match(new RegExp(`\\|\\s*\\d+\\s*\\|\\s*${src}\\s*\\|.*?\\|\\s*(R\\.\\d+(\\.\\d+)?|already|deferred|never)\\s*\\|`))
  const round = docRoundMatch?.[1] ?? ROUND_INDEX[src] ?? 'R.83.3+'
  return {
    unified_table: t,
    source_table: src,
    classification: 'pg17_small',
    blocker: 'none',
    round,
  }
})
```

- [ ] **Step 4: 跑自检全过**

```bash
pnpm exec tsx scripts/audit/__tests__/matrix-round-source.ts
```
预期:12/12 PASS。

- [ ] **Step 5: 跑 audit 看 matrix 输出**

```bash
pnpm audit:center-db -- --strict --matrix
```
预期:exit 0,audit/center-db-matrix.json unifiedCount = 43,15 张 R.83.2 round 字段正确。

- [ ] **Step 6: Commit Task 7**

```bash
git add scripts/audit/center-db-integrity.ts scripts/audit/__tests__/matrix-round-source.ts
git commit -m "feat(audit): matrix round 字段升级为实时查 ALLOWED_PACKAGE_TABLES 仓储"
```

- [ ] **Step 7: 加 npm script**

```json
"test:matrix-round": "tsx scripts/audit/__tests__/matrix-round-source.ts"
```

---

## Task 8: 治理矩阵文档 15 行 R.83.2 标记

**Files:**
- Modify: `docs/database-analysis/r83-170-table-governance-matrix.md`(15 行 round 字段)

- [ ] **Step 1: 修改 15 行 round 字段**

用 Edit 工具,15 个 table 行的 round 列分别改为 `R.83.2`:
- `tbl_dict_category` / `tbl_dict` / `tbl_dict_item`
- `tbl_sys_log` / `tbl_api_log` / `tbl_api_interface`
- `tbl_user_mfa`
- `tbl_archives_type` / `tbl_archives_level` / `tbl_platform_type`
- `tbl_fuc` / `tbl_role` / `tbl_role_fuc`
- `tbl_credible_prove` / `tbl_credible_verify`

每行 `round` 列从 `R.83.2+` 改为 `R.83.2`,`notes` 列从 `业务小表 (候选接入)` 改为 `RBAC + 字典 + 日志族 (R.83.2 已落地)`。

- [ ] **Step 2: 同步 R.83.1 矩阵桶分布表**

把 §桶分布 中 R.83.2+ 计数从 113 减 15 = 98,加 R.83.2 计数 15。

- [ ] **Step 3: 验证文档无 lint 错误**

```bash
grep -c "R.83.2 |" docs/database-analysis/r83-170-table-governance-matrix.md
```
预期:`15`。

- [ ] **Step 4: 跑 audit 校验 round 字段已应用**

```bash
pnpm audit:center-db -- --matrix
```
预期:`audit/center-db-matrix.json` 中 R.83.2 15 张 round 字段 = "R.83.2"。

- [ ] **Step 5: Commit Task 8**

```bash
git add docs/database-analysis/r83-170-table-governance-matrix.md
git commit -m "docs(matrix): mark 15 R.83.2 tables (RBAC/dict/log/credential) in governance matrix"
```

---

## Task 9: README + PROJECT_STATUS 更新

**Files:**
- Modify: `README.md`(§5.3.6 R.83.2 入口)
- Modify: `docs/summary/PROJECT_STATUS.md`(R.83.2 段)
- Modify: `docs/summary/ROADMAP.md`(R.83.2 段)

- [ ] **Step 1: README §5.3.6 加 R.83.2 入口**

在 §5.3.5 之后追加 §5.3.6:

```markdown
#### §5.3.6 R.83.2 RBAC + 字典 + 日志 15 张业务表接入

**目标**:把 `unified_*` 中心库从 28 张扩展到 43 张,新增 5 个 CRUD API 端点,在 `/users` 页加 3 个 Tabs。

**交付**:
- 15 张 DDL(`databases/sprint-r83.2/`)
- ALLOWED_PACKAGE_TABLES 28→43(`lib/sync/package-schema.ts`)
- 15 个新 dispatcher handler(`lib/sync/package-dispatcher.ts`)
- 5 个 CRUD API:`/api/rbac/{roles,dicts,logs,credentials,users-mfa}`
- 3 个 UI Tabs(角色权限 / 字典 / 日志与凭据)在 `/users` 页
- audit matrix round 字段升级为实时查 ALLOWED_PACKAGE_TABLES 仓储

**测试**:
- `pnpm test:r83.2-whitelist`(38 checks)
- `pnpm test:r83.2-api`(30 checks)
- `pnpm test:r83.2-ui`(24 checks)
- `pnpm test:matrix-round`(12 checks)
- `pnpm audit:center-db --strict --matrix`(unifiedCount=43)

**审计**: `docs/database-analysis/sprint-r83.2-requirements-review.md`
```

- [ ] **Step 2: PROJECT_STATUS 加 R.83.2 段**

在 R.83.1 段之后加 R.83.2 段,按 R.83.1 模板,列出 7 个 commit hash 与交付总结。

- [ ] **Step 3: ROADMAP 加 R.83.2 标记**

在已完成 Sprint 列表加 `R.83.2 ✅`(放在 R.83.1 之后),附简述。

- [ ] **Step 4: 验证文档无重复编号**

```bash
grep -c "§5.3.6" README.md
```
预期:`1`(唯一)。

- [ ] **Step 5: Commit Task 9**

```bash
git add README.md docs/summary/
git commit -m "docs: README §5.3.6 + PROJECT_STATUS/ROADMAP R.83.2 entry"
```

---

## Task 10: 验收 + 推送

**Files:**
- Create: `docs/database-analysis/sprint-r83.2-requirements-review.md`

- [ ] **Step 1: 跑全量质量门**

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm test:r83.2-whitelist   # 38 checks
pnpm test:r83.2-api          # 30 checks (dev server 必须已起)
pnpm test:r83.2-ui           # 24 checks
pnpm test:matrix-round       # 12 checks
pnpm audit:center-db -- --strict --matrix
pnpm e2e:all                 # 接受 1 个 pre-existing 失败 (e2e:site-agent-sync)
```

预期:除 `e2e:site-agent-sync` 已知 pre-existing 失败外,全部通过。

- [ ] **Step 2: 写 requirements review**

写 `docs/database-analysis/sprint-r83.2-requirements-review.md`,沿用 R.83.1 模板的 11 节,verdict `partial`(15 张业务小表接入基础设施完成,req 状态不变,后续 R.83.3+ 推剩余 98 张)。

- [ ] **Step 3: Commit review**

```bash
git add docs/database-analysis/sprint-r83.2-requirements-review.md
git commit -m "docs(review): strict review for R.83.2 RBAC + 字典 + 日志"
```

- [ ] **Step 4: 推送(等 GitHub 443 恢复)**

```bash
git push origin codex/center-db-governance
```

若失败,记录重试,直到成功。

- [ ] **Step 5: 验证分支隔离**

```bash
git log main..codex/center-db-governance --oneline | wc -l
```
预期:在 R.83.1 的 13 commits + spec 1 commit + R.83.2 实现 commits 之间。`main` HEAD 仍为 `919c9bd`,无污染。

- [ ] **Step 6: 写完成总结消息**

回复用户:列出 9 个 commit 摘要、unifiedCount 43 → 28 → 15 张 R.83.2、5 个 CRUD 端点 + 3 个 Tab、3 项 e2e 全部 PASS(除 1 个 pre-existing)、GitHub 推送状态。

---

## 不变量(Sprint R.83.2 完成后必须 true)

| 不变量 | 验证命令 | 预期 |
|---|---|---|
| `unified_*` 表数 ≥ 43 | `psql ... "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` | ≥ 43 |
| `ALLOWED_PACKAGE_TABLES` 数 = 43 | `pnpm test:r83.2-whitelist` | 38/38 PASS |
| 15 dispatcher handler 编译过 | `pnpm exec tsc --noEmit` | clean |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | exit 0,unifiedCount=43 |
| 5 个 CRUD API self-check | `pnpm test:r83.2-api` | 30/30 PASS |
| 3 个 Tab UI self-check | `pnpm test:r83.2-ui` | 24/24 PASS |
| matrix round 字段实时查 | `pnpm test:matrix-round` | 12/12 PASS |
| 治理矩阵 15 行 R.83.2 标记 | `grep -c "R.83.2 |" docs/database-analysis/r83-170-table-governance-matrix.md` | 15 |
| 任何 `app/api/rbac/**` 不引用 restore 库 | `grep -r "SOURCE_DATABASE_URL\|SITE_DATABASE_URL" app/api/rbac/` | 0 命中 |
| R.83.2 requirements review 产出 | `docs/database-analysis/sprint-r83.2-requirements-review.md` | 存在 |
| 主分支未污染 | `git log main..codex/center-db-governance` | 14+ commits |

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 5 个 API 端点 schema 不一致 | 同一模板生成;self-check 验证 GET/POST/PUT/DELETE 行为 |
| Tabs UI 复用 users 页破坏现有结构 | 复用 `Tabs/TabsList/TabsContent` Radix 组件,只追加 |
| audit round 字段实时查失败(白名单与文档不一致) | 文档 round 标记优先 + 白名单 index 兜底 |
| dev server 不在跑导致 API/UI 自检失败 | Task 5/6 self-check 内部 spawn dev server,跑完 kill |
| 凭据表 `mfa_secret` / `prove_value` 走中心库违反"敏感字段不可逆加密" | `audit:center-db` 已含 `SENSITIVE_RAW_KEYS` 扫描,本轮需追加 `mfa_secret` / `prove_value` 触发 fail,后续 R.83.3 改造为 hash 存储(本轮不修,只标 blocker) |
| 远端 GitHub 443 持续断 | 暂不推,本地 commit 完成后写明状态,待网络恢复统一推 |
