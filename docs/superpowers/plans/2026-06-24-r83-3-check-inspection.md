# Sprint R.83.3 — tbl_check_* 检查巡检族 15 张 + Task 11 真实端到端同步验证实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中心库 `unified_*` 从 43 张扩到 58 张(R.83.3 +15,聚焦检查巡检族);**新增 Task 11 强制要求真实点击"立即同步"按钮 → 走 dump 链路 → 验证 43 张白名单表在中心库 rowCount > 0**。

**Architecture:** Task 1-10 沿用 R.83.2 模板 — DDL → 白名单 43→58 → dispatcher → API → UI → audit。**Task 11 是 R.83.3 关键新增**:在 `/sync` 页加"立即同步 SH01"按钮 → `POST /api/sync/dump-now` → spawn `sync:dump:export` + `sync:dump:ingest` 子进程 → 真 upsert → 验证中心库 43 张表 rowCount > 0 → 通过 Playwright 真实点击验证。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg + Playwright。

**Base branch:** `codex/center-db-governance` HEAD = `72942db`(spec commit)。

**Source:** `site_restore_full_postgres.star_storage_db`(已在 R.2C 既有,docker 5434,仅 `lib/sync/` 与 `scripts/sync/**` 允许连接)。

---

## Task 1: 15 张 DDL(分两段写,先写 7 张检查族)

**Files:**
- Create: `databases/sprint-r83.3/01-check-inspection-tables.sql`
- Modify: `databases/sprint-2b0/init-docker.sh`(追加到 MIGRATION_FILES)
- Test: `databases/sprint-r83.3/__tests__/ddl-self-check.ts`

**强约束(沿用 R.83.1/R.83.2)**:6 列标准、UNIQUE(source_site_id, source_record_id)、GIN(raw_data)、B-tree(source_site_id)、COMMENT ON TABLE、idempotent。

**命名冲突处理**:`unified_check_files` 已被 R.83.1 占用,本轮用 `unified_check_files_2`(单数) / `unified_check_files_pl`(复数)。

- [ ] **Step 1: 写 ddl-self-check 失败态**

写 `databases/sprint-r83.3/__tests__/ddl-self-check.ts`,与 R.83.2 同模板,期望 15 张表:
```
unified_check_categories, unified_check_sub_categories, unified_check_items, unified_check_sectors,
unified_check_templates, unified_check_tasks, unified_check_task_items, unified_check_task_files,
unified_check_files_2, unified_check_files_pl, unified_check_logs,
unified_check_patrol_strategies, unified_check_patrol_tasks, unified_check_patrol_task_items, unified_check_patrol_logs
```

- [ ] **Step 2: 跑失败态**

```bash
pnpm exec tsx databases/sprint-r83.3/__tests__/ddl-self-check.ts
```
预期:FAIL,15 张全缺失。

- [ ] **Step 3: 写 7 张检查族 DDL(检查分类 / 子分类 / 项 / 扇区 / 模板 / 任务 / 任务项)**

`databases/sprint-r83.3/01-check-inspection-tables.sql` 第一段 7 张:

