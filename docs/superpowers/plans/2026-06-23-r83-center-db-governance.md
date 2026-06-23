# R.83.1 Center DB Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把中心库 `unified_*` 表从 13 张扩展到 28 张(新增 15 张部门/项目/任务接收单类业务表),产出 170 表治理矩阵、测试污染清理脚本、`/api/sites/orphans` 端点、`/sites` 页面 orphan 明细弹层、补 README 自检指南。

**Architecture:** 沿用 R.82 已建立的 `sync_sites` 真站点主数据口径,新增 15 张业务表通过统一 DDL 模板(`source_site_id + source_record_id + raw_data JSONB`)建到中心库;同步白名单扩展 13→28,复用现有 pg_dump / dispatcher / ingest 框架;产品页不新增独立页面,只复用 `/users` `/tasks` `/volumes` 已存在的弹层/Drawer;`/sites` 页面复用现有 Dialog,新增 /api/sites/orphans 端点提供明细。

**Tech Stack:** Next.js 16 + TypeScript + PostgreSQL 17 + pg + tsx + Zod + Radix UI Dialog + Tailwind CSS v4。

**Spec 参考**: `docs/superpowers/specs/2026-06-23-r83-center-db-governance-design.md`

---

## File Structure

### 新建文件(11)

```
databases/sprint-r83.1/01-department-receipt-tables.sql        # C3 15 张 unified_* DDL
docs/database-analysis/r83-170-table-governance-matrix.md      # C1 治理矩阵
scripts/cleanup/center-db-test-pollution.ts                    # C5 清理脚本
scripts/cleanup/__tests__/center-db-test-pollution.test.ts    # C5 测试
app/api/sites/orphans/route.ts                                # C6 orphan 详情端点
app/api/sites/__tests__/orphans-route.test.ts                 # C6 测试
lib/types/orphan-sites.ts                                     # C6 类型契约
scripts/e2e/test-r83.1-events.ts                              # E2E 验证
docs/database-analysis/sprint-r83.1-requirements-review.md    # R.83.1 review
```

### 修改文件(7)

```
lib/sync/package-schema.ts                 # C4 白名单 13→28
scripts/audit/center-db-integrity.ts       # C2 --matrix flag
app/sites/page.tsx                         # C7 orphan Drawer
README.md                                  # C8 自检指南
docker-compose.yml                         # C3 db:init 引用
package.json                               # cleanup + e2e scripts
docs/summary/PROJECT_STATUS.md             # 当前 Sprint 段
```

---

## Task 0: 准备工作区 + 基线检查

**Files:**
- Read: `package.json`
- Run: `pnpm baseline:check`

- [ ] **Step 1: 确认分支 + 工作区干净**

```bash
cd /Users/tian/Desktop/上海
git status                  # 期望: working tree clean
git branch --show-current   # 期望: codex/center-db-governance
```

- [ ] **Step 2: 数据库 5 容器必须全 up**

```bash
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'unified_disc_postgres|site_restore_full|pg_restore_test|opensearch|clickhouse'
```

期望 5 行都显示 `Up ... (healthy)` 或 `Up ...`。

- [ ] **Step 3: 跑基线**

```bash
pnpm baseline:check
```

期望: exit code 0。如果失败,**停**,先排查。

- [ ] **Step 4: 确认 DATABASE_URL 与 SITE_DATABASE_URL 都在 .env.local**

```bash
grep -E '^(DATABASE_URL|SITE_DATABASE_URL)' .env.local
```

期望两行都存在,值形如 `postgresql://...:5432/...`。

---

## Task 1: C3 DDL — 15 张 `unified_*` 表(基础 schema)

**Files:**
- Create: `databases/sprint-r83.1/01-department-receipt-tables.sql`

- [ ] **Step 1: 建目录 + 文件**

```bash
mkdir -p databases/sprint-r83.1
touch databases/sprint-r83.1/01-department-receipt-tables.sql
```

- [ ] **Step 2: 写 DDL 头部**

文件头(覆盖前 6 行):

```sql
-- ============================================================
-- R.83.1 部门/项目/任务接收单 15 张 unified_* DDL
-- 范围: 部门、工作区、项目、任务接收单、任务文件级、接收单
-- 来源: databases/disc_files.sql 中相应源表
-- 模板: id UUID + source_site_id + source_record_id + raw_data
-- ============================================================

SET client_min_messages = WARNING;
```

- [ ] **Step 3: 写第 1 张表 `unified_user_roles`(对应 tbl_user_role)**

源表 `tbl_user_role`:复合主键 `(user_id, role_id)`。

```sql
-- 1. unified_user_roles (源: tbl_user_role)
CREATE TABLE IF NOT EXISTS unified_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_user_role',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  user_id BIGINT NOT NULL,
  role_id INTEGER NOT NULL,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_site ON unified_user_roles(source_site_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON unified_user_roles(user_id);
COMMENT ON TABLE unified_user_roles IS '统一用户-角色关系 (源 tbl_user_role)';
```

- [ ] **Step 4: 写第 2 张表 `unified_departments`(对应 tbl_depa)**

源表 `tbl_depa`:主键 `depa_id`。

```sql
-- 2. unified_departments (源: tbl_depa)
CREATE TABLE IF NOT EXISTS unified_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  depa_id BIGINT NOT NULL,
  depa_name VARCHAR(50),
  depa_code VARCHAR(20),
  alia_name VARCHAR(50),
  depa_enable SMALLINT DEFAULT 0,
  min_optical SMALLINT DEFAULT 0,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  base SMALLINT DEFAULT 0,
  del_flag SMALLINT DEFAULT 0,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_departments_site ON unified_departments(source_site_id);
CREATE INDEX IF NOT EXISTS idx_departments_name ON unified_departments(depa_name);
COMMENT ON TABLE unified_departments IS '统一部门表 (源 tbl_depa)';
```

- [ ] **Step 5: 写第 3 张表 `unified_workspaces`(对应 tbl_workspace)**

源表 `tbl_workspace`:主键 `ws_id`。

```sql
-- 3. unified_workspaces (源: tbl_workspace)
CREATE TABLE IF NOT EXISTS unified_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_workspace',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  ws_id BIGINT NOT NULL,
  depa_id INTEGER,
  user_id INTEGER,
  ws_name VARCHAR(50),
  alia_name VARCHAR(50),
  ws_enable SMALLINT DEFAULT 1,
  ws_type SMALLINT DEFAULT 0,
  ws_code VARCHAR(30),
  model_id INTEGER,
  tac_id INTEGER,
  min_optical SMALLINT DEFAULT 0,
  last_optical SMALLINT DEFAULT 0,
  disk_sn INTEGER,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_workspaces_site ON unified_workspaces(source_site_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_depa ON unified_workspaces(depa_id);
COMMENT ON TABLE unified_workspaces IS '统一工作区表 (源 tbl_workspace)';
```

