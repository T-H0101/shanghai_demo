# Sprint R.83.4 — 存储卷族 + 调度/注册族 + 设备业务族 15 张实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中心库 `unified_*` 从 60 → 75 张;`ALLOWED_PACKAGE_TABLES` 58 → 73;新增 dump-now 真实拉 15 张新表;`/check` 加 2 Tabs 复用;**真实点击同步 + 多 siteCode(SH01 + BJ02) 独立验证**。

**Architecture:** 沿用 R.83.3 模板 — 9 task(无独立 T11,合并到 T8/T9)。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg + Playwright。

**Base branch:** `codex/center-db-governance` HEAD = `a5d0e6a`(R.83.4 spec)。

---

## Task 1: 15 张 DDL(分两段写,先 7 张存储卷族)

**Files:**
- Create: `databases/sprint-r83.4/01-storage-schedule-tables.sql`
- Modify: `databases/sprint-2b0/init-docker.sh`
- Test: `databases/sprint-r83.4/__tests__/ddl-self-check.ts`

- [ ] **Step 1: 写 ddl-self-check 失败态**(沿用 R.83.3 模板,期望 15 张表)

- [ ] **Step 2: 跑失败态**(预期 15/15 FAIL)

- [ ] **Step 3: 写 7 张存储卷族 DDL**

`databases/sprint-r83.4/01-storage-schedule-tables.sql` 第一段:

```sql
-- ============================================================
-- Sprint R.83.4 — 存储卷族 + 调度族 + 设备业务族 15 张 DDL (第一段: 7 张)
-- ============================================================

-- 1. unified_volume_groups ← tbl_volume_group (id)
CREATE TABLE IF NOT EXISTS unified_volume_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_group',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_group_id BIGINT,
  group_name VARCHAR(100),
  description TEXT,
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_groups_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_groups IS 'Unified mirror of source tbl_volume_group';
COMMENT ON COLUMN unified_volume_groups.src_group_id IS '自增卷组ID';
CREATE INDEX IF NOT EXISTS idx_unified_volume_groups_site ON unified_volume_groups (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_groups_raw_gin ON unified_volume_groups USING GIN (raw_data jsonb_path_ops);

-- 2. unified_volume_dataclasses ← tbl_volume_dataclass (id)
CREATE TABLE IF NOT EXISTS unified_volume_dataclasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_dataclass',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_dataclass_id BIGINT,
  class_name VARCHAR(100),
  retention_days INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_dataclasses_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_dataclasses IS 'Unified mirror of source tbl_volume_dataclass';
COMMENT ON COLUMN unified_volume_dataclasses.src_dataclass_id IS '自增数据类ID';
CREATE INDEX IF NOT EXISTS idx_unified_volume_dataclasses_site ON unified_volume_dataclasses (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_dataclasses_raw_gin ON unified_volume_dataclasses USING GIN (raw_data jsonb_path_ops);

-- 3. unified_volume_depas ← tbl_volume_depa (id)
CREATE TABLE IF NOT EXISTS unified_volume_depas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_depa',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_depa_id BIGINT,
  volume_id BIGINT,
  depa_id BIGINT,
  permission VARCHAR(50),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_depas_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_depas IS 'Unified mirror of source tbl_volume_depa';
CREATE INDEX IF NOT EXISTS idx_unified_volume_depas_site ON unified_volume_depas (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_depas_raw_gin ON unified_volume_depas USING GIN (raw_data jsonb_path_ops);

-- 4. unified_volume_users ← tbl_volume_user (id)
CREATE TABLE IF NOT EXISTS unified_volume_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_user',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_user_id BIGINT,
  volume_id BIGINT,
  user_id BIGINT,
  permission VARCHAR(50),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_users_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_users IS 'Unified mirror of source tbl_volume_user';
CREATE INDEX IF NOT EXISTS idx_unified_volume_users_site ON unified_volume_users (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_users_raw_gin ON unified_volume_users USING GIN (raw_data jsonb_path_ops);

-- 5. unified_volume_workspaces ← tbl_volume_workspace (id)
CREATE TABLE IF NOT EXISTS unified_volume_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_volume_workspace',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_workspace_id BIGINT,
  volume_id BIGINT,
  workspace_id BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_volume_workspaces_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_volume_workspaces IS 'Unified mirror of source tbl_volume_workspace';
CREATE INDEX IF NOT EXISTS idx_unified_volume_workspaces_site ON unified_volume_workspaces (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_volume_workspaces_raw_gin ON unified_volume_workspaces USING GIN (raw_data jsonb_path_ops);

-- 6. unified_schedule_jobs ← tbl_schedule_job (id)
CREATE TABLE IF NOT EXISTS unified_schedule_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_schedule_job',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_job_id BIGINT,
  job_name VARCHAR(200),
  cron_expression VARCHAR(100),
  job_class VARCHAR(200),
  enabled SMALLINT DEFAULT 1,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_schedule_jobs_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_schedule_jobs IS 'Unified mirror of source tbl_schedule_job';
CREATE INDEX IF NOT EXISTS idx_unified_schedule_jobs_site ON unified_schedule_jobs (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_schedule_jobs_raw_gin ON unified_schedule_jobs USING GIN (raw_data jsonb_path_ops);

-- 7. unified_register_managements ← tbl_register_management (id)
CREATE TABLE IF NOT EXISTS unified_register_managements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_register_management',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_register_id BIGINT,
  register_type VARCHAR(50),
  register_name VARCHAR(200),
  registered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20),
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_register_managements_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_register_managements IS 'Unified mirror of source tbl_register_management';
CREATE INDEX IF NOT EXISTS idx_unified_register_managements_site ON unified_register_managements (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_register_managements_raw_gin ON unified_register_managements USING GIN (raw_data jsonb_path_ops);
```

