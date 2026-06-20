/**
 * test-sync-dump-flow.ts
 * Sprint R.55 — end-to-end test for the pg_dump table_backup.sql
 * ingestion flow:
 *   1. Insert a marker row into source_restore.tbl_task
 *   2. Export whitelisted tables to table_backup.sql
 *   3. Ingest the file into center
 *   4. Verify the marker shows up in center unified_tasks
 *
 * Requires:
 *   - DATABASE_URL (center)
 *   - SITE_DATABASE_URL or SOURCE_DATABASE_URL (restore DB)
 *   - pg_dump on PATH
 */

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { Client } from "pg"
import assert from "node:assert/strict"

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const siteDatabaseUrl =
    process.env.SITE_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL
  assert(databaseUrl, "DATABASE_URL is required")
  assert(siteDatabaseUrl, "SITE_DATABASE_URL or SOURCE_DATABASE_URL is required")

  const marker = `DUMP-${randomUUID().slice(0, 8)}`
  const tmpDir = mkdtempSync(join(tmpdir(), "sync-dump-"))
  const dumpPath = join(tmpDir, `${marker}-table_backup.sql`)

  const site = new Client({ connectionString: siteDatabaseUrl })
  await site.connect()
  try {
    await site.query(
      `INSERT INTO tbl_task (task_name, status, create_dt, update_dt)
       VALUES ($1, 0, NOW(), NOW())`,
      [marker]
    )
  } finally {
    await site.end()
  }

  try {
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "scripts/sync/export-restore-dump.ts",
        `--out=${dumpPath}`,
      ],
      { stdio: "inherit", env: { ...process.env, SOURCE_DATABASE_URL: siteDatabaseUrl } }
    )
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "scripts/sync/ingest-dump.ts",
        "--siteCode=SH01",
        `--file=${dumpPath}`,
        "--mode=full",
      ],
      { stdio: "inherit" }
    )
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }

  const center = new Client({ connectionString: databaseUrl })
  await center.connect()
  try {
    const r = await center.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM unified_tasks
       WHERE source_site_id = $1 AND task_name = $2`,
      ["SH01", marker]
    )
    const count = Number(r.rows[0]?.count ?? 0)
    assert(count >= 1, `expected unified_tasks row for ${marker}, got ${count}`)
  } finally {
    await center.end()
  }

  console.log("sync dump flow: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