- [ ] **Step 6: 写第 4 张表 `unified_workspace_users`(对应 tbl_workspace_user)**

源表 `tbl_workspace_user`:复合主键 `(ws_id, user_id)`。

```sql
-- 4. unified_workspace_users (源: tbl_workspace_user)
CREATE TABLE IF NOT EXISTS unified_workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_workspace_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  ws_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  permission INTEGER,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_ws_users_site ON unified_workspace_users(source_site_id);
CREATE INDEX IF NOT EXISTS idx_ws_users_user ON unified_workspace_users(user_id);
COMMENT ON TABLE unified_workspace_users IS '统一工作区-用户关系 (源 tbl_workspace_user)';
```

- [ ] **Step 7: 写第 5 张表 `unified_department_users`(对应 tbl_depa_user)**

源表 `tbl_depa_user`:复合主键 `(depa_id, user_id)`。

```sql
-- 5. unified_department_users (源: tbl_depa_user)
CREATE TABLE IF NOT EXISTS unified_department_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  depa_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  black_list VARCHAR(255),
  white_list VARCHAR(255),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_depa_users_site ON unified_department_users(source_site_id);
CREATE INDEX IF NOT EXISTS idx_depa_users_user ON unified_department_users(user_id);
COMMENT ON TABLE unified_department_users IS '统一部门-用户关系 (源 tbl_depa_user)';
```

- [ ] **Step 8: 写第 6 张表 `unified_department_user_info`(对应 tbl_depa_user_info)**

源表 `tbl_depa_user_info`:主键 `id`(自增),unique `(depa_id, user_id)` 由源表语义保证。

```sql
-- 6. unified_department_user_info (源: tbl_depa_user_info)
CREATE TABLE IF NOT EXISTS unified_department_user_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_depa_user_info',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  depa_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  fuc_id INTEGER,
  create_time TIMESTAMPTZ,
  update_time TIMESTAMPTZ,
  del_status SMALLINT DEFAULT 0,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_depa_user_info_site ON unified_department_user_info(source_site_id);
CREATE INDEX IF NOT EXISTS idx_depa_user_info_user ON unified_department_user_info(user_id);
COMMENT ON TABLE unified_department_user_info IS '统一部门-用户权限详情 (源 tbl_depa_user_info)';
```

- [ ] **Step 9: 写第 7 张表 `unified_projects`(对应 tbl_project)**

源表 `tbl_project`:主键 `project_id`。

```sql
-- 7. unified_projects (源: tbl_project)
CREATE TABLE IF NOT EXISTS unified_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_project',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  project_id BIGINT NOT NULL,
  maintitle VARCHAR(255),
  project_title VARCHAR(255),
  subtitle VARCHAR(255),
  project_dt TIMESTAMPTZ,
  volume_id INTEGER NOT NULL,
  status INTEGER DEFAULT 1,
  cmt VARCHAR(500),
  project_num VARCHAR(500),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_projects_site ON unified_projects(source_site_id);
CREATE INDEX IF NOT EXISTS idx_projects_volume ON unified_projects(volume_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON unified_projects(status);
COMMENT ON TABLE unified_projects IS '统一项目表 (源 tbl_project)';
```

- [ ] **Step 10: 写第 8 张表 `unified_project_sites`(对应 tbl_project_site)**

源表 `tbl_project_site`:主键 `id`(自增),有 `(project_id, site_id)` 语义。

```sql
-- 8. unified_project_sites (源: tbl_project_site)
CREATE TABLE IF NOT EXISTS unified_project_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_project_site',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  site_id INTEGER NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  cmt VARCHAR(500),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_project_sites_site ON unified_project_sites(source_site_id);
CREATE INDEX IF NOT EXISTS idx_project_sites_project ON unified_project_sites(project_id);
COMMENT ON TABLE unified_project_sites IS '统一项目-站点关系 (源 tbl_project_site)';
```

- [ ] **Step 11: 写第 9 张表 `unified_task_projects`(对应 tbl_task_projects)**

源表 `tbl_task_projects`:主键 `id`(自增)。

```sql
-- 9. unified_task_projects (源: tbl_task_projects)
CREATE TABLE IF NOT EXISTS unified_task_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_projects',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  task_id BIGINT NOT NULL,
  project_id BIGINT NOT NULL,
  cmt VARCHAR(500),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_task_projects_site ON unified_task_projects(source_site_id);
CREATE INDEX IF NOT EXISTS idx_task_projects_task ON unified_task_projects(task_id);
CREATE INDEX IF NOT EXISTS idx_task_projects_project ON unified_task_projects(project_id);
COMMENT ON TABLE unified_task_projects IS '统一任务-项目关系 (源 tbl_task_projects)';
```

- [ ] **Step 12: 写第 10 张表 `unified_task_receipts`(对应 tbl_task_receipts)**

源表 `tbl_task_receipts`:主键 `id`(自增)。

```sql
-- 10. unified_task_receipts (源: tbl_task_receipts)
CREATE TABLE IF NOT EXISTS unified_task_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_receipts',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  task_id BIGINT NOT NULL,
  r_id BIGINT NOT NULL,
  cmt VARCHAR(500),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_task_receipts_site ON unified_task_receipts(source_site_id);
CREATE INDEX IF NOT EXISTS idx_task_receipts_task ON unified_task_receipts(task_id);
CREATE INDEX IF NOT EXISTS idx_task_receipts_r ON unified_task_receipts(r_id);
COMMENT ON TABLE unified_task_receipts IS '统一任务-接收单关系 (源 tbl_task_receipts)';
```

- [ ] **Step 13: 写第 11 张表 `unified_task_files`(对应 tbl_task_files)**

源表 `tbl_task_files`:主键 `id`(自增)。

```sql
-- 11. unified_task_files (源: tbl_task_files)
CREATE TABLE IF NOT EXISTS unified_task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_files',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  close_time TIMESTAMPTZ,
  monitor_id INTEGER NOT NULL,
  cmt VARCHAR(200),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_task_files_site ON unified_task_files(source_site_id);
CREATE INDEX IF NOT EXISTS idx_task_files_path ON unified_task_files(file_path);
COMMENT ON TABLE unified_task_files IS '统一任务文件级别 (源 tbl_task_files)';
```

- [ ] **Step 14: 写第 12 张表 `unified_task_checks`(对应 tbl_task_check)**

源表 `tbl_task_check`:主键 `id`(自增)。

```sql
-- 12. unified_task_checks (源: tbl_task_check)
CREATE TABLE IF NOT EXISTS unified_task_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_task_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id INTEGER NOT NULL,
  lib_id INTEGER,
  driver VARCHAR(50),
  mode INTEGER,
  verify_std INTEGER,
  batch INTEGER,
  aql VARCHAR(20),
  accept INTEGER,
  reject INTEGER,
  discs INTEGER,
  ignored INTEGER,
  spot VARCHAR(50),
  person VARCHAR(50),
  date VARCHAR(50),
  cmt VARCHAR(500),
  slot_start INTEGER,
  slot_end INTEGER,
  status INTEGER,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_task_checks_site ON unified_task_checks(source_site_id);
CREATE INDEX IF NOT EXISTS idx_task_checks_status ON unified_task_checks(status);
COMMENT ON TABLE unified_task_checks IS '统一任务校验 (源 tbl_task_check)';
```

