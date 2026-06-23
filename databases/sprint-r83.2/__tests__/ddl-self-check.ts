/**
 * Sprint R.83.2 — DDL Self-Check
 *
 * Verifies that the 8 first-batch (and 7 second-batch) unified_* tables
 * exist in the live center DB with the required R.83.2 standard:
 *
 *   - 6-column standard: id / source_site_id / source_table /
 *     source_record_id / synced_at / raw_data
 *   - UNIQUE(source_site_id, source_record_id) named
 *     "unified_<stripped>_site_record_uniq"
 *   - At least one GIN index whose definition references raw_data and gin
 *   - B-tree index on source_site_id
 *   - COMMENT ON TABLE (table-level)
 *
 * Usage:
 *   pnpm exec tsx databases/sprint-r83.2/__tests__/ddl-self-check.ts
 *
 * Exit 0 = all PASS, exit 1 = any FAIL.
 */

import { Pool } from "pg"

const EXPECTED_TABLES = [
  // First batch — should be created by 01-rbac-dict-log-tables.sql
  "unified_dict_categories",
  "unified_dicts",
  "unified_dict_items",
  "unified_sys_logs",
  "unified_api_logs",
  "unified_api_interfaces",
  "unified_user_mfas",
  "unified_archives_types",
  // Second batch — Task 2 will create these (expect FAIL in this task)
  "unified_archives_levels",
  "unified_platform_types",
  "unified_fucs",
  "unified_roles",
  "unified_role_fucs",
  "unified_credible_proves",
  "unified_credible_verifies",
]

const REQUIRED_COLUMNS: Array<{ name: string; dataType: string; notNull: boolean }> = [
  { name: "id", dataType: "uuid", notNull: true },
  { name: "source_site_id", dataType: "character varying", notNull: true },
  { name: "source_table", dataType: "character varying", notNull: true },
  { name: "source_record_id", dataType: "text", notNull: true },
  { name: "synced_at", dataType: "timestamp with time zone", notNull: true },
  { name: "raw_data", dataType: "jsonb", notNull: false },
]

interface CheckResult {
  table: string
  passed: boolean
  failures: string[]
}

const results: CheckResult[] = []

function fail(r: CheckResult, msg: string) {
  r.passed = false
  r.failures.push(msg)
}

async function checkTable(pool: Pool, tableName: string): Promise<CheckResult> {
  const r: CheckResult = { table: tableName, passed: true, failures: [] }

  // 1. table exists
  const existsQ = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  )
  if (!existsQ.rows[0]?.exists) {
    fail(r, `table does not exist`)
    return r
  }

  // 2. 6 standard columns with correct types
  const colsQ = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  )
  const colMap = new Map(colsQ.rows.map((row) => [row.column_name, row]))
  for (const req of REQUIRED_COLUMNS) {
    const col = colMap.get(req.name)
    if (!col) {
      fail(r, `missing column ${req.name}`)
      continue
    }
    if (col.data_type !== req.dataType) {
      fail(r, `column ${req.name} type ${col.data_type} (expected ${req.dataType})`)
    }
    if (req.notNull && col.is_nullable !== "NO") {
      fail(r, `column ${req.name} should be NOT NULL`)
    }
  }

  // 3. UNIQUE(source_site_id, source_record_id) — name pattern
  const constraintQ = await pool.query<{ conname: string; contype: string; def: string }>(
    `SELECT conname, contype,
            pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid = $1::regclass`,
    [tableName]
  )
  const uniqueConstraint = constraintQ.rows.find(
    (row) =>
      row.contype === "u" &&
      row.def.toLowerCase().includes("source_site_id") &&
      row.def.toLowerCase().includes("source_record_id")
  )
  if (!uniqueConstraint) {
    fail(r, `missing UNIQUE(source_site_id, source_record_id) constraint`)
  } else {
    const expectedName = `unified_${tableName.replace(/^unified_/, "")}_site_record_uniq`
    if (uniqueConstraint.conname !== expectedName) {
      fail(
        r,
        `unique constraint name ${uniqueConstraint.conname} (expected ${expectedName})`
      )
    }
  }

  // 4. GIN index referencing raw_data
  const idxQ = await pool.query<{ indexdef: string }>(
    `SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = $1`,
    [tableName]
  )
  const hasGin = idxQ.rows.some(
    (row) =>
      row.indexdef.toLowerCase().includes("gin") &&
      row.indexdef.toLowerCase().includes("raw_data")
  )
  if (!hasGin) {
    fail(r, `no GIN index on raw_data`)
  }

  // 5. B-tree index on source_site_id
  const hasBtreeSite = idxQ.rows.some(
    (row) =>
      row.indexdef.toLowerCase().includes("btree") &&
      row.indexdef.toLowerCase().includes("source_site_id")
  )
  if (!hasBtreeSite) {
    fail(r, `no B-tree index on source_site_id`)
  }

  // 6. COMMENT ON TABLE
  const commentQ = await pool.query<{ comment: string | null }>(
    `SELECT obj_description(c.oid, 'pg_class') AS comment
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [tableName]
  )
  if (!commentQ.rows[0]?.comment) {
    fail(r, `no COMMENT ON TABLE`)
  }

  return r
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL is not configured")
    process.exit(2)
  }
  const pool = new Pool({ connectionString: url })
  try {
    for (const t of EXPECTED_TABLES) {
      const r = await checkTable(pool, t)
      results.push(r)
    }
  } finally {
    await pool.end()
  }

  let failed = 0
  for (const r of results) {
    if (r.passed) {
      console.log(`[PASS] ${r.table}`)
    } else {
      failed += 1
      console.log(`[FAIL] ${r.table}`)
      for (const f of r.failures) {
        console.log(`       - ${f}`)
      }
    }
  }
  const passed = results.length - failed
  console.log("")
  console.log(`Summary: ${passed}/${results.length} passed (${failed} failed)`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("ddl-self-check crashed:", err)
  process.exit(2)
})
