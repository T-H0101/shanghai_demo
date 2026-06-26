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
const MATRIX = process.argv.includes("--matrix")
const MATRIX_DOC = "docs/database-analysis/r83-170-table-governance-matrix.md"
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

  // R.83.1: --matrix 产出统一表清单到 JSON
  if (MATRIX) {
    const matrixPool = new Pool({ connectionString: requireUrl("DATABASE_URL") })
    try {
      const matrixResult = await matrixPool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name LIKE 'unified\\_%' ESCAPE '\\'
         ORDER BY table_name`
      )
      const unified = matrixResult.rows.map((r) => r.table_name)
      const fs = await import("fs/promises")
      let docRef = "(missing matrix doc)"
      try {
        docRef = await fs.readFile(MATRIX_DOC, "utf-8")
      } catch {
        // doc not yet generated; emit warning
      }
      // R.83.2: derive round from canonical ALLOWED_PACKAGE_TABLES (whitelist position lookup)
      // + docs round-tag override (manual corrections in governance matrix take priority)
      const ROUND_BY_SOURCE: Record<string, string> = {}
      ALLOWED_PACKAGE_TABLES.forEach((src, i) => {
        if (i < 13) ROUND_BY_SOURCE[src] = "already"
        else if (i < 28) ROUND_BY_SOURCE[src] = "R.83.1"
        else if (i < 43) ROUND_BY_SOURCE[src] = "R.83.2"
        else if (i < 58) ROUND_BY_SOURCE[src] = "R.83.3"
        else if (i < 73) ROUND_BY_SOURCE[src] = "R.83.4"
        else if (i < 88) ROUND_BY_SOURCE[src] = "R.83.5"
      })

      // R.83.5 irregular plural / rename overrides (data + warning + media family)
      if (ROUND_BY_SOURCE["tbl_data_receive_list"]) ROUND_BY_SOURCE["tbl_data_receive_list"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_data_receive_log"]) ROUND_BY_SOURCE["tbl_data_receive_log"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_data_receive_tasks"]) ROUND_BY_SOURCE["tbl_data_receive_tasks"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_data_classification"]) ROUND_BY_SOURCE["tbl_data_classification"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_early_warning"]) ROUND_BY_SOURCE["tbl_early_warning"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_early_warning_feedback"]) ROUND_BY_SOURCE["tbl_early_warning_feedback"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_disc_print"]) ROUND_BY_SOURCE["tbl_disc_print"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_disc_inspect"]) ROUND_BY_SOURCE["tbl_disc_inspect"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_disc_type"]) ROUND_BY_SOURCE["tbl_disc_type"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_evidence_record_drp"]) ROUND_BY_SOURCE["tbl_evidence_record_drp"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_verify_record_drp"]) ROUND_BY_SOURCE["tbl_verify_record_drp"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_download_record"]) ROUND_BY_SOURCE["tbl_download_record"] = "R.83.5"
      if (ROUND_BY_SOURCE["tbl_upload_record"]) ROUND_BY_SOURCE["tbl_upload_record"] = "R.83.5"

      // Map each known unified_* table to its canonical singular source table
      // (as it appears in ALLOWED_PACKAGE_TABLES). Some unified names are
      // irregular plurals or rename to a different stem (e.g. unified_departments
      // ← tbl_depa), so this map is built explicitly.
      const UNIFIED_TO_SOURCE: Record<string, string> = {}
      for (const src of ALLOWED_PACKAGE_TABLES) {
        const stem = src.replace(/^tbl_/, "")
        // Convention: unified_<stem> and unified_<stem>s are the typical variants
        UNIFIED_TO_SOURCE[`unified_${stem}`] = src
        UNIFIED_TO_SOURCE[`unified_${stem}s`] = src
      }
      // Explicit overrides for irregular plurals / renames observed in the DDL
      const IRREGULAR_UNIFIED_TO_SOURCE: Record<string, string> = {
        unified_departments: "tbl_depa",
        unified_department_users: "tbl_depa_user",
        unified_department_user_info: "tbl_depa_user_info",
        unified_dict_categories: "tbl_dict_category",
        unified_credible_verifies: "tbl_credible_verify",
        unified_dict_items: "tbl_dict_item",
        // R.83.3 irregular check_* plurals
        unified_check_categories: "tbl_check_category",
        unified_check_sub_categories: "tbl_check_sub_category",
        unified_check_patrol_strategies: "tbl_check_patrol_strategy",
        // R.83.4 irregular plural mappings (volume_*, register_*, drivers_burn)
        unified_volume_dataclasses: "tbl_volume_dataclass",
        unified_volume_depas: "tbl_volume_depa",
        unified_volume_users: "tbl_volume_user",
        unified_volume_workspaces: "tbl_volume_workspace",
        unified_register_managements: "tbl_register_management",
        unified_drivers_burns: "tbl_drivers_burn",
      }
      for (const [u, s] of Object.entries(IRREGULAR_UNIFIED_TO_SOURCE)) {
        UNIFIED_TO_SOURCE[u] = s
      }

      // Doc round-tag override: match lines like
      //   | 1 | tbl_dict | 16 kB | pg17_small | unified_dict | none | R.83.2+ | note |
      // Capture the source table (col 2) and round tag (col 7).
      const ROUND_TAG_RE =
        /\|\s*\d+\s*\|\s*(\w+)\s*\|.*?\|\s*(R\.\d+(\.\d+)?|already|deferred|never)\s*\|/
      const docRoundBySource = new Map<string, string>()
      for (const line of docRef.split("\n")) {
        const m = line.match(ROUND_TAG_RE)
        if (m && m[1] && m[2]) {
          docRoundBySource.set(m[1], m[2])
        }
      }

      const entries = unified.map((t) => {
        const src = UNIFIED_TO_SOURCE[t] ?? t.replace(/^unified_/, "tbl_")
        const round = docRoundBySource.get(src) ?? ROUND_BY_SOURCE[src] ?? "R.83.6+"
        return {
          unified_table: t,
          source_table: src,
          classification: "pg17_small",
          blocker: "none",
          round,
        }
      })
      await fs.mkdir("audit", { recursive: true })
      await fs.writeFile(
        "audit/center-db-matrix.json",
        JSON.stringify(
          { generatedAt: new Date().toISOString(), unifiedCount: unified.length, entries },
          null,
          2
        )
      )
      add(
        unified.length >= 28 ? "pass" : "warn",
        "matrix JSON written",
        `audit/center-db-matrix.json (${entries.length} unified tables)`
      )
      add(
        unified.length >= 28 ? "pass" : "warn",
        "unified table count",
        `${unified.length} unified_* tables (target ≥28)`
      )
    } finally {
      await matrixPool.end()
    }
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