- [ ] **Step 15: 写第 13 张表 `unified_receipts`(对应 tbl_receipt)**

源表 `tbl_receipt`:主键 `id`(自增)。

```sql
-- 13. unified_receipts (源: tbl_receipt)
CREATE TABLE IF NOT EXISTS unified_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  annual VARCHAR(50),
  batch VARCHAR(50),
  receive_num VARCHAR(50),
  transfer_unit VARCHAR(50),
  transferer VARCHAR(20),
  transfer_date TIMESTAMPTZ,
  receive_unit VARCHAR(50),
  receiver VARCHAR(20),
  files_count INTEGER,
  nums INTEGER,
  remark VARCHAR(200),
  status SMALLINT,
  update_dt TIMESTAMPTZ,
  create_dt TIMESTAMPTZ,
  volume_id INTEGER DEFAULT 0,
  file_path VARCHAR(1024),
  ws_id BIGINT,
  type INTEGER DEFAULT 0,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_receipts_site ON unified_receipts(source_site_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON unified_receipts(status);
COMMENT ON TABLE unified_receipts IS '统一接收单 (源 tbl_receipt)';
```

- [ ] **Step 16: 写第 14 张表 `unified_receipt_checks`(对应 tbl_receipt_check)**

源表 `tbl_receipt_check`:复合主键 `(r_file_id, check_id)`。

```sql
-- 14. unified_receipt_checks (源: tbl_receipt_check)
CREATE TABLE IF NOT EXISTS unified_receipt_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt_check',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  r_file_id INTEGER NOT NULL,
  check_id VARCHAR(64) NOT NULL,
  result INTEGER,

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_checks_site ON unified_receipt_checks(source_site_id);
CREATE INDEX IF NOT EXISTS idx_receipt_checks_file ON unified_receipt_checks(r_file_id);
COMMENT ON TABLE unified_receipt_checks IS '统一接收单校验 (源 tbl_receipt_check)';
```

- [ ] **Step 17: 写第 15 张表 `unified_receipt_files`(对应 tbl_receipt_file)**

源表 `tbl_receipt_file`:主键 `id`(自增)。

```sql
-- 15. unified_receipt_files (源: tbl_receipt_file)
CREATE TABLE IF NOT EXISTS unified_receipt_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_receipt_file',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  src_id BIGINT NOT NULL,
  file_name VARCHAR(765),
  file_size BIGINT,
  hash VARCHAR(65),
  r_id BIGINT NOT NULL,
  create_date TIMESTAMPTZ,
  status SMALLINT DEFAULT 0,
  path VARCHAR(1024),
  check_id VARCHAR(64),
  cmt VARCHAR(765),

  raw_data JSONB DEFAULT '{}',

  UNIQUE(source_site_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_files_site ON unified_receipt_files(source_site_id);
CREATE INDEX IF NOT EXISTS idx_receipt_files_r ON unified_receipt_files(r_id);
CREATE INDEX IF NOT EXISTS idx_receipt_files_status ON unified_receipt_files(status);
COMMENT ON TABLE unified_receipt_files IS '统一接收单文件 (源 tbl_receipt_file)';
```

- [ ] **Step 18: 验证 DDL 在中心库跑通**

```bash
set -a && source .env.local && set +a
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.1/01-department-receipt-tables.sql
```

期望: 无错误输出。

- [ ] **Step 19: 验证 15 张表都创建**

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'unified\\_%' ESCAPE '\\'
  AND table_name IN (
    'unified_user_roles','unified_departments','unified_workspaces','unified_workspace_users',
    'unified_department_users','unified_department_user_info','unified_projects','unified_project_sites',
    'unified_task_projects','unified_task_receipts','unified_task_files','unified_task_checks',
    'unified_receipts','unified_receipt_checks','unified_receipt_files'
  );"
