/**
 * scripts/audit/__tests__/matrix-round-source.ts
 * R.83.2 Task 7: Self-check that the `round` field in audit/center-db-matrix.json
 * is correctly derived from ALLOWED_PACKAGE_TABLES (whitelist position lookup)
 * with the docs round-tag override.
 *
 * Usage:
 *   set -a && source .env.local && set +a
 *   pnpm exec tsx scripts/audit/__tests__/matrix-round-source.ts
 *
 * Exits 0 only when all 12+ checks PASS.
 */

// R.83.2 source tables (singular form, as in ALLOWED_PACKAGE_TABLES)
// Unified mirror tables pluralize: e.g., unified_dicts ← tbl_dict
const R83_2_SOURCES = [
  "tbl_role",
  "tbl_role_fuc",
  "tbl_fuc",
  "tbl_dict_category",
  "tbl_dict",
  "tbl_dict_item",
  "tbl_sys_log",
  "tbl_api_log",
  "tbl_api_interface",
  "tbl_user_mfa",
  "tbl_archives_type",
  "tbl_archives_level",
  "tbl_platform_type",
  "tbl_credible_prove",
  "tbl_credible_verify",
]

const R83_1_SOURCES = [
  "tbl_user_role",
  "tbl_depa",
  "tbl_workspace",
  "tbl_workspace_user",
  "tbl_depa_user",
  "tbl_depa_user_info",
  "tbl_project",
  "tbl_project_site",
  "tbl_task_projects",
  "tbl_task_receipts",
  "tbl_task_files",
  "tbl_task_check",
  "tbl_receipt",
  "tbl_receipt_check",
  "tbl_receipt_file",
]

const ALREADY_SOURCES = [
  "tbl_task",
  "tbl_disc_lib",
  "tbl_magzines",
  "tbl_slots",
  "tbl_hd_info",
  "tbl_lib_task",
  "tbl_disc",
  "tbl_logical_volume",
  "tbl_volume_slot",
  "tbl_user_task",
  "tbl_user",
  "tbl_site",
  "tbl_platform",
]

// R.83.3 source tables (check inspection + patrol family)
const R83_3_SOURCES = [
  "tbl_check_category",
  "tbl_check_sub_category",
  "tbl_check_item",
  "tbl_check_sector",
  "tbl_check_template",
  "tbl_check_task",
  "tbl_check_task_item",
  "tbl_check_task_file",
  "tbl_check_file",
  "tbl_check_files",
  "tbl_check_log",
  "tbl_check_patrol_strategy",
  "tbl_check_patrol_task",
  "tbl_check_patrol_task_item",
  "tbl_check_patrol_log",
]

// R.83.4 source tables (storage volume + schedule + device business family)
const R83_4_SOURCES = [
  "tbl_volume_group",
  "tbl_volume_dataclass",
  "tbl_volume_depa",
  "tbl_volume_user",
  "tbl_volume_workspace",
  "tbl_schedule_job",
  "tbl_register_management",
  "tbl_interface_task",
  "tbl_hot_backup_record",
  "tbl_hot_restore_record",
  "tbl_device_device",
  "tbl_drivers",
  "tbl_drivers_burn",
  "tbl_raid_group",
  "tbl_hd_manager",
]

// R.83.5 source tables (data receive + early-warning + disc print media +
// evidence/verify + download/upload transfer family)
const R83_5_SOURCES = [
  "tbl_data_receive_list",
  "tbl_data_receive_log",
  "tbl_data_receive_tasks",
  "tbl_data_classification",
  "tbl_early_warning",
  "tbl_early_warning_feedback",
  "tbl_disc_print",
  "tbl_disc_inspect",
  "tbl_disc_type",
  "tbl_evidence_details",
  "tbl_evidence_record_drp",
  "tbl_verify_details",
  "tbl_verify_record_drp",
  "tbl_download_record",
  "tbl_upload_record",
]

