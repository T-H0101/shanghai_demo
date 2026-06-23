/**
 * Center DB Integrity Audit
 *
 * Read-only audit for the deployable center database.
 *
 * Usage:
 *   pnpm audit:center-db
 *   pnpm audit:center-db -- --strict
 */

import { Pool } from "pg"
import { ALLOWED_PACKAGE_TABLES, FORBIDDEN_PACKAGE_TABLES } from "@/lib/sync/package-schema"

const STRICT = process.argv.includes("--strict")
const TEST_SITE_PATTERN = /^(TEST_|PKG_TEST$)/
const SENSITIVE_RAW_KEYS = [
  "pwd",
  "root_pwd",
  "password",
  "password_salt",
  "secret",
  "token",
  "lib_pwd",
  "encrypt",
] as const

interface Finding {
  level: "pass" | "warn" | "fail"
  name: string
  detail: string
}

const findings: Finding[] = []

function add(level: Finding["level"], name: string, detail: string) {
  findings.push({ level, name, detail })
  const icon = level === "pass" ? "PASS" : level === "warn" ? "WARN" : "FAIL"
  console.log(`[${icon}] ${name}: ${detail}`)
}

function requireUrl(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     )`,
    [tableName]
  )
  return result.rows[0]?.exists === true
}

async function getTableCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function auditCenterDatabase(pool: Pool) {
  console.log("\n=== Center Database ===")
  const db = await pool.query<{ current_database: string }>("SELECT current_database()")
  add("pass", "center database selected", db.rows[0]?.current_database ?? "unknown")

  const syncSitesExists = await tableExists(pool, "sync_sites")
  const sitesExists = await tableExists(pool, "sites")
  add(syncSitesExists ? "pass" : "fail", "sync_sites table", syncSitesExists ? "exists" : "missing")
  add(sitesExists ? "pass" : "warn", "sites business detail table", sitesExists ? "exists" : "missing")

  if (syncSitesExists) {
    const passwordColumn = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'sync_sites'
           AND column_name IN ('db_password', 'password')
       )`
    )
    add(
      passwordColumn.rows[0]?.exists ? "fail" : "pass",
      "sync_sites secret storage",
      passwordColumn.rows[0]?.exists
        ? "plain password column exists"
        : "no plain password column; use credential_ref"
    )

    const registered = await pool.query<{
      site_code: string
      enabled: boolean
      credential_ref: string | null
    }>(
      `SELECT site_code, enabled, credential_ref
       FROM sync_sites
       ORDER BY site_code`
    )
    add(
      registered.rowCount && registered.rowCount > 0 ? "pass" : "fail",
      "registered sites",
      `${registered.rowCount ?? 0} rows (${registered.rows.map((r) => r.site_code).join(", ") || "none"})`
    )

    const unsafeCredentialRefs = registered.rows.filter((r) =>
      !r.credential_ref || /postgres:|mysql:|:\/\/|=|;/.test(r.credential_ref)
    )
    add(
      unsafeCredentialRefs.length === 0 ? "pass" : "fail",
      "credential refs",
      unsafeCredentialRefs.length === 0
        ? "all credential_ref values are env/key references"
        : `unsafe refs: ${unsafeCredentialRefs.map((r) => r.site_code).join(", ")}`
    )
  }

  const observed = await pool.query<{
    site_code: string
    task_count: string
    device_count: string
    volume_count: string
    package_count: string
    registered: boolean
  }>(
    `WITH observed AS (
       SELECT source_site_id AS site_code, COUNT(*)::int AS task_count, 0::int AS device_count, 0::int AS volume_count, 0::int AS package_count
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
     SELECT
       o.site_code,
       SUM(o.task_count)::text AS task_count,
       SUM(o.device_count)::text AS device_count,
       SUM(o.volume_count)::text AS volume_count,
       SUM(o.package_count)::text AS package_count,
       (ss.site_code IS NOT NULL) AS registered
     FROM observed o
     LEFT JOIN sync_sites ss ON ss.site_code = o.site_code
     GROUP BY o.site_code, ss.site_code
     ORDER BY o.site_code`
  )

  const orphanSites = observed.rows.filter((r) => !r.registered)
  const nonTestOrphans = orphanSites.filter((r) => !TEST_SITE_PATTERN.test(r.site_code))
  add(
    nonTestOrphans.length === 0 ? "pass" : "fail",
    "unregistered non-test site data",
    nonTestOrphans.length === 0
      ? "none"
      : nonTestOrphans.map((r) => r.site_code).join(", ")
  )
  add(
    orphanSites.length === 0 ? "pass" : "warn",
    "unregistered test/historical site data",
    orphanSites.length === 0
      ? "none"
      : orphanSites.map((r) => `${r.site_code}(t=${r.task_count},d=${r.device_count},v=${r.volume_count},p=${r.package_count})`).join(", ")
  )

  const unifiedTables = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'unified_%'
     ORDER BY table_name`
  )
  add("pass", "center unified tables", `${unifiedTables.rowCount ?? 0} tables`)

  for (const table of ["unified_users", "unified_devices", "unified_tasks", "unified_platforms"]) {
    if (!(await tableExists(pool, table))) continue
    const clauses = SENSITIVE_RAW_KEYS.map((key, i) =>
      `COUNT(*) FILTER (WHERE raw_data ? $${i + 1} AND COALESCE(raw_data->>$${i + 1}, '') NOT IN ('', '[REDACTED]'))::int AS ${key}_count`
    ).join(", ")
    const result = await pool.query<Record<string, number>>( `SELECT ${clauses} FROM ${table}`, [...SENSITIVE_RAW_KEYS])
    const row = result.rows[0] ?? {}
    const leakedKeys = SENSITIVE_RAW_KEYS.filter((key) => Number(row[`${key}_count`] ?? 0) > 0)
    add(
      leakedKeys.length === 0 ? "pass" : "fail",
      `${table} raw_data sensitive keys`,
      leakedKeys.length === 0 ? "all empty or [REDACTED]" : leakedKeys.join(", ")
    )
  }
}

async function auditSiteDatabase(pool: Pool) {
  console.log("\n=== Site Database ===")
  const db = await pool.query<{ current_database: string }>("SELECT current_database()")
  add("pass", "site database selected", db.rows[0]?.current_database ?? "unknown")

  const tableCount = await getTableCount(pool)
  add(tableCount >= 100 ? "pass" : "warn", "site table count", `${tableCount} base tables`)

  const tableResult = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  )
  const tableSet = new Set(tableResult.rows.map((r) => r.table_name))
  const allowedPresent = ALLOWED_PACKAGE_TABLES.filter((name) => tableSet.has(name))
  const forbiddenPresent = FORBIDDEN_PACKAGE_TABLES.filter((name) => tableSet.has(name))
  const tblTables = tableResult.rows.map((r) => r.table_name).filter((name) => name.startsWith("tbl_"))
  const unclassifiedTblTables = tblTables.filter(
    (name) =>
      !ALLOWED_PACKAGE_TABLES.includes(name as (typeof ALLOWED_PACKAGE_TABLES)[number]) &&
      !FORBIDDEN_PACKAGE_TABLES.includes(name as (typeof FORBIDDEN_PACKAGE_TABLES)[number])
  )

  add(
    allowedPresent.length === ALLOWED_PACKAGE_TABLES.length ? "pass" : "warn",
    "package whitelist tables present",
    `${allowedPresent.length}/${ALLOWED_PACKAGE_TABLES.length}: ${allowedPresent.join(", ")}`
  )
  add(
    forbiddenPresent.length > 0 ? "pass" : "warn",
    "large table guard targets",
    forbiddenPresent.length > 0 ? forbiddenPresent.join(", ") : "tbl_file/tbl_folder not found in this site DB"
  )
  add(
    unclassifiedTblTables.length === 0 ? "pass" : "warn",
    "unclassified tbl_* tables",
    `${unclassifiedTblTables.length} tables not in PG whitelist or large-table guard`
  )
}

async function main() {
  console.log("=== Center DB Integrity Audit ===")
  console.log(`mode=${STRICT ? "strict" : "report"}`)

  const centerPool = new Pool({ connectionString: requireUrl("DATABASE_URL") })
  try {
    await auditCenterDatabase(centerPool)
  } finally {
    await centerPool.end()
  }

  if (process.env.SITE_DATABASE_URL) {
    const sitePool = new Pool({ connectionString: process.env.SITE_DATABASE_URL })
    try {
      await auditSiteDatabase(sitePool)
    } finally {
      await sitePool.end()
    }
  } else {
    add("warn", "SITE_DATABASE_URL", "not configured; skip 170-table site inventory")
  }

  const failures = findings.filter((f) => f.level === "fail")
  const warnings = findings.filter((f) => f.level === "warn")
  console.log(`\n=== Summary: ${findings.length} checks, ${failures.length} fail, ${warnings.length} warn ===`)

  if (STRICT && failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