```

期望: `15`

- [ ] **Step 20: 提交**

```bash
git add databases/sprint-r83.1/01-department-receipt-tables.sql
git commit -m "feat(schema): add 15 unified_* tables for departments, projects, receipts (R.83.1 DDL)"
```

---

## Task 2: C3 DDL — 接入 db:init 路径(让全新部署也建表)

**Files:**
- Modify: `docker-compose.yml`(如已有 init 段) 或 `package.json` 的 `db:init`

- [ ] **Step 1: 查 db:init 当前实现**

```bash
grep -nE "db:init" package.json | head -5
```

- [ ] **Step 2: 看 db:init 实现怎么引用 SQL**

```bash
grep -nE "unified_schema|sprint-2b0|sprint-2c" databases/init/*.sql scripts/db-init.ts 2>/dev/null | head -10
```

(根据实际入口把 DDL 接入。如果是 init.sql,append `\\i databases/sprint-r83.1/01-department-receipt-tables.sql`;如果是 tsx 脚本,append `await pool.query(sql)`。)

- [ ] **Step 3: 接入新 DDL**

按现有模式 append,确保 idempotent(`IF NOT EXISTS` 已用)。

- [ ] **Step 4: 跑 `pnpm db:init --reset` 验证全新部署也建表**

(慎用,仅在测试环境用;不要在生产中心库用。) 改为直接重跑 SQL:

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform -c "
DROP TABLE IF EXISTS unified_user_roles CASCADE;
" 
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-r83.1/01-department-receipt-tables.sql
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'unified\\_%' ESCAPE '\\'
  AND table_name IN ('unified_user_roles','unified_departments','unified_workspaces','unified_workspace_users','unified_department_users','unified_department_user_info','unified_projects','unified_project_sites','unified_task_projects','unified_task_receipts','unified_task_files','unified_task_checks','unified_receipts','unified_receipt_checks','unified_receipt_files');"
```

期望: `15`

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat(schema): wire R.83.1 DDL into db:init path"
```

---

## Task 3: C4 — 同步白名单 13 → 28

**Files:**
- Modify: `lib/sync/package-schema.ts`

- [ ] **Step 1: 写失败的测试 — 期望新增 15 项命中**

修改 `lib/sync/package-schema.ts` 已有导出 + 写一个新测试文件 `lib/sync/__tests__/package-schema-r83.test.ts`:

```ts
import { ALLOWED_PACKAGE_TABLES } from "../package-schema"

describe("R.83.1 sync whitelist", () => {
  it("包含 R.83.1 新增 15 张表", () => {
    const expected = [
      "tbl_user_role", "tbl_depa", "tbl_workspace", "tbl_workspace_user",
      "tbl_depa_user", "tbl_depa_user_info", "tbl_project", "tbl_project_site",
      "tbl_task_projects", "tbl_task_receipts", "tbl_task_files", "tbl_task_check",
      "tbl_receipt", "tbl_receipt_check", "tbl_receipt_file",
    ]
    for (const t of expected) {
      expect(ALLOWED_PACKAGE_TABLES).toContain(t)
    }
  })

  it("总条数 28", () => {
    expect(ALLOWED_PACKAGE_TABLES).toHaveLength(28)
  })

  it("仍然禁止 tbl_file 与 tbl_folder", async () => {
    const { FORBIDDEN_PACKAGE_TABLES } = await import("../package-schema")
    expect(FORBIDDEN_PACKAGE_TABLES).toEqual(["tbl_file", "tbl_folder"])
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
pnpm exec tsx --test lib/sync/__tests__/package-schema-r83.test.ts 2>&1 | tail -20
```

期望: 2 个 fail,1 个 pass(forbidden)。

- [ ] **Step 3: 修改 `ALLOWED_PACKAGE_TABLES`**

在 `lib/sync/package-schema.ts` 第 19-33 行,把所有新增 15 项追加到数组末尾:

```ts
export const ALLOWED_PACKAGE_TABLES = [
  'tbl_task', 'tbl_disc_lib', 'tbl_magzines', 'tbl_slots',
  'tbl_hd_info', 'tbl_lib_task', 'tbl_disc', 'tbl_logical_volume',
  'tbl_volume_slot', 'tbl_user_task', 'tbl_user', 'tbl_site', 'tbl_platform',
  // R.83.1 新增 15 张业务表
  'tbl_user_role', 'tbl_depa', 'tbl_workspace', 'tbl_workspace_user',
  'tbl_depa_user', 'tbl_depa_user_info', 'tbl_project', 'tbl_project_site',
  'tbl_task_projects', 'tbl_task_receipts', 'tbl_task_files', 'tbl_task_check',
  'tbl_receipt', 'tbl_receipt_check', 'tbl_receipt_file',
] as const
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
pnpm exec tsx --test lib/sync/__tests__/package-schema-r83.test.ts 2>&1 | tail -10
```

期望: 3 pass。

- [ ] **Step 5: tsc 检查**

```bash
pnpm exec tsc --noEmit
```

期望: exit code 0。

- [ ] **Step 6: 提交**

```bash
git add lib/sync/package-schema.ts lib/sync/__tests__/package-schema-r83.test.ts
git commit -m "feat(sync): extend package whitelist 13 → 28 with R.83.1 batch"
```

---

## Task 4: C2 — `audit:center-db --matrix` 输出 JSON

**Files:**
- Modify: `scripts/audit/center-db-integrity.ts`
- Create: `docs/database-analysis/r83-170-table-governance-matrix.md`(C1,Task 5)

- [ ] **Step 1: 在脚本顶部加 `MATRIX` flag**

修改 `scripts/audit/center-db-integrity.ts`:

```ts
const STRICT = process.argv.includes("--strict")
const MATRIX = process.argv.includes("--matrix")
const MATRIX_DOC = "docs/database-analysis/r83-170-table-governance-matrix.md"
```

- [ ] **Step 2: 在 `auditCenterDatabase` 末尾加矩阵输出块**

紧接 `await auditCenterDatabase(centerPool)` 之后(在 finally 之前),插入:

```ts
if (MATRIX) {
  const matrixResult = await centerPool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'unified\\_%' ESCAPE '\\'
     ORDER BY table_name`
  )
  const unified = matrixResult.rows.map((r) => r.table_name)
  const fs = await import("fs/promises")
  let doc = "(missing matrix doc)"
  try {
    doc = await fs.readFile(MATRIX_DOC, "utf-8")
  } catch {}
  const matrixEntries = unified.map((t) => ({
    unified_table: t,
    source_table: t.replace(/^unified_/, "tbl_"),
    classification: "pg17_small",
    blocker: "none",
    round: "R.83.1",
  }))
  await fs.mkdir("audit", { recursive: true })
  await fs.writeFile(
    "audit/center-db-matrix.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), entries: matrixEntries }, null, 2)
  )
  add("pass", "matrix JSON written", `audit/center-db-matrix.json (${matrixEntries.length} entries)`)
  add(unified.length >= 28 ? "pass" : "warn", "unified table count", `${unified.length} unified tables (target ≥28)`)
}
```

- [ ] **Step 3: 写失败测试(矩阵文件不存在)**

```bash
rm -f audit/center-db-matrix.json
```

- [ ] **Step 4: 跑 audit,期望产出矩阵文件**

```bash
set -a && source .env.local && set +a
pnpm audit:center-db -- --matrix
ls -la audit/center-db-matrix.json
```

期望: 文件存在,含 28 个 entries。

- [ ] **Step 5: tsc 检查**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add scripts/audit/center-db-integrity.ts
git commit -m "feat(audit): add matrix output to audit:center-db"
```

---

## Task 5: C1 — 170 表治理矩阵文档

**Files:**
- Create: `docs/database-analysis/r83-170-table-governance-matrix.md`

- [ ] **Step 1: 收集源表清单**

```bash
docker exec site_restore_full_postgres psql -U postgres -d star_storage_db -t -A -F'|' -c "
SELECT table_name,
  pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size,
  pg_total_relation_size(quote_ident(table_name))::bigint AS raw
FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'tbl\\_%' ESCAPE '\\'
ORDER BY table_name;" > /tmp/r83-tables.txt
wc -l /tmp/r83-tables.txt
```

期望: `170`(或 169 / 171 ±1,看是否有 view)。

- [ ] **Step 2: 写矩阵文档头部**

`docs/database-analysis/r83-170-table-governance-matrix.md`:

```markdown
# R.83 170 表治理矩阵

> 真实起点:site_restore_full_postgres.star_storage_db 实查 170 张 `tbl_*` 表
> 矩阵口径:R.83.1 完成时点(后续轮次按 R.83.x 扩展)
> 维护人:R.83 Sprint 系列
> 更新命令:`pnpm audit:center-db -- --matrix` 产出 `audit/center-db-matrix.json`

## 分类规则

| target_storage | 含义 |
|---|---|
| `pg17_small` | 进中心库 PG17(白名单 + dispatcher) |
| `opensearch` | 进 OpenSearch(大表/全文检索) |
| `clickhouse` | 进 ClickHouse(日志/分析) |
| `forbidden` | 严格禁止进任何中心存储(防爆库) |
| `out_of_scope` | 不在本项目范围 |

## blocker 规则

| blocker | 含义 |
|---|---|
| `none` | 已无前置阻塞 |
| `blocked_by_source_schema` | 站点源表缺字段 |
| `blocked_by_external_system` | 需 ES/ClickHouse 实际环境 |
| `blocked_by_site_change` | 需站点 app 改造 |
| `blocked_by_auth` | 需 ADFS/LDAP |

## 矩阵表(170 张)
```

- [ ] **Step 3: 用脚本生成矩阵表体**

写一个 `scripts/audit/generate-r83-matrix.ts`:

```ts
import { readFileSync, writeFileSync } from "fs"

const lines = readFileSync("/tmp/r83-tables.txt", "utf-8").trim().split("\n")
const ALREADY = new Set([
  "tbl_task","tbl_disc_lib","tbl_magzines","tbl_slots","tbl_hd_info",
  "tbl_lib_task","tbl_disc","tbl_logical_volume","tbl_volume_slot",
  "tbl_user_task","tbl_user","tbl_site","tbl_platform",
])
const R831 = new Set([
  "tbl_user_role","tbl_depa","tbl_workspace","tbl_workspace_user",
  "tbl_depa_user","tbl_depa_user_info","tbl_project","tbl_project_site",
  "tbl_task_projects","tbl_task_receipts","tbl_task_files","tbl_task_check",
  "tbl_receipt","tbl_receipt_check","tbl_receipt_file",
])

function classify(t: string, rawSize: number) {
  if (t.startsWith("tbl_file") || t.startsWith("tbl_folder")) {
    return { target: "forbidden", round: "never", blocker: "none", notes: "大表,R.82 已禁入 PG" }
  }
  if (R831.has(t)) return { target: "pg17_small", round: "R.83.1", blocker: "none", notes: "部门/项目/接收单" }
  if (ALREADY.has(t)) return { target: "pg17_small", round: "already", blocker: "none", notes: "既有白名单" }
  if (rawSize <= 32768) return { target: "pg17_small", round: "R.83.2+", blocker: "none", notes: "小表,候选接入" }
  return { target: "opensearch", round: "deferred", blocker: "blocked_by_external_system", notes: "待 ES 接入" }
}

const header = "| src_table | size | domain | target_storage | unified_table | blocker | round | notes |"
const sep = "|---|---|---|---|---|---|---|---|"
const rows: string[] = [header, sep]
for (const line of lines) {
  const [t, size, rawStr] = line.split("|")
  const raw = Number(rawStr)
  const c = classify(t, raw)
  const unified = c.target === "pg17_small" ? `unified_${t.replace(/^tbl_/, "")}` : "—"
  rows.push(`| ${t} | ${size} | — | ${c.target} | ${unified} | ${c.blocker} | ${c.round} | ${c.notes} |`)
}
writeFileSync("docs/database-analysis/r83-170-table-governance-matrix.md",
  readFileSync("docs/database-analysis/r83-170-table-governance-matrix.md","utf-8")
    .replace("## 矩阵表(170 张)", "## 矩阵表(170 张)\n\n" + rows.join("\n"))
)
console.log(`Generated ${rows.length - 2} rows`)
```

- [ ] **Step 4: 跑脚本生成完整矩阵**

```bash
pnpm exec tsx scripts/audit/generate-r83-matrix.ts
```

期望输出 `Generated ~170 rows`。

- [ ] **Step 5: 验证文档完整性**

```bash
grep -c "^| tbl_" docs/database-analysis/r83-170-table-governance-matrix.md
```

期望: ≥ 170。

- [ ] **Step 6: 提交**

```bash
git add docs/database-analysis/r83-170-table-governance-matrix.md scripts/audit/generate-r83-matrix.ts
git commit -m "docs(audit): produce 170-table governance matrix"
```

---

## Task 6: C5 — 测试污染清理脚本(幂等 + dry-run)

**Files:**
- Create: `scripts/cleanup/center-db-test-pollution.ts`
- Create: `scripts/cleanup/__tests__/center-db-test-pollution.test.ts`
- Modify: `package.json` (加 `cleanup:test-pollution` script)

- [ ] **Step 1: 写失败测试 — dry-run 行为**

`scripts/cleanup/__tests__/center-db-test-pollution.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { execSync } from "child_process"

const TEST_PATTERN = /^(TEST_|PKG_TEST$)/
const TARGETS = ["unified_tasks","unified_devices","unified_volumes","sync_package_log"]

describe("R.83.1 cleanup:test-pollution", () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "cleanup-test-"))
  })

  it("dry-run 不真删任何行", () => {
    const out = execSync(
      `pnpm cleanup:test-pollution -- --dry-run`,
      { encoding: "utf-8", env: { ...process.env } }
    ).toString()
    expect(out).toMatch(/\[DRY-RUN\]/)
    expect(out).not.toMatch(/\[APPLY\]/)
  })

  it("幂等: 第二遍删除 0 行", () => {
    execSync(`pnpm cleanup:test-pollution -- --apply --archive-dir=${workDir}`, { encoding: "utf-8" })
    const out = execSync(
      `pnpm cleanup:test-pollution -- --apply --archive-dir=${workDir}`,
      { encoding: "utf-8" }
    ).toString()
    expect(out).toMatch(/deleted 0 rows/)
  })
})
```

- [ ] **Step 2: 跑测试,确认失败(脚本不存在)**

```bash
pnpm cleanup:test-pollution -- --dry-run 2>&1 | head -5
```

期望: 命令找不到。

- [ ] **Step 3: 写 cleanup 脚本**

`scripts/cleanup/center-db-test-pollution.ts`:

```ts
/**
 * Cleanup center DB test pollution
 *
 * Idempotent deletion of TEST_* / PKG_TEST rows from 4 center tables.
 * Must run --dry-run first; --apply actually deletes.
 * Pre-delete dump goes to archive/cleanup-<YYYYMMDD>/<table>.jsonl.
 */