// R.83.6 source tables (ISO + meta + system family)
const R83_6_SOURCES = [
  "tbl_iso_location",
  "tbl_iso_task_sync",
  "tbl_meta_data",
  "tbl_sys",
  "tbl_sys_env",
  "tbl_mount_dir",
  "tbl_buffer_dir",
  "tbl_cd_cabinet",
  "tbl_film_operat",
  "tbl_ft_file",
  "tbl_ft_sys",
  "tbl_back_window",
  "tbl_zip_file",
  "tbl_temp_slots",
  "tbl_lib_group",
]

// R.83.7 source tables (import/export + monitor + system-aux family)
const R83_7_SOURCES = [
  "tbl_csv_details",
  "tbl_import_folder_data",
  "tbl_import_folder_log",
  "tbl_import_folder_title",
  "tbl_upload_details",
  "tbl_download_details",
  "tbl_export_info",
  "tbl_error_rate",
  "tbl_escape",
  "tbl_remote_backup",
  "tbl_monitor_path",
  "tbl_platform_monitor",
  "tbl_site_monitor",
  "tbl_project_monitor_files",
  "tbl_task_folder",
]

// R.83.8 source tables (task detail + slot file/folder family)
const R83_8_SOURCES = [
  "tbl_task_items",
  "tbl_task_print",
  "tbl_task_certif_status",
  "tbl_slot_file_1000000",
  "tbl_slot_file_12",
  "tbl_slot_file_13",
  "tbl_slot_file_15",
  "tbl_slot_file_30",
  "tbl_slot_file_31",
  "tbl_slot_folder_1000000",
  "tbl_slot_folder_12",
  "tbl_slot_folder_13",
  "tbl_slot_folder_15",
  "tbl_slot_folder_30",
  "tbl_slot_folder_31",
]

interface MatrixEntry {
  unified_table: string
  source_table: string
  classification: string
  blocker: string
  round: string
}

interface MatrixJson {
  generatedAt: string
  unifiedCount: number
  entries: MatrixEntry[]
}

import { execSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

let pass = 0
let fail = 0
const failures: string[] = []

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++
    console.log(`[PASS] ${name}${detail ? `: ${detail}` : ""}`)
  } else {
    fail++
    failures.push(name)
    console.log(`[FAIL] ${name}${detail ? `: ${detail}` : ""}`)
  }
}

const matrixPath = resolve(process.cwd(), "audit/center-db-matrix.json")

// Step 1: Run pnpm audit:center-db -- --strict --matrix
console.log("\n=== Step 1: Run pnpm audit:center-db -- --strict --matrix ===")
try {
  const out = execSync("pnpm audit:center-db -- --strict --matrix", {
    stdio: "pipe",
    encoding: "utf8",
  })
  console.log(out)
} catch (err) {
  const e = err as { stdout?: string; stderr?: string; status?: number }
  if (e.stdout) console.log(e.stdout)
  if (e.stderr) console.error(e.stderr)
  // Some "fail" exit codes are expected (e.g., data pollution). Continue.
  console.log(`(audit exited with code ${e.status ?? "?"} — continuing to read matrix JSON)`)
}

// Step 2: Read matrix JSON
console.log("\n=== Step 2: Read audit/center-db-matrix.json ===")
check("matrix JSON file exists", existsSync(matrixPath), matrixPath)

