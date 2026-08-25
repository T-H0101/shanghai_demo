/**
 * Sprint R.100 — DDL Self-Check for unified_restore_files
 *
 *   pnpm exec tsx databases/sprint-r100/__tests__/ddl-self-check.ts
 */

import { Pool } from "pg"

const TABLE = "unified_restore_files"
const REQUIRED_COLS = [
  "id",
  "source_site_id",
  "source_table",
  "source_record_id",
  "synced_at",
  "raw_data",
  "task_id",
  "file_full_path",
  "restore_root_path",
  "restore_status",
  "restore_comment",
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("DATABASE_URL required")
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  let failed = 0
  try {
    const exists = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1
       ) AS exists`,
      [TABLE]
    )
    if (!exists.rows[0]?.exists) {
      console.error(`FAIL: ${TABLE} missing`)
      process.exit(1)
    }
    console.log(`PASS: ${TABLE} exists`)

    const cols = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [TABLE]
    )
    const set = new Set(cols.rows.map((r) => r.column_name))
    for (const c of REQUIRED_COLS) {
      if (!set.has(c)) {
        console.error(`FAIL: column ${c} missing`)
        failed++
      } else {
        console.log(`PASS: column ${c}`)
      }
    }

    const uniq = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'unified_restore_files_site_record_uniq'
       ) AS exists`
    )
    if (!uniq.rows[0]?.exists) {
      console.error("FAIL: unique constraint missing")
      failed++
    } else {
      console.log("PASS: site_record uniq")
    }
  } finally {
    await pool.end()
  }
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
