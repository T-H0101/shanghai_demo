/**
 * scripts/sync/export-restore-dump.ts
 * Sprint R.55 — export whitelisted tables from a restore DB to a
 * `table_backup.sql` file using `pg_dump --data-only`.
 *
 * Usage:
 *   pnpm sync:dump:export --siteCode=SH01 --out=/tmp/sh01-table_backup.sql
 */

import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
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

const dumpArgs = [
  "--data-only",
  "--no-owner",
  "--no-privileges",
  ...tableArgs,
]

function commandExists(command: string): boolean {
  try {
    execFileSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function dockerDumpArgs(url: string): string[] | null {
  try {
    const parsed = new URL(url)
    const db = parsed.pathname.replace(/^\//, "")
    const user = decodeURIComponent(parsed.username)
    if (db === "star_storage_db") {
      return [
        "exec",
        "-i",
        "site_restore_full_postgres",
        "pg_dump",
        "-U",
        user || "starxdb",
        "-d",
        db,
        ...dumpArgs,
      ]
    }
    if (db === "source_restore") {
      return [
        "exec",
        "-i",
        "unified_disc_postgres",
        "pg_dump",
        "-U",
        user || "unified",
        "-d",
        db,
        ...dumpArgs,
      ]
    }
  } catch {
    return null
  }
  return null
}

if (commandExists("pg_dump")) {
  execFileSync(
    "pg_dump",
    [
      ...dumpArgs,
      "--file",
      out,
      sourceUrl,
    ],
    { stdio: "inherit" }
  )
} else {
  const dockerArgs = dockerDumpArgs(sourceUrl)
  if (!dockerArgs) {
    throw new Error("pg_dump not found and Docker fallback could not infer source container")
  }
  const stdout = execFileSync("docker", dockerArgs)
  writeFileSync(out, stdout)
}

console.log(
  `exported ${DUMP_ALLOWED_TABLES.length} tables to ${out}`
)
