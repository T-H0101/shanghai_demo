/**
 * Center DB Test Pollution Cleanup (R.83.1)
 *
 * Idempotent deletion of TEST_* / PKG_TEST rows from 4 center business tables.
 * - Default: --dry-run (no deletion, just scan + dump plan)
 * - With --apply: actually DELETE rows + dump to archive/cleanup-<YYYYMMDD>/
 * - Always dumps matched rows to archive before any DELETE
 *
 * Exit code:
 *   0 = success (including "0 matches")
 *   1 = unexpected error
 *   2 = invalid usage (no --dry-run or --apply flag)
 */

import { Pool } from "pg"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"

const DRY_RUN = process.argv.includes("--dry-run")
const APPLY = process.argv.includes("--apply")
const archiveArg = process.argv.find((a) => a.startsWith("--archive-dir="))
const ARCHIVE_DIR_OVERRIDE = archiveArg ? archiveArg.split("=")[1] : null

if (!DRY_RUN && !APPLY) {
  console.error("MUST pass --dry-run or --apply")
  console.error("  Example: pnpm cleanup:test-pollution -- --dry-run")
  console.error("           pnpm cleanup:test-pollution -- --apply")
  process.exit(2)
}

const TEST_PATTERN = "^(TEST_|PKG_TEST$)"
const TARGETS = [
  { table: "unified_tasks", col: "source_site_id" },
  { table: "unified_devices", col: "source_site_id" },
  { table: "unified_volumes", col: "source_site_id" },
  { table: "sync_package_log", col: "site_code" },
]

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error("DATABASE_URL not set")
  const pool = new Pool({ connectionString: dbUrl })

  const mode = DRY_RUN ? "DRY-RUN" : "APPLY"
  console.log(`[${mode}] scanning 4 center tables for ${TEST_PATTERN}`)

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const archiveDir = ARCHIVE_DIR_OVERRIDE ?? join("archive", `cleanup-${today}`)

  let totalAffected = 0
  const summary: Array<{ table: string; matched: number; action: string; archiveFile: string | null }> = []

  for (const t of TARGETS) {
    const rows = await pool.query(`SELECT * FROM ${t.table} WHERE ${t.col} ~ $1`, [TEST_PATTERN])
    const n = rows.rowCount ?? 0
    totalAffected += n

    if (n > 0) {
      mkdirSync(archiveDir, { recursive: true })
      const archivePath = join(archiveDir, `${t.table}.jsonl`)
      writeFileSync(archivePath, rows.rows.map((r) => JSON.stringify(r)).join("\n") + "\n")

      if (APPLY) {
        await pool.query(`DELETE FROM ${t.table} WHERE ${t.col} ~ $1`, [TEST_PATTERN])
        summary.push({ table: t.table, matched: n, action: "deleted", archiveFile: archivePath })
        console.log(`[${mode}] ${t.table}: deleted ${n} rows (dumped to ${archivePath})`)
      } else {
        summary.push({ table: t.table, matched: n, action: "would-delete", archiveFile: archivePath })
        console.log(`[${mode}] ${t.table}: would delete ${n} rows (dumped to ${archivePath})`)
      }
    } else {
      summary.push({ table: t.table, matched: 0, action: "skipped", archiveFile: null })
      console.log(`[${mode}] ${t.table}: 0 matches`)
    }
  }

  console.log(`\n[${mode}] TOTAL affected: ${totalAffected} rows`)
  if (totalAffected > 0) {
    console.log(`[${mode}] archive dir: ${archiveDir}`)
  }

  await pool.end()
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})