```sql
-- ============================================================
-- Sprint R.83.3 — tbl_check_* 检查巡检族 15 张业务表 DDL (第一段: 7 张)
-- 源: databases/disc_files.sql 严格按字段类型映射
-- 命名冲突: unified_check_files 已被 R.83.1 占用,本轮用 _2 / _pl suffix
-- ============================================================

-- 1. unified_check_categories ← tbl_check_category (id)
CREATE TABLE IF NOT EXISTS unified_check_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_category',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_category_id BIGINT,
  category_code VARCHAR(50),
  category_name VARCHAR(100),
  parent_id BIGINT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_categories_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_categories IS 'Unified mirror of source tbl_check_category';
COMMENT ON COLUMN unified_check_categories.src_category_id IS '自增检查分类ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_categories_site ON unified_check_categories (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_categories_raw_gin ON unified_check_categories USING GIN (raw_data jsonb_path_ops);

-- 2. unified_check_sub_categories ← tbl_check_sub_category (id)
CREATE TABLE IF NOT EXISTS unified_check_sub_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_sub_category',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sub_category_id BIGINT,
  category_id BIGINT,
  sub_category_code VARCHAR(50),
  sub_category_name VARCHAR(100),
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_sub_categories_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_sub_categories IS 'Unified mirror of source tbl_check_sub_category';
COMMENT ON COLUMN unified_check_sub_categories.src_sub_category_id IS '自增子分类ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_sub_categories_site ON unified_check_sub_categories (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_sub_categories_raw_gin ON unified_check_sub_categories USING GIN (raw_data jsonb_path_ops);

-- 3. unified_check_items ← tbl_check_item (id)
CREATE TABLE IF NOT EXISTS unified_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_item_id BIGINT,
  sub_category_id BIGINT,
  item_code VARCHAR(100),
  item_name VARCHAR(200),
  check_method VARCHAR(100),
  pass_criteria TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_items IS 'Unified mirror of source tbl_check_item';
COMMENT ON COLUMN unified_check_items.src_item_id IS '自增检查项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_items_site ON unified_check_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_items_raw_gin ON unified_check_items USING GIN (raw_data jsonb_path_ops);

-- 4. unified_check_sectors ← tbl_check_sector (id)
CREATE TABLE IF NOT EXISTS unified_check_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_sector',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_sector_id BIGINT,
  sector_code VARCHAR(50),
  sector_name VARCHAR(100),
  description TEXT,
  sort_order INTEGER,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_sectors_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_sectors IS 'Unified mirror of source tbl_check_sector';
COMMENT ON COLUMN unified_check_sectors.src_sector_id IS '自增扇区ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_sectors_site ON unified_check_sectors (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_sectors_raw_gin ON unified_check_sectors USING GIN (raw_data jsonb_path_ops);

-- 5. unified_check_templates ← tbl_check_template (id)
CREATE TABLE IF NOT EXISTS unified_check_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_template',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_template_id BIGINT,
  template_code VARCHAR(50),
  template_name VARCHAR(100),
  category_id BIGINT,
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_templates_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_templates IS 'Unified mirror of source tbl_check_template';
COMMENT ON COLUMN unified_check_templates.src_template_id IS '自增模板ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_templates_site ON unified_check_templates (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_templates_raw_gin ON unified_check_templates USING GIN (raw_data jsonb_path_ops);

-- 6. unified_check_tasks ← tbl_check_task (id)
CREATE TABLE IF NOT EXISTS unified_check_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_id BIGINT,
  task_name VARCHAR(200),
  template_id BIGINT,
  sector_id BIGINT,
  status VARCHAR(20),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_tasks IS 'Unified mirror of source tbl_check_task';
COMMENT ON COLUMN unified_check_tasks.src_task_id IS '自增检查任务ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_tasks_site ON unified_check_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_tasks_raw_gin ON unified_check_tasks USING GIN (raw_data jsonb_path_ops);

-- 7. unified_check_task_items ← tbl_check_task_item (id)
CREATE TABLE IF NOT EXISTS unified_check_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_item_id BIGINT,
  task_id BIGINT,
  item_id BIGINT,
  result VARCHAR(20),
  remark TEXT,
  checked_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_task_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_task_items IS 'Unified mirror of source tbl_check_task_item';
COMMENT ON COLUMN unified_check_task_items.src_task_item_id IS '自增任务项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_task_items_site ON unified_check_task_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_task_items_raw_gin ON unified_check_task_items USING GIN (raw_data jsonb_path_ops);
```

- [ ] **Step 4: 修改 init-docker.sh**

读 `databases/sprint-2b0/init-docker.sh` 找 MIGRATION_FILES 数组位置,追加:
```bash
"databases/sprint-r83.3/01-check-inspection-tables.sql"
```

- [ ] **Step 5: 应用 DDL**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.3/01-check-inspection-tables.sql 2>&1 | tail -10
```

- [ ] **Step 6: 跑 ddl-self-check 7 张 PASS,8 张 FAIL**

```bash
pnpm exec tsx databases/sprint-r83.3/__tests__/ddl-self-check.ts
```

- [ ] **Step 7: Commit**

```bash
git add databases/sprint-r83.3/01-check-inspection-tables.sql databases/sprint-r83.3/__tests__/ddl-self-check.ts databases/sprint-2b0/init-docker.sh
git commit -m "feat(db): R.83.3 first 7 unified_check_* tables (category/sub/item/sector/template/task/task_item)"
```

---

## Task 2: 15 张 DDL 第二段(8 张:含任务文件 / 检查文件 _2 _pl / 日志 / 巡检族 4 张)

**Files:**
- Modify: `databases/sprint-r83.3/01-check-inspection-tables.sql`(追加 8 张)

- [ ] **Step 1: 追加 8 张 DDL**

```sql

-- ============================================================
-- 第二段: 8 张 (含任务文件 / 检查文件 _2 _pl / 日志 / 巡检族 4 张)
-- ============================================================

-- 8. unified_check_task_files ← tbl_check_task_file (id)
CREATE TABLE IF NOT EXISTS unified_check_task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_task_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_file_id BIGINT,
  task_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_task_files_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_task_files IS 'Unified mirror of source tbl_check_task_file';
COMMENT ON COLUMN unified_check_task_files.src_task_file_id IS '自增任务文件ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_task_files_site ON unified_check_task_files (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_task_files_raw_gin ON unified_check_task_files USING GIN (raw_data jsonb_path_ops);

-- 9. unified_check_files_2 ← tbl_check_file (id, 单数)
-- 命名冲突: unified_check_files 已被 R.83.1 占用
CREATE TABLE IF NOT EXISTS unified_check_files_2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_check_file_id BIGINT,
  check_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_files_2_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_files_2 IS 'Unified mirror of source tbl_check_file (singular); suffix _2 to avoid conflict with R.83.1 unified_check_files';