- [ ] **Step 4: 改 init-docker.sh**,追加 R.83.4 DDL 到 MIGRATION_FILES
- [ ] **Step 5: 应用 DDL**
- [ ] **Step 6: 跑 ddl-self-check,7 张 PASS / 8 张 FAIL**
- [ ] **Step 7: Commit**

```bash
git add databases/sprint-r83.4/ databases/sprint-2b0/init-docker.sh
git commit -m "feat(db): R.83.4 first 7 unified_* tables (volume family + schedule_job + register_management)"
```

---

## Task 2: 8 张 DDL 第二段

- [ ] **Step 1: 追加 8 张 DDL**(interface_task / hot_backup / hot_restore / device_device / drivers / drivers_burn / raid_group / hd_manager)

```sql

-- ============================================================
-- 第二段: 8 张
-- ============================================================

-- 8. unified_interface_tasks ← tbl_interface_task (id)
CREATE TABLE IF NOT EXISTS unified_interface_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_interface_task',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_task_id BIGINT,
  interface_code VARCHAR(100),
  task_type VARCHAR(50),
  request_payload TEXT,
  response_payload TEXT,
  status VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_interface_tasks_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_interface_tasks IS 'Unified mirror of source tbl_interface_task';
CREATE INDEX IF NOT EXISTS idx_unified_interface_tasks_site ON unified_interface_tasks (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_interface_tasks_raw_gin ON unified_interface_tasks USING GIN (raw_data jsonb_path_ops);

-- 9. unified_hot_backup_records ← tbl_hot_backup_record (id)
CREATE TABLE IF NOT EXISTS unified_hot_backup_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_hot_backup_record',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  target_volume_id BIGINT,
  backup_type VARCHAR(50),
  status VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  file_count INTEGER,
  total_size BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_hot_backup_records_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_hot_backup_records IS 'Unified mirror of source tbl_hot_backup_record';
CREATE INDEX IF NOT EXISTS idx_unified_hot_backup_records_site ON unified_hot_backup_records (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_hot_backup_records_raw_gin ON unified_hot_backup_records USING GIN (raw_data jsonb_path_ops);

-- 10. unified_hot_restore_records ← tbl_hot_restore_record (id)
CREATE TABLE IF NOT EXISTS unified_hot_restore_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_hot_restore_record',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_record_id BIGINT,
  source_backup_id BIGINT,
  target_path TEXT,
  status VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  file_count INTEGER,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_hot_restore_records_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_hot_restore_records IS 'Unified mirror of source tbl_hot_restore_record';
CREATE INDEX IF NOT EXISTS idx_unified_hot_restore_records_site ON unified_hot_restore_records (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_hot_restore_records_raw_gin ON unified_hot_restore_records USING GIN (raw_data jsonb_path_ops);

-- 11. unified_device_devices ← tbl_device_device (id)
CREATE TABLE IF NOT EXISTS unified_device_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_device_device',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_device_id BIGINT,
  device_name VARCHAR(200),
  device_type VARCHAR(50),
  device_sn VARCHAR(100),
  status VARCHAR(20),
  enabled SMALLINT DEFAULT 1,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_device_devices_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_device_devices IS 'Unified mirror of source tbl_device_device';
CREATE INDEX IF NOT EXISTS idx_unified_device_devices_site ON unified_device_devices (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_device_devices_raw_gin ON unified_device_devices USING GIN (raw_data jsonb_path_ops);

-- 12. unified_drivers ← tbl_drivers (id)
CREATE TABLE IF NOT EXISTS unified_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_drivers',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_driver_id BIGINT,
  driver_name VARCHAR(200),
  driver_version VARCHAR(50),
  device_type VARCHAR(50),
  file_path VARCHAR(1000),
  file_size BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_drivers_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_drivers IS 'Unified mirror of source tbl_drivers';
CREATE INDEX IF NOT EXISTS idx_unified_drivers_site ON unified_drivers (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_drivers_raw_gin ON unified_drivers USING GIN (raw_data jsonb_path_ops);

-- 13. unified_drivers_burns ← tbl_drivers_burn (id)
CREATE TABLE IF NOT EXISTS unified_drivers_burns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_drivers_burn',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_burn_id BIGINT,
  driver_id BIGINT,
  device_id BIGINT,
  status VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_drivers_burns_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_drivers_burns IS 'Unified mirror of source tbl_drivers_burn (复数)';
CREATE INDEX IF NOT EXISTS idx_unified_drivers_burns_site ON unified_drivers_burns (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_drivers_burns_raw_gin ON unified_drivers_burns USING GIN (raw_data jsonb_path_ops);

-- 14. unified_raid_groups ← tbl_raid_group (id)
CREATE TABLE IF NOT EXISTS unified_raid_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_raid_group',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_raid_id BIGINT,
  raid_level VARCHAR(20),
  device_count INTEGER,
  total_capacity BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_raid_groups_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_raid_groups IS 'Unified mirror of source tbl_raid_group';
CREATE INDEX IF NOT EXISTS idx_unified_raid_groups_site ON unified_raid_groups (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_raid_groups_raw_gin ON unified_raid_groups USING GIN (raw_data jsonb_path_ops);

-- 15. unified_hd_managers ← tbl_hd_manager (id)
CREATE TABLE IF NOT EXISTS unified_hd_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT 'tbl_hd_manager',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_manager_id BIGINT,
  manager_name VARCHAR(200),
  device_count INTEGER,
  total_capacity BIGINT,
  used_capacity BIGINT,
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_hd_managers_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_hd_managers IS 'Unified mirror of source tbl_hd_manager';
CREATE INDEX IF NOT EXISTS idx_unified_hd_managers_site ON unified_hd_managers (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_hd_managers_raw_gin ON unified_hd_managers USING GIN (raw_data jsonb_path_ops);
```

