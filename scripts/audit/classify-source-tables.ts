/**
 * R.84 source table classification audit
 *
 * Reads the live site DB table list and compares it against the R.84
 * decision matrix in `docs/database-analysis/r84-source-table-classification.md`.
 *
 * Exit codes:
 *   0 - all 170 tables classified, needs_decision = 0
 *   2 - missing classification or needs_decision > 0 (R.84 fail)
 *
 * Usage:
 *   pnpm tsx scripts/audit/classify-source-tables.ts
 */

import { Pool } from "pg"

interface Classification {
  sourceTable: string
  category:
    | "pg_unified"
    | "file_index_es"
    | "site_control"
    | "source_only"
    | "deprecated_or_empty"
    | "needs_decision"
  target: string
  reason: string
  requirement: string
  owner: string
}

// Mirror of ALLOWED_PACKAGE_TABLES in lib/sync/package-schema.ts (R.83.9)
const PG_UNIFIED: Classification[] = [
  "tbl_task", "tbl_disc_lib", "tbl_magzines", "tbl_slots", "tbl_hd_info",
  "tbl_lib_task", "tbl_disc", "tbl_logical_volume", "tbl_volume_slot", "tbl_user_task",
  "tbl_user", "tbl_site", "tbl_platform",
  "tbl_user_role", "tbl_depa", "tbl_workspace", "tbl_workspace_user",
  "tbl_depa_user", "tbl_depa_user_info", "tbl_project", "tbl_project_site",
  "tbl_task_projects", "tbl_task_receipts", "tbl_task_files", "tbl_task_check",
  "tbl_receipt", "tbl_receipt_check", "tbl_receipt_file",
  "tbl_role", "tbl_role_fuc", "tbl_fuc", "tbl_dict_category", "tbl_dict",
  "tbl_dict_item", "tbl_sys_log", "tbl_api_log", "tbl_api_interface",
  "tbl_user_mfa", "tbl_archives_type", "tbl_archives_level", "tbl_platform_type",
  "tbl_credible_prove", "tbl_credible_verify",
  "tbl_check_category", "tbl_check_sub_category", "tbl_check_item",
  "tbl_check_sector", "tbl_check_template", "tbl_check_task",
  "tbl_check_task_item", "tbl_check_task_file", "tbl_check_file",
  "tbl_check_files", "tbl_check_log", "tbl_check_patrol_strategy",
  "tbl_check_patrol_task", "tbl_check_patrol_task_item",
  "tbl_check_patrol_log",
  "tbl_volume_group", "tbl_volume_dataclass", "tbl_volume_depa",
  "tbl_volume_user", "tbl_volume_workspace", "tbl_schedule_job",
  "tbl_register_management", "tbl_interface_task", "tbl_hot_backup_record",
  "tbl_hot_restore_record", "tbl_device_device", "tbl_drivers",
  "tbl_drivers_burn", "tbl_raid_group", "tbl_hd_manager",
  "tbl_data_receive_list", "tbl_data_receive_log", "tbl_data_receive_tasks",
  "tbl_data_classification", "tbl_early_warning", "tbl_early_warning_feedback",
  "tbl_disc_print", "tbl_disc_inspect", "tbl_disc_type",
  "tbl_evidence_details", "tbl_evidence_record_drp",
  "tbl_verify_details", "tbl_verify_record_drp",
  "tbl_download_record", "tbl_upload_record",
  "tbl_iso_location", "tbl_iso_task_sync", "tbl_meta_data", "tbl_sys",
  "tbl_sys_env", "tbl_mount_dir", "tbl_buffer_dir", "tbl_cd_cabinet",
  "tbl_film_operat", "tbl_ft_file", "tbl_ft_sys", "tbl_back_window",
  "tbl_zip_file", "tbl_temp_slots", "tbl_lib_group",
  "tbl_csv_details", "tbl_import_folder_data", "tbl_import_folder_log",
  "tbl_import_folder_title", "tbl_upload_details", "tbl_download_details",
  "tbl_export_info", "tbl_error_rate", "tbl_escape", "tbl_remote_backup",
  "tbl_monitor_path", "tbl_platform_monitor", "tbl_site_monitor",
  "tbl_project_monitor_files", "tbl_task_folder",
  "tbl_task_items", "tbl_task_print", "tbl_task_certif_status",
  "tbl_slot_file_1000000", "tbl_slot_file_12", "tbl_slot_file_13",
  "tbl_slot_file_15", "tbl_slot_file_30", "tbl_slot_file_31",
  "tbl_slot_folder_1000000", "tbl_slot_folder_12", "tbl_slot_folder_13",
  "tbl_slot_folder_15", "tbl_slot_folder_30", "tbl_slot_folder_31",
  "tbl_backup_db", "tbl_disk_check", "tbl_diskfile_check", "tbl_hd_power",
  "tbl_receipt_file_detail", "tbl_slots_part", "tbl_wait_download_file",
  "tbl_wait_download_file_task",
].map((table) => ({
  sourceTable: table,
  category: "pg_unified" as const,
  target: `unified_${table}`,
  reason: "R.83 dispatcher",
  requirement: "§2.3",
  owner: "platform",
}))