COMMENT ON COLUMN unified_check_files_2.src_check_file_id IS '自增检查文件ID(单数)';
CREATE INDEX IF NOT EXISTS idx_unified_check_files_2_site ON unified_check_files_2 (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_files_2_raw_gin ON unified_check_files_2 USING GIN (raw_data jsonb_path_ops);

-- 10. unified_check_files_pl ← tbl_check_files (id, 复数)
CREATE TABLE IF NOT EXISTS unified_check_files_pl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_files',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_check_file_id BIGINT,
  check_id BIGINT,
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_files_pl_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_files_pl IS 'Unified mirror of source tbl_check_files (plural); suffix _pl to avoid conflict with R.83.1 unified_check_files';
COMMENT ON COLUMN unified_check_files_pl.src_check_file_id IS '自增检查文件ID(复数)';
CREATE INDEX IF NOT EXISTS idx_unified_check_files_pl_site ON unified_check_files_pl (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_files_pl_raw_gin ON unified_check_files_pl USING GIN (raw_data jsonb_path_ops);

-- 11. unified_check_logs ← tbl_check_log (id)
CREATE TABLE IF NOT EXISTS unified_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_log_id BIGINT,
  task_id BIGINT,
  log_level VARCHAR(20),
  message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_logs IS 'Unified mirror of source tbl_check_log';
COMMENT ON COLUMN unified_check_logs.src_log_id IS '自增检查日志ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_logs_site ON unified_check_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_logs_raw_gin ON unified_check_logs USING GIN (raw_data jsonb_path_ops);

-- 12. unified_check_patrol_strategies ← tbl_check_patrol_strategy (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_strategy',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_strategy_id BIGINT,
  strategy_name VARCHAR(200),
  cron_expression VARCHAR(100),
  task_template_id BIGINT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_strategies_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_strategies IS 'Unified mirror of source tbl_check_patrol_strategy';
COMMENT ON COLUMN unified_check_patrol_strategies.src_strategy_id IS '自增巡检策略ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_strategies_site ON unified_check_patrol_strategies (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_strategies_raw_gin ON unified_check_patrol_strategies USING GIN (raw_data jsonb_path_ops);

-- 13. unified_check_patrol_tasks ← tbl_check_patrol_task (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_task_id BIGINT,
  strategy_id BIGINT,
  task_name VARCHAR(200),
  status VARCHAR(20),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_tasks IS 'Unified mirror of source tbl_check_patrol_task';
COMMENT ON COLUMN unified_check_patrol_tasks.src_patrol_task_id IS '自增巡检任务ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_tasks_site ON unified_check_patrol_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_tasks_raw_gin ON unified_check_patrol_tasks USING GIN (raw_data jsonb_path_ops);

-- 14. unified_check_patrol_task_items ← tbl_check_patrol_task_item (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_task_item',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_task_item_id BIGINT,
  patrol_task_id BIGINT,
  sector_id BIGINT,
  result VARCHAR(20),
  remark TEXT,
  checked_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_task_items_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_task_items IS 'Unified mirror of source tbl_check_patrol_task_item';
COMMENT ON COLUMN unified_check_patrol_task_items.src_patrol_task_item_id IS '自增巡检任务项ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_task_items_site ON unified_check_patrol_task_items (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_task_items_raw_gin ON unified_check_patrol_task_items USING GIN (raw_data jsonb_path_ops);

-- 15. unified_check_patrol_logs ← tbl_check_patrol_log (id)
CREATE TABLE IF NOT EXISTS unified_check_patrol_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_check_patrol_log',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_patrol_log_id BIGINT,
  patrol_task_id BIGINT,
  log_level VARCHAR(20),
  message TEXT,
  logged_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_check_patrol_logs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_check_patrol_logs IS 'Unified mirror of source tbl_check_patrol_log';
COMMENT ON COLUMN unified_check_patrol_logs.src_patrol_log_id IS '自增巡检日志ID';
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_logs_site ON unified_check_patrol_logs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_check_patrol_logs_raw_gin ON unified_check_patrol_logs USING GIN (raw_data jsonb_path_ops);
```

- [ ] **Step 2: 应用 8 张 DDL**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.3/01-check-inspection-tables.sql 2>&1 | tail -10
```

- [ ] **Step 3: 跑 ddl-self-check 全过**

```bash
pnpm exec tsx databases/sprint-r83.3/__tests__/ddl-self-check.ts
```
预期:15/15 PASS,exit 0。

- [ ] **Step 4: Commit**

```bash
git add databases/sprint-r83.3/01-check-inspection-tables.sql
git commit -m "feat(db): R.83.3 second 8 unified_check_* tables (task_file/files_2/files_pl/log/patrol family)"
```

---

## Task 3: 白名单 43→58 + 自检

**Files:**
- Modify: `lib/sync/package-schema.ts`(ALLOWED_PACKAGE_TABLES 加 15 项)
- Create: `scripts/test-r83.3-whitelist.ts`
- Modify: `package.json`

- [ ] **Step 1: 写自检脚本**

写 `scripts/test-r83.3-whitelist.ts`,校验总数 = 58(43 + 15)、R.83.3 新 15 项存在、无重复、`tbl_file`/`tbl_folder` 仍 forbidden。

- [ ] **Step 2: 跑失败态**

```bash
pnpm exec tsx scripts/test-r83.3-whitelist.ts
```

- [ ] **Step 3: 修改 package-schema.ts**

追加 15 项到 ALLOWED_PACKAGE_TABLES 末尾:
```typescript
  // R.83.3 检查巡检族 15 张
  'tbl_check_category',
  'tbl_check_sub_category',
  'tbl_check_item',
  'tbl_check_sector',
  'tbl_check_template',
  'tbl_check_task',
  'tbl_check_task_item',
  'tbl_check_task_file',
  'tbl_check_file',
  'tbl_check_files',
  'tbl_check_log',
  'tbl_check_patrol_strategy',
  'tbl_check_patrol_task',
  'tbl_check_patrol_task_item',
  'tbl_check_patrol_log',
```

更新顶部 JSDoc:
```
 * R.83.3: 扩展到 58 张 (检查巡检族 15 张)
```

- [ ] **Step 4: 加 npm script**

```json
"test:r83.3-whitelist": "tsx scripts/test-r83.3-whitelist.ts"
```

- [ ] **Step 5: 跑全过 + tsc clean**

```bash
pnpm test:r83.3-whitelist && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add lib/sync/package-schema.ts scripts/test-r83.3-whitelist.ts package.json
git commit -m "feat(sync): extend package whitelist 43 → 58 with R.83.3 batch + self-check"
```

---

## Task 4: 15 个 dispatcher handler

**Files:**
- Modify: `lib/sync/package-dispatcher.ts`(15 个 dispatch + REGISTRY 15 项)

- [ ] **Step 1: 写 8 个 dispatcher(检查族)**

按 R.83.2 模板,每个 dispatch 调用 `inlineUpsert(input, 'unified_check_<stripped>', { sourceIdField, columns, sourceIdColumn: 'source_record_id' })`。

8 个 dispatch function:
- `dispatchCheckCategory` → `unified_check_categories`
- `dispatchCheckSubCategory` → `unified_check_sub_categories`
- `dispatchCheckItem` → `unified_check_items`
- `dispatchCheckSector` → `unified_check_sectors`
- `dispatchCheckTemplate` → `unified_check_templates`
- `dispatchCheckTask` → `unified_check_tasks`
- `dispatchCheckTaskItem` → `unified_check_task_items`
- `dispatchCheckTaskFile` → `unified_check_task_files`

- [ ] **Step 2: 写 7 个 dispatcher(检查文件 _2 _pl + 日志 + 巡检族 4 张)**

- `dispatchCheckFile2`(单数) → `unified_check_files_2`,sourceIdField: 'id'
- `dispatchCheckFilesPl`(复数) → `unified_check_files_pl`,sourceIdField: 'id'
- `dispatchCheckLog` → `unified_check_logs`
- `dispatchCheckPatrolStrategy` → `unified_check_patrol_strategies`
- `dispatchCheckPatrolTask` → `unified_check_patrol_tasks`
- `dispatchCheckPatrolTaskItem` → `unified_check_patrol_task_items`
- `dispatchCheckPatrolLog` → `unified_check_patrol_logs`

- [ ] **Step 3: REGISTRY 注册 15 项**

```typescript
  // R.83.3 检查巡检族 15 张
  tbl_check_category: dispatchCheckCategory,
  tbl_check_sub_category: dispatchCheckSubCategory,
  tbl_check_item: dispatchCheckItem,
  tbl_check_sector: dispatchCheckSector,
  tbl_check_template: dispatchCheckTemplate,
  tbl_check_task: dispatchCheckTask,
  tbl_check_task_item: dispatchCheckTaskItem,
  tbl_check_task_file: dispatchCheckTaskFile,
  tbl_check_file: dispatchCheckFile2,
  tbl_check_files: dispatchCheckFilesPl,
  tbl_check_log: dispatchCheckLog,
  tbl_check_patrol_strategy: dispatchCheckPatrolStrategy,
  tbl_check_patrol_task: dispatchCheckPatrolTask,
  tbl_check_patrol_task_item: dispatchCheckPatrolTaskItem,
  tbl_check_patrol_log: dispatchCheckPatrolLog,
```

- [ ] **Step 4: tsc + smoke**

```bash
pnpm exec tsc --noEmit && pnpm smoke:sync
```

- [ ] **Step 5: Commit**

```bash
git add lib/sync/package-dispatcher.ts
git commit -m "feat(sync): add 15 R.83.3 dispatcher handlers (check inspection + patrol family)"
```

---

## Task 5: 2 个 CRUD API 端点

**Files:**
- Create: `app/api/check/inspections/route.ts`
- Create: `app/api/check/patrols/route.ts`
- Create: `app/api/check/__tests__/self-check.ts`

- [ ] **Step 1: 写 self-check 脚本**

写 `app/api/check/__tests__/self-check.ts`,与 R.83.2 同模板,2 端点 × 5 happy + 2 negative = 22 checks。

- [ ] **Step 2: 跑失败态**

- [ ] **Step 3: 写 inspections route**

```typescript
// app/api/check/inspections/route.ts
import { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db"

const TARGET_TABLE = "unified_check_categories"  // 主表
const SOURCE_TABLES = [
  "unified_check_categories", "unified_check_sub_categories", "unified_check_items",
  "unified_check_sectors", "unified_check_templates", "unified_check_tasks",
  "unified_check_task_items", "unified_check_task_files",
  "unified_check_files_2", "unified_check_files_pl", "unified_check_logs"
]
// ... (list/upsert/update/remove + GET/POST/PUT/DELETE 模板同 R.83.2)
```

- [ ] **Step 4: 写 patrols route**

```typescript
const TARGET_TABLE = "unified_check_patrol_strategies"
const SOURCE_TABLES = [
  "unified_check_patrol_strategies", "unified_check_patrol_tasks",
  "unified_check_patrol_task_items", "unified_check_patrol_logs"
]
```

- [ ] **Step 5: 加 npm script + 跑测试 + tsc + build**

- [ ] **Step 6: Commit**

```bash
git add app/api/check/ package.json
git commit -m "feat(api): 2 CRUD endpoints for check inspection/patrol + self-check"
```

---

## Task 6: /check 新页面 + 5 个 Tabs + nav 注入

**Files:**
- Create: `app/check/page.tsx`
- Create: `components/check/__tests__/self-check.ts`
- Modify: `components/layout/app-shell.tsx`(或最近似 nav 组件,加 `/check` 入口)

- [ ] **Step 1: 写 UI self-check 脚本**

15 checks: 5 tab 文字 + API 200 + 无误导措辞 + 无 restore_db ref。

- [ ] **Step 2: 跑失败态**

- [ ] **Step 3: 写 app/check/page.tsx(5 个 Tabs: 概览 / 检查分类 / 检查任务 / 巡检策略 / 日志)**

参考 R.83.2 `app/users/page.tsx` 的 Tabs 结构,fetch 走 `/api/check/inspections` 和 `/api/check/patrols`。

- [ ] **Step 4: 在 app-shell 加 nav 项**

读 `components/layout/app-shell.tsx` 找 nav 数组,追加 `{ href: '/check', label: '盘笼检查', icon: <CheckCircle /> }`。若 shell 已存在 `CheckCircle` import 则复用,否则用最接近的 icon(如 `ClipboardList`)。

- [ ] **Step 5: 加 npm script + 跑测试 + tsc + build**

- [ ] **Step 6: Commit**

```bash
git add app/check/ components/layout/app-shell.tsx components/check/ package.json
git commit -m "feat(ui): /check page with 5 tabs + nav entry"
```

---

## Task 7: audit 矩阵 round 字段升级支持 R.83.3

**Files:**
- Modify: `scripts/audit/center-db-integrity.ts`(ROUND_BY_INDEX 数组 + matrix-round-source 测试)

R.83.2 时 round 索引是 0-42 = already/R.83.1/R.83.2。R.83.3 升级:
- 0-12 (13) = already
- 13-27 (15) = R.83.1
- 28-42 (15) = R.83.2
- 43-57 (15) = R.83.3

- [ ] **Step 1: 跑现有 matrix-round-source 验证仍 PASS**(R.83.2 测试不依赖轮次范围)

- [ ] **Step 2: 修改 center-db-integrity.ts 的 ROUND_BY_INDEX**

```typescript
ALLOWED_PACKAGE_TABLES.forEach((t, i) => {
  if (i < 13) ROUND_BY_INDEX[t] = 'already'
  else if (i < 28) ROUND_BY_INDEX[t] = 'R.83.1'
  else if (i < 43) ROUND_BY_INDEX[t] = 'R.83.2'
  else if (i < 58) ROUND_BY_INDEX[t] = 'R.83.3'
})
```

- [ ] **Step 3: 跑 audit + tsc**

```bash
pnpm audit:center-db -- --strict --matrix && pnpm test:matrix-round && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/center-db-integrity.ts
git commit -m "feat(audit): matrix round R.83.3 range (positions 43-57)"
```

---

## Task 8: 治理矩阵文档 15 行 R.83.3 标记 + 桶分布 98→83

**Files:**
- Modify: `docs/database-analysis/r83-170-table-governance-matrix.md`

- [ ] **Step 1: 桶分布表更新**

加 `R.83.3 | 15 | 检查巡检族 (本 Sprint 落地)`,改 `R.83.3+ | 98` → `R.83.4+ | 83`。

- [ ] **Step 2: 15 行 round 字段改 R.83.3**

逐行 Edit,把 15 个 `tbl_check_*` 行的 round 列从 `R.83.2+` 改为 `R.83.3`,notes 改为 `检查巡检族 (R.83.3 已落地)`。

- [ ] **Step 3: grep 验证**

```bash
grep -c "| R\\.83\\.3 |" docs/database-analysis/r83-170-table-governance-matrix.md
```
预期:15。

- [ ] **Step 4: 跑 audit 验证 round 应用**

- [ ] **Step 5: Commit**

```bash
git add docs/database-analysis/r83-170-table-governance-matrix.md
git commit -m "docs(matrix): mark 15 R.83.3 tables (check inspection + patrol) in governance matrix"
```

---

## Task 9: README + PROJECT_STATUS + ROADMAP 更新

**Files:**
- Modify: `README.md`(§5.3.7)
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

按 R.83.2 模板加 §5.3.7 + R.83.3 段 + R.83.3 行。

- [ ] **Step 1-5**:照 R.83.2 步骤

---

## Task 10: 任务控制子链路自检(原有 audit + API + UI,不重做)

按 R.83.2 Task 10 模板,跑全量质量门(ttsc + smoke + 4 self-check + audit + build)。

- [ ] **Step 1-5**:跑全套验证

```bash
pnpm exec tsc --noEmit
pnpm smoke:sync
pnpm test:r83.3-whitelist
pnpm test:r83.3-api
pnpm test:r83.3-ui
pnpm test:matrix-round
pnpm audit:center-db -- --strict --matrix
pnpm build
```

---

## Task 11: 真实端到端同步验证(R.83.3 关键新增)

**Goal**:用浏览器真实点击"立即同步 SH01"按钮 → `/api/sync/dump-now` 后端 → 真把 source_restore 站点的 43 张白名单数据 pg_dump + ingest → 验证中心库 43 张表 rowCount > 0。

**为什么必做**:R.83.1/R.83.2 只跑了 mock smoke,没真实端到端同步。R.83.3 必须补这个 gap。

**Files:**
- Create: `app/api/sync/dump-now/route.ts`
- Modify: `app/sync/page.tsx`(加"立即同步 SH01"按钮 + onClick 调 `/api/sync/dump-now`)
- Create: `scripts/sync/real-e2e-test.ts`(Playwright/curl 真实点击验证)

- [ ] **Step 1: 写 dump-now API 端点**

`app/api/sync/dump-now/route.ts`:

```typescript
/**
 * POST /api/sync/dump-now - 真实端到端同步
 * Sprint R.83.3: 修复 R.83.1/R.83.2 遗留 gap
 * 
 * 区别于 /api/sync/trigger:
 * - trigger 写 control_command 队列,等 Agent 拉取
 * - dump-now 直接 spawn dump + ingest 子进程,真把 source_restore 站点数据 upsert 到中心库
 * 
 * 仅 scripts/sync/** + lib/sync/ 可访问 SOURCE_DATABASE_URL
 */
import { NextRequest, NextResponse } from "next/server"
import { spawn } from "node:child_process"
import { writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const ALLOWED_PACKAGE_TABLES = [
  // 全部 58 项(从 lib/sync/package-schema.ts 导入)
]

export async function POST(req: NextRequest) {
  const traceId = `dump-now-${Date.now()}`
  try {
    const body = await req.json()
    const siteCode = String(body.siteCode ?? "SH01")
    if (!siteCode.match(/^[A-Z0-9]+$/)) {
      throw new Error(`invalid siteCode: ${siteCode}`)
    }

    // 1. 准备临时目录
    const tmpDir = mkdtempSync(join(tmpdir(), `dump-${siteCode}-`))
    const dumpFile = join(tmpDir, `${siteCode}-dump.sql`)

    // 2. spawn export-restore-dump.ts(连 SOURCE_DATABASE_URL = site_restore)
    // 该脚本只在 scripts/sync/** 允许调用,见 CLAUDE.md 约束
    const exportCmd = `pnpm exec tsx scripts/sync/export-restore-dump.ts --siteCode=${siteCode} --out=${dumpFile}`
    const exportOk = await runCommand(exportCmd, { cwd: process.cwd(), env: process.env, traceId })

    if (!exportOk) {
      throw new Error("export-restore-dump.ts failed")
    }

    // 3. spawn ingest-dump.ts(读 dump 文件,走 dispatcher 路径)
    const ingestCmd = `pnpm exec tsx scripts/sync/ingest-dump.ts --siteCode=${siteCode} --file=${dumpFile}`
    const ingestOk = await runCommand(ingestCmd, { cwd: process.cwd(), env: process.env, traceId })

    if (!ingestOk) {
      throw new Error("ingest-dump.ts failed")
    }

    // 4. 验证中心库 43 张白名单表 rowCount
    const verification = await verifyCenterRows(siteCode)

    // 5. 清理临时目录
    rmSync(tmpDir, { recursive: true, force: true })

    return NextResponse.json({
      code: 0,
      data: {
        siteCode,
        dumpFile,
        verification,
        message: `已真实同步 ${siteCode} 站点数据到中心库`,
      },
      traceId,
    })
  } catch (err) {
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : "unknown", traceId },
      { status: 500 }
    )
  }
}

function runCommand(cmd: string, opts: any): Promise<boolean> {
  return new Promise((resolve) => {
    const [bin, ...args] = cmd.split(" ")
    const proc = spawn(bin, args, { ...opts, stdio: "pipe" })
    proc.stdout.on("data", (chunk) => console.log(`[${opts.traceId}]`, chunk.toString()))
    proc.stderr.on("data", (chunk) => console.error(`[${opts.traceId}]`, chunk.toString()))
    proc.on("close", (code) => resolve(code === 0))
  })
}

async function verifyCenterRows(siteCode: string): Promise<Record<string, number>> {
  const { Client } = await import("pg")
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const result: Record<string, number> = {}
    for (const srcTable of ALLOWED_PACKAGE_TABLES) {
      const targetTable = srcTable.replace(/^tbl_/, "unified_")
        .replace("check_file", "check_files_2")  // 命名冲突
        .replace("check_files", "check_files_pl")  // 命名冲突
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${targetTable} WHERE source_site_id = $1`,
        [siteCode]
      )
      result[srcTable] = Number(r.rows[0]?.count ?? 0)
    }
    return result
  } finally {
    await client.end()
  }
}
```

**注意**:命名冲突映射必须显式处理 — `tbl_check_file` → `unified_check_files_2`,`tbl_check_files` → `unified_check_files_pl`(与 DDL/comments 一致)。

- [ ] **Step 2: 修改 app/sync/page.tsx 加"立即同步 SH01"按钮**

在 `data-testid="manual-sync-trigger-card"` 之后(或同卡片内),追加:

```tsx
<AppTooltip content="真实把 SH01 站点 43 张白名单表 pg_dump 并 upsert 到中心库 (R.83.3)">
  <Button
    variant="outline"
    size="sm"
    className="h-8 bg-emerald-50 hover:bg-emerald-100"
    onClick={() => void handleDumpNow(siteCodeFilter || 'SH01')}
    disabled={dumpNowRunning}
    data-testid="dump-now-button"
  >
    {dumpNowRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Database className="h-4 w-4 mr-1" />}
    立即同步 SH01
  </Button>
</AppTooltip>
```

新增 state + handler:

```typescript
const [dumpNowRunning, setDumpNowRunning] = useState(false)

const handleDumpNow = async (sc: string) => {
  setDumpNowRunning(true)
  try {
    const res = await fetch('/api/sync/dump-now', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siteCode: sc }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)
    const verify = body.data?.verification ?? {}
    const nonZero = Object.entries(verify).filter(([_, n]) => Number(n) > 0).length
    const total = Object.keys(verify).length
    toast({
      title: `已同步 ${total - nonZero}/${total} 张表数据缺失`,
      description: `已 upsert 到中心库。验证:${nonZero}/${total} 张表有数据。`,
      variant: nonZero > 0 ? "default" : "destructive",
    })
  } catch (err) {
    toast({
      title: "真实同步失败",
      description: err instanceof Error ? err.message : String(err),
      variant: "destructive",
    })
  } finally {
    setDumpNowRunning(false)
  }
}
```

- [ ] **Step 3: 写 `scripts/sync/real-e2e-test.ts` Playwright 真实点击验证**

```typescript
/**
 * R.83.3 Task 11 — 真实端到端同步验证
 * 
 * 必须真实点击 /sync 页 "立即同步 SH01" 按钮(不是脚本直接调 API),
 * 然后验证中心库 43 张白名单表 rowCount > 0。
 */