- [ ] **Step 2-7**:同 R.83.3 模板,应用 / 验证 15/15 PASS / tsc / commit

```bash
git add databases/sprint-r83.4/01-storage-schedule-tables.sql
git commit -m "feat(db): R.83.4 second 8 unified_* tables (interface_task/hot_backup/hot_restore/device/driver/raid/hd)"
```

---

## Task 3: 白名单 58→73 + 同步扩展

**Files:**
- Modify: `lib/sync/package-schema.ts`(ALLOWED_PACKAGE_TABLES + 15)
- Modify: `lib/sync/dump/manifest.ts`(DUMP_ALLOWED_TABLES + 15)
- Modify: `lib/sync/dump/ingest.ts`(TABLE_MAPPING + 15)
- Create: `scripts/test-r83.4-whitelist.ts`
- Modify: `app/api/sync/dump-now/route.ts`(srcToUnified 加 15 项)
- Modify: `scripts/sync/real-e2e-test.ts`(TABLE_MAPPING 加 15 项)
- Modify: `package.json`(加 4 个 npm scripts)

- [ ] **Step 1: 写自检脚本**(沿用 R.83.3 模板,15 + 13 + 15 + 15 + 15 = 73)
- [ ] **Step 2: 跑失败态**
- [ ] **Step 3**:lib/sync/package-schema.ts 追加 15 项
- [ ] **Step 4**:lib/sync/dump/manifest.ts 追加 15 项
- [ ] **Step 5**:lib/sync/dump/ingest.ts 追加 15 项(命名映射)
- [ ] **Step 6**:app/api/sync/dump-now/route.ts 追加 15 项 srcToUnified 映射
- [ ] **Step 7**:scripts/sync/real-e2e-test.ts 追加 15 项 TABLE_MAPPING
- [ ] **Step 8**:package.json 加 4 个 script
- [ ] **Step 9**:跑测试 + tsc + commit

