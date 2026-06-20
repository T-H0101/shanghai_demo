/**
 * scripts/sync/ingest-dump.ts
 * Sprint R.55 — CLI ingestion for a `table_backup.sql` file produced by
 * `pg_dump` against a restore DB. Reuses the existing package
 * dispatcher so logs and upserts are identical to the JSON package
 * path.
 *
 * Usage:
 *   pnpm sync:dump:ingest --siteCode=SH01 --file=/tmp/sh01-table_backup.sql
 */

import { readFileSync } from "node:fs"
import { closePool } from "../../lib/db/postgres"
import { closeSourcePool } from "../../lib/db/source-pool"
import { ingestPgDump } from "../../lib/sync/dump/ingest"

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=")
    return [key, value ?? "true"]
  })
)

if (!args.siteCode) throw new Error("--siteCode is required")
if (!args.file) throw new Error("--file is required")

ingestPgDump({
  siteCode: args.siteCode,
  sql: readFileSync(args.file, "utf8"),
  batchId: `dump-${args.siteCode}-${Date.now()}`,
  mode: (args.mode as "full" | "incremental") ?? "full",
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
  .catch((err) => {
    console.error("ingest failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await closeSourcePool().catch(() => {})
    await closePool()
  })