if (!existsSync(matrixPath)) {
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL`)
  process.exit(1)
}

let matrix: MatrixJson
try {
  matrix = JSON.parse(readFileSync(matrixPath, "utf8")) as MatrixJson
  check("matrix JSON valid", true)
} catch (err) {
  check("matrix JSON valid", false, String(err))
  console.log(`\nSummary: ${pass} PASS, ${fail} FAIL`)
  process.exit(1)
}

// Step 3: Run the 12 checks
console.log("\n=== Step 3: Validate round derivation ===")

// Check 1: unifiedCount >= 133 (13 already + 15 R.83.1 + 15 R.83.2 + 15 R.83.3 + 15 R.83.4 + 15 R.83.5 + 15 R.83.6 + 15 R.83.7 + 15 R.83.8)
check(
  "unifiedCount >= 133",
  matrix.unifiedCount >= 133,
  `unifiedCount=${matrix.unifiedCount}`
)

// Check 2: All 15 R.83.2 entries that EXIST in the matrix have round === "R.83.2"
const r83_2_missing: string[] = []
let r83_2_present = 0
for (const src of R83_2_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue // source not yet implemented as unified_* in DB
  r83_2_present++
  if (e.round !== "R.83.2") {
    r83_2_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.2 round tag (15 sources)",
  r83_2_missing.length === 0 && r83_2_present === 15,
  r83_2_missing.length === 0
    ? `all ${r83_2_present} R.83.2 sources present in matrix tagged "R.83.2"`
    : `missing/wrong: ${r83_2_missing.join(", ")}`
)

// Check 3: All 15 R.83.1 entries that EXIST in the matrix have round === "R.83.1"
const r83_1_missing: string[] = []
let r83_1_present = 0
for (const src of R83_1_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_1_present++
  if (e.round !== "R.83.1") {
    r83_1_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.1 round tag (15 sources)",
  r83_1_missing.length === 0 && r83_1_present === 15,
  r83_1_missing.length === 0
    ? `all ${r83_1_present} R.83.1 sources present in matrix tagged "R.83.1"`
    : `missing/wrong: ${r83_1_missing.join(", ")}`
)

// Check 4: All present Sprint 2E.2 entries have round === "already"
const already_missing: string[] = []
let already_present = 0
for (const src of ALREADY_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  already_present++
  if (e.round !== "already") {
    already_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "already (2E.2 baseline) round tag",
  already_missing.length === 0,
  already_missing.length === 0
    ? `all ${already_present} baseline sources in matrix tagged "already"`
    : `missing/wrong: ${already_missing.join(", ")}`
)

// Check 5: tbl_platform_type has round === "R.83.2"
{
  const e = matrix.entries.find((x) => x.source_table === "tbl_platform_type")
  check(
    "tbl_platform_type round = R.83.2",
    !!e && e.round === "R.83.2",
    e ? `round=${e.round}` : "entry not found"
  )
}

// Check 6: tbl_role_fuc (composite PK) has round === "R.83.2"
{
  const e = matrix.entries.find((x) => x.source_table === "tbl_role_fuc")
  check(
    "tbl_role_fuc (composite PK) round = R.83.2",
    !!e && e.round === "R.83.2",
    e ? `round=${e.round}` : "entry not found"
  )
}

// Check 7: entries.length === unifiedCount
check(
  "entries.length === unifiedCount",
  matrix.entries.length === matrix.unifiedCount,
  `entries=${matrix.entries.length}, unifiedCount=${matrix.unifiedCount}`
)

// Check 8: No entry has round === "R.83.2+"
const r83_2plus = matrix.entries.filter((e) => e.round === "R.83.2+")
check(
  "no entry has round = R.83.2+",
  r83_2plus.length === 0,
  r83_2plus.length === 0
    ? "no R.83.2+ entries (all 88 whitelisted sources have specific round)"
    : `still tagged R.83.2+: ${r83_2plus.map((e) => e.source_table).join(", ")}`
)

// Check 9: All 15 R.83.2 source names appear in entries[*].source_table
const sourceTableSet = new Set(matrix.entries.map((e) => e.source_table))
const r83_2_absent = R83_2_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.2 source names present in entries",
  r83_2_absent.length === 0,
  r83_2_absent.length === 0
    ? "all 15 R.83.2 source names found"
    : `missing: ${r83_2_absent.join(", ")}`
)

// Check 10 (bonus): generatedAt is a valid ISO string
{
  const ts = Date.parse(matrix.generatedAt)
  check(
    "generatedAt is valid ISO timestamp",
    !Number.isNaN(ts),
    `generatedAt=${matrix.generatedAt}`
  )
}

// Check 11 (bonus): all whitelisted sources that EXIST in the matrix have a specific round
{
  const all133 = [...R83_8_SOURCES, ...R83_7_SOURCES, ...R83_6_SOURCES, ...R83_5_SOURCES, ...R83_4_SOURCES, ...R83_3_SOURCES, ...R83_2_SOURCES, ...R83_1_SOURCES, ...ALREADY_SOURCES]
  const wrong: string[] = []
  for (const src of all133) {
    const e = matrix.entries.find((x) => x.source_table === src)
    if (!e) continue // not implemented yet
    if (!["already", "R.83.1", "R.83.2", "R.83.3", "R.83.4", "R.83.5", "R.83.6", "R.83.7", "R.83.8"].includes(e.round)) {
      wrong.push(`${src}=${e.round}`)
    }
  }
  check(
    "all whitelisted sources in matrix have specific round",
    wrong.length === 0,
    wrong.length === 0
      ? "all whitelisted sources present in matrix tagged already/R.83.1/R.83.2/R.83.3/R.83.4/R.83.5/R.83.6/R.83.7/R.83.8"
      : `unexpected: ${wrong.join(", ")}`
  )
}

// Check 12 (bonus): non-whitelisted unified_* tables all have round = R.83.9+
{
  const all133 = new Set([...R83_8_SOURCES, ...R83_7_SOURCES, ...R83_6_SOURCES, ...R83_5_SOURCES, ...R83_4_SOURCES, ...R83_3_SOURCES, ...R83_2_SOURCES, ...R83_1_SOURCES, ...ALREADY_SOURCES])
  const nonWhitelisted = matrix.entries.filter((e) => !all133.has(e.source_table))
  const wrongDefault = nonWhitelisted.filter((e) => e.round !== "R.83.9+")
  check(
    "non-whitelisted unified tables tagged R.83.9+",
    wrongDefault.length === 0,
    wrongDefault.length === 0
      ? `${nonWhitelisted.length} non-whitelisted sources all tagged R.83.9+`
      : `unexpected: ${wrongDefault.map((e) => `${e.source_table}=${e.round}`).join(", ")}`
  )
}

// Check 13 (bonus): all 15 R.83.3 sources that EXIST in the matrix have round === "R.83.3"
const r83_3_missing: string[] = []
let r83_3_present = 0
for (const src of R83_3_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_3_present++
  if (e.round !== "R.83.3") {
    r83_3_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.3 round tag (15 sources)",
  r83_3_missing.length === 0 && r83_3_present === 15,
  r83_3_missing.length === 0
    ? `all ${r83_3_present} R.83.3 sources present in matrix tagged "R.83.3"`
    : `missing/wrong: ${r83_3_missing.join(", ")}`
)

// Check 14 (bonus): all 15 R.83.3 source names appear in entries[*].source_table
const r83_3_absent = R83_3_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.3 source names present in entries",
  r83_3_absent.length === 0,
  r83_3_absent.length === 0
    ? "all 15 R.83.3 source names found"
    : `missing: ${r83_3_absent.join(", ")}`
)

// Check 15 (bonus): all 15 R.83.4 sources that EXIST in the matrix have round === "R.83.4"
const r83_4_missing: string[] = []
let r83_4_present = 0
for (const src of R83_4_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_4_present++
  if (e.round !== "R.83.4") {
    r83_4_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.4 round tag (15 sources)",
  r83_4_missing.length === 0 && r83_4_present === 15,
  r83_4_missing.length === 0
    ? `all ${r83_4_present} R.83.4 sources present in matrix tagged "R.83.4"`
    : `missing/wrong: ${r83_4_missing.join(", ")}`
)

// Check 16 (bonus): all 15 R.83.4 source names appear in entries[*].source_table
const r83_4_absent = R83_4_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.4 source names present in entries",
  r83_4_absent.length === 0,
  r83_4_absent.length === 0
    ? "all 15 R.83.4 source names found"
    : `missing: ${r83_4_absent.join(", ")}`
)

// Check 17 (bonus): all 15 R.83.5 sources that EXIST in the matrix have round === "R.83.5"
const r83_5_missing: string[] = []
let r83_5_present = 0
for (const src of R83_5_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_5_present++
  if (e.round !== "R.83.5") {
    r83_5_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.5 round tag (15 sources)",
  r83_5_missing.length === 0 && r83_5_present === 15,
  r83_5_missing.length === 0
    ? `all ${r83_5_present} R.83.5 sources present in matrix tagged "R.83.5"`
    : `missing/wrong: ${r83_5_missing.join(", ")}`
)

// Check 18 (bonus): all 15 R.83.5 source names appear in entries[*].source_table
const r83_5_absent = R83_5_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.5 source names present in entries",
  r83_5_absent.length === 0,
  r83_5_absent.length === 0
    ? "all 15 R.83.5 source names found"
    : `missing: ${r83_5_absent.join(", ")}`
)

// Check 19 (bonus): all 15 R.83.6 sources that EXIST in the matrix have round === "R.83.6"
const r83_6_missing: string[] = []
let r83_6_present = 0
for (const src of R83_6_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_6_present++
  if (e.round !== "R.83.6") {
    r83_6_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.6 round tag (15 sources)",
  r83_6_missing.length === 0 && r83_6_present === 15,
  r83_6_missing.length === 0
    ? `all ${r83_6_present} R.83.6 sources present in matrix tagged "R.83.6"`
    : `missing/wrong: ${r83_6_missing.join(", ")}`
)

// Check 20 (bonus): all 15 R.83.6 source names appear in entries[*].source_table
const r83_6_absent = R83_6_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.6 source names present in entries",
  r83_6_absent.length === 0,
  r83_6_absent.length === 0
    ? "all 15 R.83.6 source names found"
    : `missing: ${r83_6_absent.join(", ")}`
)

// Check 21 (bonus): all 15 R.83.7 sources that EXIST in the matrix have round === "R.83.7"
const r83_7_missing: string[] = []
let r83_7_present = 0
for (const src of R83_7_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_7_present++
  if (e.round !== "R.83.7") {
    r83_7_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.7 round tag (15 sources)",
  r83_7_missing.length === 0 && r83_7_present === 15,
  r83_7_missing.length === 0
    ? `all ${r83_7_present} R.83.7 sources present in matrix tagged "R.83.7"`
    : `missing/wrong: ${r83_7_missing.join(", ")}`
)

// Check 22 (bonus): all 15 R.83.7 source names appear in entries[*].source_table
const r83_7_absent = R83_7_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.7 source names present in entries",
  r83_7_absent.length === 0,
  r83_7_absent.length === 0
    ? "all 15 R.83.7 source names found"
    : `missing: ${r83_7_absent.join(", ")}`
)

// Check 23 (bonus): all 15 R.83.8 sources that EXIST in the matrix have round === "R.83.8"
const r83_8_missing: string[] = []
let r83_8_present = 0
for (const src of R83_8_SOURCES) {
  const e = matrix.entries.find((x) => x.source_table === src)
  if (!e) continue
  r83_8_present++
  if (e.round !== "R.83.8") {
    r83_8_missing.push(`${src} (got: ${e.round})`)
  }
}
check(
  "r83.8 round tag (15 sources)",
  r83_8_missing.length === 0 && r83_8_present === 15,
  r83_8_missing.length === 0
    ? `all ${r83_8_present} R.83.8 sources present in matrix tagged "R.83.8"`
    : `missing/wrong: ${r83_8_missing.join(", ")}`
)

// Check 24 (bonus): all 15 R.83.8 source names appear in entries[*].source_table
const r83_8_absent = R83_8_SOURCES.filter((s) => !sourceTableSet.has(s))
check(
  "15 R.83.8 source names present in entries",
  r83_8_absent.length === 0,
  r83_8_absent.length === 0
    ? "all 15 R.83.8 source names found"
    : `missing: ${r83_8_absent.join(", ")}`
)

console.log(`\n=== Summary: ${pass} PASS, ${fail} FAIL ===`)
if (fail > 0) {
  console.log(`Failed checks: ${failures.join(", ")}`)
  process.exit(1)
}
process.exit(0)