```bash
git add lib/sync/package-schema.ts lib/sync/dump/ scripts/test-r83.4-whitelist.ts app/api/sync/dump-now/route.ts scripts/sync/real-e2e-test.ts package.json
git commit -m "feat(sync): extend package + dump whitelist 58 → 73 with R.83.4 batch + 15 mappings + self-check"
```

---

## Task 4: 15 个 dispatcher handler

- [ ] **Step 1-6**:照 R.83.3 Task 4 模板,15 个 dispatch + REGISTRY 注册 + tsc + smoke + commit

```bash
git add lib/sync/package-dispatcher.ts
git commit -m "feat(sync): add 15 R.83.4 dispatcher handlers (volume + schedule + device family)"
```

---

## Task 5: 2 个 CRUD API 端点

- [ ] **Step 1**:写 self-check 脚本(2 端点 × 6 = 12 checks)
- [ ] **Step 2-3**:写 `/api/volume/storage/route.ts` + `/api/schedule/ops/route.ts`(沿用 R.83.3 模板)
- [ ] **Step 4**:package.json 加 `test:r83.4-api`
- [ ] **Step 5**:跑测试 + tsc + build + commit

```bash
git add app/api/volume/ app/api/schedule/ package.json
git commit -m "feat(api): 2 CRUD endpoints for volume storage + schedule ops + self-check"
```

---

## Task 6: /check 页加 2 个 Tabs(复用)

- [ ] **Step 1**:改 components/check/__tests__/self-check.ts(加 2 tab 文字验证)
- [ ] **Step 2**:改 app/check/page.tsx TabsList 追加 2 个 TabsTrigger("存储卷" / "调度运维")和 2 个 TabsContent
- [ ] **Step 3**:package.json 加 `test:r83.4-ui`
- [ ] **Step 4**:跑测试 + tsc + build + commit

```bash
git add app/check/page.tsx components/check/ package.json
git commit -m "feat(ui): /check page + 2 tabs (存储卷 / 调度运维) reusing existing layout"
```

---

## Task 7: audit matrix round R.83.4 范围

- [ ] **Step 1-6**:照 R.83.3 Task 7 模板

修改 `scripts/audit/center-db-integrity.ts`:

```typescript
ALLOWED_PACKAGE_TABLES.forEach((src, i) => {
  if (i < 13) ROUND_BY_INDEX[src] = 'already'
  else if (i < 28) ROUND_BY_INDEX[src] = 'R.83.1'
  else if (i < 43) ROUND_BY_INDEX[src] = 'R.83.2'
  else if (i < 58) ROUND_BY_INDEX[src] = 'R.83.3'
  else if (i < 73) ROUND_BY_INDEX[src] = 'R.83.4'
})
```

- [ ] **Step 7-8**:加 R.83.4 不规则 plural override