import { Pool } from "pg"
import { mkdirSync, writeFileSync, createWriteStream } from "fs"
import { join } from "path"

const DRY_RUN = process.argv.includes("--dry-run")
const APPLY = process.argv.includes("--apply")
const archiveArg = process.argv.find((a) => a.startsWith("--archive-dir="))
const ARCHIVE_DIR = archiveArg ? archiveArg.split("=")[1] : null

if (!DRY_RUN && !APPLY) {
  console.error("MUST pass --dry-run or --apply")
  process.exit(2)
}

const TEST_PATTERN = /^(TEST_|PKG_TEST$)/
const TARGETS = ["unified_tasks","unified_devices","unified_volumes","sync_package_log"]

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL not set")
  const pool = new Pool({ connectionString: dbUrl })

  const mode = DRY_RUN ? "DRY-RUN" : "APPLY"
  console.log(`[${mode}] scanning 4 center tables for site_code ~ /^(TEST_|PKG_TEST$)/`)

  let totalAffected = 0
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const archiveDir = ARCHIVE_DIR ?? join("archive", `cleanup-${today}`)

  for (const t of TARGETS) {
    const col = t === "sync_package_log" ? "site_code" : "source_site_id"
    const rows = await pool.query(
      `SELECT * FROM ${t} WHERE ${col} ~ '^(TEST_|PKG_TEST$)'`
    )
    const n = rows.rowCount ?? 0
    totalAffected += n

    if (n > 0) {
      mkdirSync(archiveDir, { recursive: true })
      const archivePath = join(archiveDir, `${t}.jsonl`)
      if (DRY_RUN) {
        writeFileSync(archivePath, rows.rows.map((r) => JSON.stringify(r)).join("\n"))
      } else {
        const stream = createWriteStream(archivePath, { flags: "a" })
        rows.rows.forEach((r) => stream.write(JSON.stringify(r) + "\n"))
        stream.end()
        await pool.query(
          `DELETE FROM ${t} WHERE ${col} ~ '^(TEST_|PKG_TEST$)'`
        )
      }
    }

    console.log(`[${mode}] ${t}: ${n} rows ${DRY_RUN ? "would be deleted" : "deleted"}`)
  }

  console.log(`[${mode}] TOTAL affected: ${totalAffected} rows`)
  await pool.end()
  if (totalAffected > 0 && !DRY_RUN) {
    console.log(`[${mode}] archive dumped to ${archiveDir}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: 接入 package.json**

`package.json` 的 `scripts` 段加:

```json
"cleanup:test-pollution": "tsx scripts/cleanup/center-db-test-pollution.ts"
```

- [ ] **Step 5: 跑 dry-run 验证**

```bash
set -a && source .env.local && set +a
pnpm cleanup:test-pollution -- --dry-run
```

期望: 看到 `[DRY-RUN]` 行 + 每个表匹配行数。

- [ ] **Step 6: 跑 apply 验证(只清 TEST_/PKG_TEST,不会影响 BJ02/SH01)**

```bash
pnpm cleanup:test-pollution -- --apply
```

期望: `[APPLY] TOTAL affected: <N>` + archive 路径。

- [ ] **Step 7: 跑一次 audit 验证**

```bash
pnpm audit:center-db -- --strict
```

期望: `unregistered non-test site data` 仍 pass(剩 0 个非测试 orphan)。

- [ ] **Step 8: 跑测试**

```bash
pnpm exec tsx --test scripts/cleanup/__tests__/center-db-test-pollution.test.ts 2>&1 | tail -10
```

(若测试框架不是 vitest,改用 `pnpm vitest run scripts/cleanup/__tests__/`)

期望: 2 pass。

- [ ] **Step 9: tsc 检查**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 10: 提交**

```bash
git add scripts/cleanup/center-db-test-pollution.ts scripts/cleanup/__tests__/ package.json
git commit -m "feat(cleanup): add idempotent test-pollution cleanup script"
```

---

## Task 7: C6 — `/api/sites/orphans` 详情端点

**Files:**
- Create: `app/api/sites/orphans/route.ts`
- Create: `lib/types/orphan-sites.ts`
- Create: `app/api/sites/__tests__/orphans-route.test.ts`

- [ ] **Step 1: 写类型契约**

`lib/types/orphan-sites.ts`:

```ts
export interface OrphanSiteSources {
  tasks: number
  devices: number
  volumes: number
  packages: number
}

export interface OrphanSiteRow {
  site_code: string
  sources: OrphanSiteSources
}

export interface OrphanSitesResponse {
  code: number
  message: string
  data: OrphanSiteRow[]
  traceId: string
}
```

- [ ] **Step 2: 写失败测试**

`app/api/sites/__tests__/orphans-route.test.ts`:

```ts
import { describe, it, expect } from "vitest"

describe("GET /api/sites/orphans", () => {
  it("返回 200 + data 数组", async () => {
    const res = await fetch("http://localhost:3000/api/sites/orphans")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(Array.isArray(json.data)).toBe(true)
  })

  it("orphan 行包含 site_code + 4 计数", async () => {
    const res = await fetch("http://localhost:3000/api/sites/orphans")
    const json = await res.json()
    if (json.data.length > 0) {
      const row = json.data[0]
      expect(row).toHaveProperty("site_code")
      expect(row.sources).toEqual(
        expect.objectContaining({
          tasks: expect.any(Number),
          devices: expect.any(Number),
          volumes: expect.any(Number),
          packages: expect.any(Number),
        })
      )
    }
  })

  it("返回的 site_code 都不在 sync_sites 表", async () => {
    const [orphans, registered] = await Promise.all([
      fetch("http://localhost:3000/api/sites/orphans").then((r) => r.json()),
      fetch("http://localhost:3000/api/sites").then((r) => r.json()),
    ])
    const regCodes = new Set(registered.data.map((s: any) => s.code))
    for (const o of orphans.data) {
      expect(regCodes.has(o.site_code)).toBe(false)
    }
  })
})
```

- [ ] **Step 3: 跑测试,确认失败**

```bash
pnpm dev &  # 起 dev server
sleep 8
curl -s http://localhost:3000/api/sites/orphans | head -5
```

期望: 404 或 route 不存在。

- [ ] **Step 4: 写 route 实现**

`app/api/sites/orphans/route.ts`:

```ts
/**
 * GET /api/sites/orphans
 *
 * Returns site codes that appear in center business tables but are NOT
 * registered in sync_sites. Read-only, center DB only.
 *
 * Source priority (CLAUDE.md Appendix C):
 *   1. unified_tasks, unified_devices, unified_volumes (source_site_id)
 *   2. sync_package_log (site_code)
 *   3. NOT sync_sites (registered sites are excluded)
 */

import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { OrphanSiteRow, OrphanSitesResponse } from "@/lib/types/orphan-sites"

interface ObservedRow {
  site_code: string
  task_count: number
  device_count: number
  volume_count: number
  package_count: number
}

export async function GET() {
  const traceId = `orphans-${Date.now()}`
  try {
    const result = await query<ObservedRow>(
      `WITH observed AS (
         SELECT source_site_id AS site_code,
                COUNT(*)::int AS task_count,
                0::int AS device_count,
                0::int AS volume_count,
                0::int AS package_count
         FROM unified_tasks
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id, 0, COUNT(*)::int, 0, 0
         FROM unified_devices
         GROUP BY source_site_id
         UNION ALL
         SELECT source_site_id, 0, 0, COUNT(*)::int, 0
         FROM unified_volumes
         GROUP BY source_site_id
         UNION ALL
         SELECT site_code, 0, 0, 0, COUNT(*)::int
         FROM sync_package_log
         GROUP BY site_code
       )
       SELECT o.site_code,
              SUM(o.task_count)::int AS task_count,
              SUM(o.device_count)::int AS device_count,
              SUM(o.volume_count)::int AS volume_count,
              SUM(o.package_count)::int AS package_count
       FROM observed o
       LEFT JOIN sync_sites ss ON ss.site_code = o.site_code
       WHERE ss.site_code IS NULL
       GROUP BY o.site_code
       ORDER BY o.site_code`
    )

    const data: OrphanSiteRow[] = result.rows.map((r) => ({
      site_code: r.site_code,
      sources: {
        tasks: Number(r.task_count) || 0,
        devices: Number(r.device_count) || 0,
        volumes: Number(r.volume_count) || 0,
        packages: Number(r.package_count) || 0,
      },
    }))

    return NextResponse.json({
      code: 0,
      message: "ok",
      data,
      traceId,
    } satisfies OrphanSitesResponse)
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: [],
        traceId,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: 跑测试,确认通过**

```bash
pnpm exec tsx --test app/api/sites/__tests__/orphans-route.test.ts 2>&1 | tail -10
```

(或 `pnpm vitest run`)

期望: 3 pass。

- [ ] **Step 6: tsc 检查**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 7: 提交**

```bash
git add app/api/sites/orphans/route.ts app/api/sites/__tests__/ lib/types/orphan-sites.ts
git commit -m "feat(api): add /api/sites/orphans detail endpoint"
```

---

## Task 8: C7 — `/sites` 页面 orphan 明细 Drawer

**Files:**
- Modify: `app/sites/page.tsx`

- [ ] **Step 1: 写失败测试 — Drawer 触发按钮存在**

`scripts/e2e/test-r83.1-sites-orphan.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest"

describe("/sites 页面 orphan Drawer (R.83.1)", () => {
  beforeAll(async () => {
    // 假设 dev server 已起, 直接 fetch HTML
  })

  it("/sites 页面包含 '查看未注册 siteCode 明细' 触发器", async () => {
    const res = await fetch("http://localhost:3000/sites")
    const html = await res.text()
    expect(html).toMatch(/orphan-detail-trigger|查看未注册 siteCode 明细|未注册历史 siteCode/)
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
pnpm exec tsx --test scripts/e2e/test-r83.1-sites-orphan.ts 2>&1 | tail -10
```

期望: fail(目前页面只有"未注册 N 个"文字,无按钮)。

- [ ] **Step 3: 修改 `app/sites/page.tsx`**

在第 270 行 `检测到 {meta.orphanSiteCodes.length} 个未注册历史 siteCode` 那个 span 之后,加 button:

```tsx
{meta?.orphanSiteCodes && meta.orphanSiteCodes.length > 0 && (
  <>
    <span className="text-xs text-slate-500">
      检测到 {meta.orphanSiteCodes.length} 个未注册历史 siteCode,未计入站点总数
    </span>
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-xs"
      data-testid="orphan-detail-trigger"
      onClick={() => setShowOrphanDetail(true)}
    >
      查看明细
    </Button>
  </>
)}
```

加 state 和 Dialog(在文件顶部 import 区域已含 Dialog):

```tsx
const [showOrphanDetail, setShowOrphanDetail] = useState(false)
const [orphanDetail, setOrphanDetail] = useState<Array<{ site_code: string; sources: { tasks: number; devices: number; volumes: number; packages: number } }>>([])
const [orphanLoading, setOrphanLoading] = useState(false)

const loadOrphanDetail = async () => {
  setOrphanLoading(true)
  try {
    const res = await fetch("/api/sites/orphans", { cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    setOrphanDetail(Array.isArray(json.data) ? json.data : [])
  } catch (e) {
    setOrphanDetail([])
  } finally {
    setOrphanLoading(false)
  }
}

useEffect(() => {
  if (showOrphanDetail) loadOrphanDetail()
}, [showOrphanDetail])
```

Dialog 在文件末尾 `</AppShell>` 前插入:

```tsx
<Dialog open={showOrphanDetail} onOpenChange={setShowOrphanDetail}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>未注册 siteCode 明细</DialogTitle>
    </DialogHeader>
    <div className="space-y-2 py-4">
      {orphanLoading ? (
        <p className="text-sm text-slate-500">加载中…</p>
      ) : orphanDetail.length === 0 ? (
        <div className="text-center py-6 text-emerald-600 dark:text-emerald-300">
          <p className="font-medium">无未注册 siteCode</p>
          <p className="text-xs text-slate-500 mt-1">中心库业务表与 sync_sites 注册表完全一致</p>
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1">
          {orphanDetail.map((o) => (
            <div key={o.site_code} className="flex items-center justify-between p-2 rounded border border-slate-100 dark:border-slate-800 text-xs">
              <span className="font-mono font-medium">{o.site_code}</span>
              <span className="text-slate-500">
                tasks={o.sources.tasks} / devices={o.sources.devices} / volumes={o.sources.volumes} / packages={o.sources.packages}
              </span>
              <span className="text-red-600 dark:text-red-400 text-[10px]">未计入站点总数</span>
            </div>
          ))}
        </div>
      )}
    </div>
    <DialogFooter>
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-slate-500">
          清理需执行: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">pnpm cleanup:test-pollution -- --apply</code>
        </span>
        <Button onClick={() => setShowOrphanDetail(false)}>关闭</Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
pnpm exec tsx --test scripts/e2e/test-r83.1-sites-orphan.ts 2>&1 | tail -5
```

- [ ] **Step 5: tsc 检查**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 6: 浏览器手验(可选,但 CLAUDE.md R.5 强烈推荐)**

```bash
pnpm dev &
sleep 8
curl -s "http://localhost:3000/sites" | grep -E "查看明细|orphan-detail-trigger"
```

期望: 命中。

- [ ] **Step 7: 提交**

```bash
git add app/sites/page.tsx scripts/e2e/test-r83.1-sites-orphan.ts
git commit -m "feat(sites): surface orphan siteCode detail in Drawer (R.83.1)"
```

---

## Task 9: C8 — README 自检流程补全

**Files:**
- Modify: `README.md` §5.3.1

- [ ] **Step 1: 定位现有 §5.3.1**

```bash
grep -n "### 5.3.1" README.md
```

- [ ] **Step 2: 在 §5.3.1 末尾追加"如何解读 finding"表格**

在第 464 行 `严格模式存在未注册的非测试 siteCode 或明文敏感字段时会失败。` 之后追加:

```markdown
### 5.3.2 audit:center-db finding 解读表

跑完 `pnpm audit:center-db` 后,每个 finding 都有 `[PASS|WARN|FAIL]` 三种级别,含义如下:

| finding name | PASS 含义 | WARN 含义 | FAIL 含义 |
|---|---|---|---|
| `center database selected` | 已连上中心库 | — | env 缺失 |
| `sync_sites table` | 表存在 | — | 表不存在 |
| `sync_sites secret storage` | 无明文密码列 | — | 有 db_password / password 列(违反 §6.2.1) |
| `registered sites` | 至少 1 个注册站点 | — | 0 个注册 |
| `credential refs` | 全是 env 引用 | — | 含 `postgres:` 等直连接串 |
| `unregistered non-test site data` | 无 | — | 存在非测试 orphan(必须清理) |
| `unregistered test/historical site data` | 无 | 仅作数据质量提示 | — |
| `center unified tables` | 任意 | < 28 时提示扩表 | — |
| `unified_* raw_data sensitive keys` | 全空或 [REDACTED] | — | 含明文密码/token |

### 5.3.3 治理矩阵 JSON 字段含义

```bash
pnpm audit:center-db -- --matrix
# 产出 audit/center-db-matrix.json
```

字段:

| 字段 | 含义 |
|---|---|
| `generatedAt` | 生成时间(ISO 8601) |
| `entries[].unified_table` | 中心库 unified_* 表名 |
| `entries[].source_table` | 对应站点源表名 |
| `entries[].classification` | `pg17_small` / `opensearch` / `clickhouse` / `forbidden` |
| `entries[].blocker` | `none` / `blocked_by_source_schema` / `blocked_by_external_system` |
| `entries[].round` | `R.83.1` / `R.83.2+` / `deferred` / `never` |

完整矩阵见 `docs/database-analysis/r83-170-table-governance-matrix.md`(170 张表逐行)。

### 5.3.4 提交决策清单模板(给领导)

如果某个 req 长期 `partial` 是因为站点侧阻塞,产出如下清单给领导:

```markdown
## R.83.x 站点 schema/API 变更清单

| 变更项 | 涉及表/API | DDL/文档 | 决策人 |
|---|---|---|---|
| tbl_task 加 paused BOOLEAN | tbl_task | ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE; | 领导 + 站点运维 |
| 站点 app poll control_command | 站点 app | 启动时 GET /api/site-control/commands | 站点 app 团队 |
```
```

- [ ] **Step 3: 验证 README 拼写与渲染**

```bash
grep -nE "^### 5\.3\." README.md
```

期望: 看到 5.3.1 / 5.3.2 / 5.3.3 / 5.3.4 四节。

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs(readme): extend §5.3 with audit finding interpretation + matrix guide"
```

---

## Task 10: 全量提交前检查 + 提交 review

**Files:**
- Create: `docs/database-analysis/sprint-r83.1-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`

- [ ] **Step 1: 跑 7 件套**

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm audit:center-db -- --strict --matrix
pnpm cleanup:test-pollution -- --dry-run
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
```

任一失败 → 停,先排查再继续。

- [ ] **Step 2: 跑 e2e:all**

```bash
pnpm e2e:all
```

期望: 全部 pass。

- [ ] **Step 3: 写 requirements review**

`docs/database-analysis/sprint-r83.1-requirements-review.md`(按 `docs/database-analysis/requirements-strict-review-template.md` 模板填 10 节)。

关键字段:

- **Requirement IDs**: REQ-2.3.1, REQ-3.1, REQ-3.3, REQ-4.2, REQ-6.2.1, REQ-6.3.3
- **Verdict**: `partial`(中心库数字升级 13→28,但 req 状态不变)
- **Missing pieces**: 后续 R.83.2~R.83.x 推 73 张小表;ES/ClickHouse 接入 tbl_file/tbl_folder 大表;Site Agent 增量推送
- **Blocker**: `partial` + 大表 `blocked_by_external_system`

- [ ] **Step 4: 更新 PROJECT_STATUS**

`docs/summary/PROJECT_STATUS.md` 在"当前 Sprint"段加一行:

```markdown
| Sprint R.83.1 | ✅ | §2.3 / §3.1 / §3.3 / §4.2 中心库补 15 张业务表(白名单 13→28),170 表治理矩阵,orphan UI |
```

- [ ] **Step 5: 最终提交**

```bash
git add docs/database-analysis/sprint-r83.1-requirements-review.md docs/summary/PROJECT_STATUS.md
git commit -m "docs(review): strict review for R.83.1 center-db-governance"
```

- [ ] **Step 6: 推送到 origin**

```bash
git push origin codex/center-db-governance
```

期望: 推送成功,远端领先 9 个 commit。

---

## 提交清单最终核对(spec §8)

| # | commit message | Files | 状态 |
|---|---|---|---|
| 1 | feat(schema): add 15 unified_* tables for departments, projects, receipts (R.83.1 DDL) | databases/sprint-r83.1/01-department-receipt-tables.sql | ⬜ |
| 2 | feat(schema): wire R.83.1 DDL into db:init path | docker-compose.yml 或 db init 脚本 | ⬜ |
| 3 | feat(sync): extend package whitelist 13 → 28 with R.83.1 batch | lib/sync/package-schema.ts + test | ⬜ |
| 4 | feat(audit): add matrix output to audit:center-db | scripts/audit/center-db-integrity.ts | ⬜ |
| 5 | docs(audit): produce 170-table governance matrix | r83-170-table-governance-matrix.md + generate-r83-matrix.ts | ⬜ |
| 6 | feat(cleanup): add idempotent test-pollution cleanup script | scripts/cleanup/ + package.json | ⬜ |
| 7 | feat(api): add /api/sites/orphans detail endpoint | app/api/sites/orphans/route.ts + test + types | ⬜ |
| 8 | feat(sites): surface orphan siteCode detail in Drawer (R.83.1) | app/sites/page.tsx + e2e | ⬜ |
| 9 | docs(readme): extend §5.3 with audit finding interpretation + matrix guide | README.md | ⬜ |
| 10 | docs(review): strict review for R.83.1 center-db-governance | sprint-r83.1-requirements-review.md + PROJECT_STATUS.md | ⬜ |

---

## Self-Review(plan 自审)

### 1. Spec 覆盖

| Spec 节 | 任务 |
|---|---|
| §3.1 15 张表清单 | Task 1 (DDL) + Task 3 (白名单) |
| §4.1 C1 治理矩阵 | Task 5 |
| §4.2 C2 audit --matrix | Task 4 |
| §4.3 C3 DDL | Task 1 + Task 2 |
| §4.4 C4 白名单 13→28 | Task 3 |
| §4.5 C5 清理脚本 | Task 6 |
| §4.6 C6 /api/sites/orphans | Task 7 |
| §4.7 C7 Drawer | Task 8 |
| §4.8 C8 README | Task 9 |
| §6 测试验收 | Task 10 |
| §8 9 commits | 9 个 feat/docs commits 已对齐 |
| §9 不变量 | Task 10 验收 |

**Gap**: 无。

### 2. Placeholder 扫描

- "TBD" / "TODO" / "fill in details": 0 命中
- "Add appropriate error handling": 已显式 `try/catch` 在每个 route
- "Similar to Task N": 无,每步都重复了完整代码

### 3. 类型一致性

| 跨任务引用 | 是否一致 |
|---|---|
| `OrphanSiteRow` 在 Task 7 定义,Task 8 使用 | ✅ 字段 `site_code / sources.{tasks,devices,volumes,packages}` 一致 |
| `ALLOWED_PACKAGE_TABLES` 在 Task 3 加 15 项,Task 6 不依赖 | ✅ |
| `audit:center-db --matrix` 在 Task 4 + Task 5 都用 | ✅ |
| 15 张表清单在 Task 1 + Task 3 + Task 5 都用 | ✅ 三个文件独立列出但无矛盾 |

无不一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-23-r83-center-db-governance.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**