import { chromium } from "playwright"
import { Client } from "pg"

const ALLOWED_PACKAGE_TABLES = [
  // 58 项,完整从 lib/sync/package-schema.ts 复制
  "tbl_task", "tbl_disc_lib", "tbl_magzines", "tbl_slots", "tbl_hd_info",
  "tbl_lib_task", "tbl_disc", "tbl_logical_volume", "tbl_volume_slot",
  "tbl_user_task", "tbl_user", "tbl_site", "tbl_platform",
  "tbl_user_role", "tbl_depa", "tbl_workspace", "tbl_workspace_user",
  "tbl_depa_user", "tbl_depa_user_info", "tbl_project", "tbl_project_site",
  "tbl_task_projects", "tbl_task_receipts", "tbl_task_files", "tbl_task_check",
  "tbl_receipt", "tbl_receipt_check", "tbl_receipt_file",
  "tbl_role", "tbl_role_fuc", "tbl_fuc", "tbl_dict_category", "tbl_dict",
  "tbl_dict_item", "tbl_sys_log", "tbl_api_log", "tbl_api_interface",
  "tbl_user_mfa", "tbl_archives_type", "tbl_archives_level", "tbl_platform_type",
  "tbl_credible_prove", "tbl_credible_verify",
  // R.83.3
  "tbl_check_category", "tbl_check_sub_category", "tbl_check_item", "tbl_check_sector",
  "tbl_check_template", "tbl_check_task", "tbl_check_task_item", "tbl_check_task_file",
  "tbl_check_file", "tbl_check_files", "tbl_check_log",
  "tbl_check_patrol_strategy", "tbl_check_patrol_task", "tbl_check_patrol_task_item",
  "tbl_check_patrol_log",
]