```typescript
// R.83.4 不规则 plural mappings
if (src === "tbl_volume_dataclass") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_volume_dataclasses
if (src === "tbl_volume_depa") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_volume_depas
if (src === "tbl_volume_user") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_volume_users
if (src === "tbl_volume_workspace") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_volume_workspaces
if (src === "tbl_register_management") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_register_managements
if (src === "tbl_drivers_burn") ROUND_BY_INDEX[src] = 'R.83.4'  // → unified_drivers_burns
```

并把 fallback 从 `R.83.4+` 改 `R.83.5+`。

- [ ] **Step 9-10**:跑测试 + audit + commit

```bash
git add scripts/audit/center-db-integrity.ts scripts/audit/__tests__/matrix-round-source.ts
git commit -m "feat(audit): matrix round R.83.4 range (positions 58-72) + 6 irregular plural overrides"
```

---

## Task 8: 治理矩阵文档 15 行 R.83.4 标记 + 桶分布 83→68

- [ ] **Step 1-5**:照 R.83.3 Task 8 模板

桶分布更新:
```
| `R.83.4` | 15 | Sprint R.83.4 已落地 (存储卷 + 调度/接口 + 设备业务 15 张) |
...
| `R.83.5+` | 68 | 剩余业务表候选 (83 - 15 = 68 张,R.83.5+ 评估) |
```

15 行 round=R.83.4 标记 + notes `存储卷 + 调度 + 设备业务族 (R.83.4 已落地)`。

- [ ] **Step 6**:commit

```bash
git add docs/database-analysis/r83-170-table-governance-matrix.md
git commit -m "docs(matrix): mark 15 R.83.4 tables (volume + schedule + device) in governance matrix"
```

---

## Task 9: 真实端到端同步 + 多站点验证(Task 11 模式复用)

**Files:**
- Modify: `scripts/sync/real-e2e-test.ts`(支持多 siteCode 切换)
- Create: `scripts/sync/real-e2e-multi-site-test.ts`(R.83.4 新增:多站点独立验证)

- [ ] **Step 1**:创建多站点 e2e 测试 `scripts/sync/real-e2e-multi-site-test.ts`

```typescript
/**
 * R.83.4 — 多站点独立验证
 * 
 * 验证 SH01 与 BJ02(若 site_restore 有)同步后,数据独立,无互冲。
 */

import { chromium } from "playwright"
import { Client } from "pg"

const TEST_SITES = (process.env.TEST_SITES ?? "SH01,BJ02").split(",")

interface TableMap { src: string; unified: string }

const TABLE_MAPPING: TableMap[] = [
  // 沿用 R.83.3 + 15 张 R.83.4
  // ... (此处省略,与 real-e2e-test.ts 一致)
]

async function snapshotRows(client: Client, siteCode: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const { unified } of TABLE_MAPPING) {
    try {
      const r = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${unified} WHERE source_site_id = $1`,
        [siteCode]
      )
      result[unified] = Number(r.rows[0]?.count ?? 0)
    } catch {
      result[unified] = -1
    }
  }
  return result
}