const FILE_INDEX_ES: Classification[] = [
  "tbl_file",
  "tbl_folder",
  "tbl_file_1", "tbl_file_1_a", "tbl_file_1_empty", "tbl_file_1_error", "tbl_file_1_repeat",
  "tbl_file_2", "tbl_file_2_a", "tbl_file_2_empty", "tbl_file_2_error", "tbl_file_2_repeat",
  "tbl_file_3", "tbl_file_3_a", "tbl_file_3_empty", "tbl_file_3_error", "tbl_file_3_repeat",
  "tbl_file_10000", "tbl_file_10001", "tbl_file_10002",
  "tbl_file_parts", "tbl_file_path_archive", "tbl_file_path_restore",
  "tbl_file_recover_info", "tbl_file_stat",
  "tbl_folder_1", "tbl_folder_2", "tbl_folder_3", "tbl_folder_10000",
].map((table) => ({
  sourceTable: table,
  category: "file_index_es" as const,
  target: "OpenSearch/ES disc_file_index",
  reason: "large file/folder index; PG full sync forbidden",
  requirement: "§5.2",
  owner: "platform",
}))

const CLASSIFICATION: Classification[] = [...PG_UNIFIED, ...FILE_INDEX_ES]
const CLASSIFICATION_INDEX = new Map(
  CLASSIFICATION.map((entry) => [entry.sourceTable, entry])
)

const ALLOWED_CATEGORIES: ReadonlySet<Classification["category"]> = new Set([
  "pg_unified",
  "file_index_es",
  "site_control",
  "source_only",
  "deprecated_or_empty",
])

function requireUrl(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

async function main() {
  console.log("=== R.84 source classification ===")
  const pool = new Pool({ connectionString: requireUrl("SITE_DATABASE_URL") })
  try {
    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )
    const siteTables = result.rows.map((r) => r.table_name)

    const counts: Record<Classification["category"], number> = {
      pg_unified: 0,
      file_index_es: 0,
      site_control: 0,
      source_only: 0,
      deprecated_or_empty: 0,
      needs_decision: 0,
    }
    const missing: string[] = []
    const needsDecision: string[] = []
    const classifiedTables = new Set<string>()

    for (const table of siteTables) {
      const entry = CLASSIFICATION_INDEX.get(table)
      if (!entry) {
        // Any table not classified must be escalated to needs_decision
        needsDecision.push(table)
        counts.needs_decision++
        continue
      }
      counts[entry.category]++
      classifiedTables.add(table)
    }

    // Detect orphans in classification that no longer exist in the live site DB
    const orphans = CLASSIFICATION.filter((c) => !siteTables.includes(c.sourceTable))

    console.log(`classified=${siteTables.length - needsDecision.length}`)
    console.log(`needs_decision=${needsDecision.length}`)
    console.log(`pg_unified=${counts.pg_unified}`)
    console.log(`file_index_es=${counts.file_index_es}`)
    console.log(`site_control=${counts.site_control}`)
    console.log(`source_only=${counts.source_only}`)
    console.log(`deprecated_or_empty=${counts.deprecated_or_empty}`)
    console.log(`orphan_in_matrix=${orphans.length}`)

    if (needsDecision.length > 0) {
      console.log("\nNEEDS DECISION:")
      for (const t of needsDecision) console.log(`  - ${t}`)
    }
    if (orphans.length > 0) {
      console.log("\nORPHAN IN MATRIX (no longer in live site DB):")
      for (const o of orphans) console.log(`  - ${o.sourceTable}`)
    }

    const ok =
      needsDecision.length === 0 &&
      missing.length === 0 &&
      counts.pg_unified === PG_UNIFIED.length &&
      counts.file_index_es === FILE_INDEX_ES.length

    if (!ok) {
      console.log("\n[FAIL] R.84 classification mismatch")
      process.exit(2)
    }
    console.log("\n[PASS] R.84 classification complete")
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("R.84 classification crashed:", err)
  process.exit(2)
})
