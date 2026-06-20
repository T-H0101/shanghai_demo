/**
 * scripts/sync/export-restore-dump.ts
 * Sprint R.55 — export whitelisted tables from a restore DB to a
 * `table_backup.sql` file using `pg_dump --data-only`.
 *
 * Usage:
 *   pnpm sync:dump:export --siteCode=SH01 --out=/tmp/sh01-table_backup.sql
 */

import { execFileSync } from "node:child_process"
import { DUMP_ALLOWED_TABLES } from "../../lib/sync/dump/manifest"

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=")
    return [key, value ?? "true"]
  })
)

const out = args.out
if (!out) throw new Error("--out is required")

const sourceUrl =
  process.env.SOURCE_DATABASE_URL ?? process.env.SITE_RESTORE_DATABASE_URL
if (!sourceUrl) {
  throw new Error(
    "SOURCE_DATABASE_URL or SITE_RESTORE_DATABASE_URL is required"
  )
}

const tableArgs = DUMP_ALLOWED_TABLES.flatMap((table) => [
  "--table",
  `public.${table}`,
])

execFileSync(
  "pg_dump",
  [
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--column-inserts=false",
    ...tableArgs,
    "--file",
    out,
    sourceUrl,
  ],
  { stdio: "inherit" }
)

console.log(
  `exported ${DUMP_ALLOWED_TABLES.length} tables to ${out}`
)