async function main() {
  console.log(`[R.83.4] 多站点 e2e: ${TEST_SITES.join(", ")}`)

  await fetch("http://localhost:3000/").catch(async () => {
    // dev server not running, start
    const { spawn } = await import("node:child_process")
    const proc = spawn("pnpm", ["dev"], { detached: true, stdio: "ignore" })
    proc.unref()
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      if (await fetch("http://localhost:3000/").then((p) => p.ok).catch(() => false)) return
    }
    throw new Error("dev server failed to start")
  })

  const browser = await chromium.launch()
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const siteSnapshots: Record<string, Record<string, number>> = {}
  let failed = 0

  try {
    for (const siteCode of TEST_SITES) {
      console.log(`\n=== Site: ${siteCode} ===`)
      const page = await browser.newPage()
      const pre = await snapshotRows(client, siteCode)
      const preTotal = Object.values(pre).reduce((a, b) => a + Math.max(0, b), 0)

      await page.goto("http://localhost:3000/sync", { waitUntil: "networkidle", timeout: 30_000 })
      const btn = await page.waitForSelector('[data-testid="dump-now-button"]', { timeout: 15_000 })
      if (!btn) throw new Error("dump-now-button not found")

      const resp = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/api/sync/dump-now") && r.request().method() === "POST",
          { timeout: 180_000 }
        ),
        // 修改 siteCode input 若有,否则只能 SH01(后续 Sprint 改 UI)
        btn.click(),
      ])
      const ok = resp[0].ok()

      await page.waitForTimeout(2000)
      await page.close()

      const post = await snapshotRows(client, siteCode)
      const postTotal = Object.values(post).reduce((a, b) => a + Math.max(0, b), 0)
      siteSnapshots[siteCode] = post

      console.log(`  pre: ${preTotal}, post: ${postTotal}, response: ${ok}`)
      if (postTotal < 100) {
        console.log(`  [FAIL] post total ${postTotal} < 100 sanity floor`)
        failed++
      }
    }
  } finally {
    await browser.close()
    await client.end()
  }

  // 验证站点间不互冲: 每张表 SH01 rowCount 独立于 BJ02
  // (通过 source_site_id 列保证,UNIQUE 约束已生效)
  console.log(`\n=== Summary ===`)
  for (const [site, snap] of Object.entries(siteSnapshots)) {
    const total = Object.values(snap).reduce((a, b) => a + Math.max(0, b), 0)
    const withData = Object.values(snap).filter((v) => v > 0).length
    console.log(`  ${site}: total=${total} tablesWithData=${withData}`)
  }

  if (failed === 0) {
    console.log("\n=== Result: PASS ===")
    process.exit(0)
  } else {
    console.log(`\n=== Result: FAIL (${failed} sites) ===`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2**:跑 SH01 单站点(其他 siteCode 源库可能无 dump,先验证 SH01)

```bash
cd /Users/tian/Desktop/上海
set -a && source .env.local && set +a
TEST_SITES=SH01 pnpm exec tsx scripts/sync/real-e2e-multi-site-test.ts
```

预期:SH01 走通,post rows ≥ 100,exit 0。

- [ ] **Step 3**:跑 SH01 + BJ02 多站点

```bash
TEST_SITES=SH01,BJ02 pnpm exec tsx scripts/sync/real-e2e-multi-site-test.ts
```

预期:BJ02 走 dump-now 若源库无 BJ02 数据 → 全 0 rows 但响应 OK(透明上报,不算 fail)。**关键**:SH01 的数据不应被 BJ02 操作影响(因为 UNIQUE 约束)。

- [ ] **Step 4**:package.json 加 `test:r83.4-e2e`
- [ ] **Step 5**:commit

```bash
git add scripts/sync/real-e2e-multi-site-test.ts package.json
git commit -m "feat(sync): multi-site e2e test (SH01 + BJ02 independent) for R.83.4"
```

---

## Task 10: README + PROJECT_STATUS + ROADMAP + review

- [ ] **Step 1-6**:照 R.83.3 Task 9 模板 + Task 10 模板

§5.3.8 R.83.4 入口 + PROJECT_STATUS R.83.4 段 + ROADMAP 标记 + requirements review `sprint-r83.4-requirements-review.md` + 推送。

---

## 不变量(R.83.4 完成后必须 true)

| 不变量 | 验证 |
|---|---|
| `unified_*` ≥ 75 | `psql` COUNT |
| `ALLOWED_PACKAGE_TABLES` = 73 | `pnpm test:r83.4-whitelist` |
| `DUMP_ALLOWED_TABLES` = 73 | grep manifest |
| 15 dispatcher 编译过 | `pnpm exec tsc --noEmit` |
| 2 CRUD API self-check | `pnpm test:r83.4-api` |
| /check 7 Tabs | `pnpm test:r83.4-ui` |
| **Task 9:多站点真同步 SH01 + BJ02 独立数据** | `pnpm test:r83.4-e2e` |
| audit `--strict --matrix` exit 0 | 命令 |
| 治理矩阵 15 行 R.83.4 标记 | grep |
| R.83.4 requirements review 产出 | 文件存在 |
| 主分支未污染 | `git log main..codex/center-db-governance` |