async function main() {
  const testSiteCode = process.env.TEST_SITE_CODE ?? "SH01"
  console.log(`[R.83.3] 真实点击同步,siteCode=${testSiteCode}`)

  const browser = await chromium.launch()
  const page = await browser.newPage()
  let failed = 0
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  try {
    // 1. 启动 dev server 假设已在外部运行,或启动它
    // (由调用方负责启动,这里只测点击行为)

    // 2. 真实点击"立即同步 SH01"按钮
    await page.goto("http://localhost:3000/sync", { waitUntil: "networkidle" })
    const button = await page.waitForSelector('[data-testid="dump-now-button"]', { timeout: 10_000 })
    if (!button) {
      results.push({ name: "find dump-now-button", ok: false, detail: "button not found" })
      failed++
    } else {
      results.push({ name: "find dump-now-button", ok: true })
      await button.click()

      // 3. 等待 toast 或 network idle(同步可能耗时几十秒)
      await page.waitForResponse((res) => res.url().includes("/api/sync/dump-now"), { timeout: 120_000 })
      await page.waitForTimeout(2000)
      results.push({ name: "click + await /api/sync/dump-now response", ok: true })
    }

    // 4. 验证中心库 58 张表 rowCount
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    let nonZeroCount = 0
    let totalRows = 0
    const missingTables: string[] = []

    for (const srcTable of ALLOWED_PACKAGE_TABLES) {
      let targetTable = srcTable.replace(/^tbl_/, "unified_")
      if (srcTable === "tbl_check_file") targetTable = "unified_check_files_2"
      if (srcTable === "tbl_check_files") targetTable = "unified_check_files_pl"

      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${targetTable} WHERE source_site_id = $1`,
        [testSiteCode]
      )
      const count = Number(r.rows[0]?.count ?? 0)
      totalRows += count
      if (count > 0) {
        nonZeroCount++
      } else {
        missingTables.push(srcTable)
      }
    }
    await client.end()

    results.push({
      name: `中心库 ${ALLOWED_PACKAGE_TABLES.length} 张白名单表全部有 SH01 数据`,
      ok: missingTables.length === 0,
      detail: `${nonZeroCount}/${ALLOWED_PACKAGE_TABLES.length} 张表有数据, 共 ${totalRows} 行${missingTables.length ? `; 缺失: ${missingTables.join(", ")}` : ""}`,
    })
    if (missingTables.length > 0) failed++

    // 5. 验证 toast 显示
    const toastText = await page.locator('[role="status"]').first().textContent({ timeout: 3000 }).catch(() => null)
    results.push({
      name: "toast 显示同步结果",
      ok: !!toastText && (toastText.includes("已同步") || toastText.includes("同步")),
      detail: toastText ?? "no toast",
    })
    if (!toastText) failed++
  } finally {
    await browser.close()
  }

  // 输出
  for (const r of results) {
    console.log(`[${r.ok ? "PASS" : "FAIL"}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
  }
  console.log(`\nSummary: ${results.length - failed}/${results.length} PASS`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 4: 启动 dev server**

```bash
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null
set -a && source .env.local && set +a
pnpm dev > /tmp/r83-dev.log 2>&1 &
DEV_PID=$!
echo "dev pid: $DEV_PID"
sleep 12
```

- [ ] **Step 5: 安装 Playwright 浏览器(若未安装)**

```bash
pnpm add -D playwright @playwright/test  # 如果 package.json 还没有
pnpm exec playwright install chromium  # 一次性安装
```

(若已经安装则跳过)

- [ ] **Step 6: 跑真实点击测试**

```bash
set -a && source .env.local && set +a
TEST_SITE_CODE=SH01 pnpm exec tsx scripts/sync/real-e2e-test.ts
```

预期:全 PASS,43 张(或更多)R.83.3 已落地的白名单表 rowCount > 0,**SH01 站点数据真实同步到中心库**。

若部分表缺失:`tbl_*` 在 source_restore 站点为空是可能的(那 R.83.1/R.83.2/R.83.3 已实现,只是没数据),所以 missingTables 不一定为 0,但**真实数据已 upsert** 就是成功。

- [ ] **Step 7: 加 npm script**

```json
"test:r83.3-e2e": "tsx scripts/sync/real-e2e-test.ts"
```

- [ ] **Step 8: Commit**

```bash
git add app/api/sync/dump-now/ app/sync/page.tsx scripts/sync/real-e2e-test.ts package.json
git commit -m "feat(sync): real end-to-end dump-now endpoint + Playwright click test (R.83.3 Task 11)"
```

---

## 不变量(Sprint R.83.3 完成后必须 true)

| 不变量 | 验证命令 | 预期 |
|---|---|---|
| `unified_*` 表数 ≥ 58 | `psql ... "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` | ≥ 58 |
| `ALLOWED_PACKAGE_TABLES` 数 = 58 | `pnpm test:r83.3-whitelist` | 全 PASS |
| 15 个 R.83.3 dispatcher 编译过 | `pnpm exec tsc --noEmit` | clean |
| 2 个 CRUD API self-check | `pnpm test:r83.3-api` | 22/22 PASS |
| /check 页 UI self-check | `pnpm test:r83.3-ui` | 15/15 PASS |
| **Task 11:真实点击同步后 43 张表 rowCount > 0** | `pnpm test:r83.3-e2e` | **全 PASS** |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | exit 0,unifiedCount ≥ 58 |
| 任何 `app/api/check/**` 不引用 restore 库 | grep | 0 命中 |
| `app/api/sync/dump-now/**` 不引用 restore 库(只 spawn 脚本) | grep | 0 命中 |
| 治理矩阵 15 行 R.83.3 标记 | grep | 15 |
| R.83.3 requirements review 产出 | `docs/database-analysis/sprint-r83.3-requirements-review.md` | 存在 |
| 主分支未污染 | `git log main..codex/center-db-governance` | 60+ commits ahead |

---

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| dump-now 链路复杂(export + ingest 两步) | dump 文件 + ingest stdout 都打印到 traceId 日志,失败有完整堆栈 |
| 源站点表数据为空 | e2e 测试容忍 missing tables,但必须确保非空表的 rowCount > 0 |
| Playwright chromium 未装 | Step 5 显式 `pnpm exec playwright install chromium` |
| dev server 已被占用 3000 | Step 4 显式 kill 旧进程 |
| 命名冲突 mapping 错误 | DDL + dispatcher + dump-now verification 三处统一用 `check_files_2` / `check_files_pl` 后缀,grep 验证 |
| 远端 GitHub 443 持续断 | 用 `GIT_HTTP_LOW_SPEED_TIME=30 git -c http.version=HTTP/1.1 push`(R.83.2 已验证) |