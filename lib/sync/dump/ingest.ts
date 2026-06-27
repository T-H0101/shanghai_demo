/**
 * lib/sync/dump/ingest.ts
 * Sprint R.55 — ingest a parsed pg_dump `table_backup.sql` into center
 * `unified_*` tables via the existing package dispatcher.
 *
 * Reuses the same logging/dispatching as the JSON package path so that
 * the center has one ingestion audit trail regardless of transport.
 */

import { parsePgDumpCopyTables } from "./parser"
import {
  DUMP_ALLOWED_TABLES,
  type DumpAllowedTable,
} from "./manifest"
import {
  createPackageLog,
  createTableLog,
  markPackageSuccess,
  markPackageFailed,
  markTableSuccess,
  markTableFailed,
} from "@/lib/sync/package-log"
import { dispatchTable } from "@/lib/sync/package-dispatcher"

export interface IngestPgDumpInput {
  siteCode: string
  sql: string
  batchId: string
  mode: "full" | "incremental"
}

export interface IngestPgDumpResult {
  batchId: string
  siteCode: string
  packageLogId: string
  accepted: { tableName: DumpAllowedTable; rows: number }[]
  rejected: { tableName: string; reason: string }[]
}

const TABLE_MAPPING: Record<DumpAllowedTable, string> = {
  // Sprint 2E.2 baseline (13)
  tbl_task: "tbl_task",
  tbl_disc_lib: "tbl_disc_lib",
  tbl_magzines: "tbl_magzines",
  tbl_slots: "tbl_slots",
  tbl_hd_info: "tbl_hd_info",
  tbl_lib_task: "tbl_lib_task",
  tbl_disc: "tbl_disc",
  tbl_logical_volume: "tbl_logical_volume",
  tbl_volume_slot: "tbl_volume_slot",
  tbl_user_task: "tbl_user_task",
  tbl_user: "tbl_user",
  tbl_site: "tbl_site",
  tbl_platform: "tbl_platform",
  // R.83.1 部门/项目/任务接收单 15 张
  tbl_user_role: "tbl_user_role",
  tbl_depa: "tbl_depa",
  tbl_workspace: "tbl_workspace",
  tbl_workspace_user: "tbl_workspace_user",
  tbl_depa_user: "tbl_depa_user",
  tbl_depa_user_info: "tbl_depa_user_info",
  tbl_project: "tbl_project",
  tbl_project_site: "tbl_project_site",
  tbl_task_projects: "tbl_task_projects",
  tbl_task_receipts: "tbl_task_receipts",
  tbl_task_files: "tbl_task_files",
  tbl_task_check: "tbl_task_check",
  tbl_receipt: "tbl_receipt",
  tbl_receipt_check: "tbl_receipt_check",
  tbl_receipt_file: "tbl_receipt_file",
  // R.83.2 RBAC + 字典 + 日志 + 凭据 15 张
  tbl_role: "tbl_role",
  tbl_role_fuc: "tbl_role_fuc",
  tbl_fuc: "tbl_fuc",
  tbl_dict_category: "tbl_dict_category",
  tbl_dict: "tbl_dict",
  tbl_dict_item: "tbl_dict_item",
  tbl_sys_log: "tbl_sys_log",
  tbl_api_log: "tbl_api_log",
  tbl_api_interface: "tbl_api_interface",
  tbl_user_mfa: "tbl_user_mfa",
  tbl_archives_type: "tbl_archives_type",
  tbl_archives_level: "tbl_archives_level",
  tbl_platform_type: "tbl_platform_type",
  tbl_credible_prove: "tbl_credible_prove",
  tbl_credible_verify: "tbl_credible_verify",
  // R.83.3 检查巡检族 15 张
  tbl_check_category: "tbl_check_category",
  tbl_check_sub_category: "tbl_check_sub_category",
  tbl_check_item: "tbl_check_item",
  tbl_check_sector: "tbl_check_sector",
  tbl_check_template: "tbl_check_template",
  tbl_check_task: "tbl_check_task",
  tbl_check_task_item: "tbl_check_task_item",
  tbl_check_task_file: "tbl_check_task_file",
  tbl_check_file: "tbl_check_file",
  tbl_check_files: "tbl_check_files",
  tbl_check_log: "tbl_check_log",
  tbl_check_patrol_strategy: "tbl_check_patrol_strategy",
  tbl_check_patrol_task: "tbl_check_patrol_task",
  tbl_check_patrol_task_item: "tbl_check_patrol_task_item",
  tbl_check_patrol_log: "tbl_check_patrol_log",
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  tbl_volume_group: "tbl_volume_group",
  tbl_volume_dataclass: "tbl_volume_dataclass",
  tbl_volume_depa: "tbl_volume_depa",
  tbl_volume_user: "tbl_volume_user",
  tbl_volume_workspace: "tbl_volume_workspace",
  tbl_schedule_job: "tbl_schedule_job",
  tbl_register_management: "tbl_register_management",
  tbl_interface_task: "tbl_interface_task",
  tbl_hot_backup_record: "tbl_hot_backup_record",
  tbl_hot_restore_record: "tbl_hot_restore_record",
  tbl_device_device: "tbl_device_device",
  tbl_drivers: "tbl_drivers",
  tbl_drivers_burn: "tbl_drivers_burn",
  tbl_raid_group: "tbl_raid_group",
  tbl_hd_manager: "tbl_hd_manager",
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  tbl_data_receive_list: "tbl_data_receive_list",
  tbl_data_receive_log: "tbl_data_receive_log",
  tbl_data_receive_tasks: "tbl_data_receive_tasks",
  tbl_data_classification: "tbl_data_classification",
  tbl_early_warning: "tbl_early_warning",
  tbl_early_warning_feedback: "tbl_early_warning_feedback",
  tbl_disc_print: "tbl_disc_print",
  tbl_disc_inspect: "tbl_disc_inspect",
  tbl_disc_type: "tbl_disc_type",
  tbl_evidence_details: "tbl_evidence_details",
  tbl_evidence_record_drp: "tbl_evidence_record_drp",
  tbl_verify_details: "tbl_verify_details",
  tbl_verify_record_drp: "tbl_verify_record_drp",
  tbl_download_record: "tbl_download_record",
  tbl_upload_record: "tbl_upload_record",
  // R.83.6 ISO + 元数据 + 系统族 15 张
  tbl_iso_location: "tbl_iso_location",
  tbl_iso_task_sync: "tbl_iso_task_sync",
  tbl_meta_data: "tbl_meta_data",
  tbl_sys: "tbl_sys",
  tbl_sys_env: "tbl_sys_env",
  tbl_mount_dir: "tbl_mount_dir",
  tbl_buffer_dir: "tbl_buffer_dir",
  tbl_cd_cabinet: "tbl_cd_cabinet",
  tbl_film_operat: "tbl_film_operat",
  tbl_ft_file: "tbl_ft_file",
  tbl_ft_sys: "tbl_ft_sys",
  tbl_back_window: "tbl_back_window",
  tbl_zip_file: "tbl_zip_file",
  tbl_temp_slots: "tbl_temp_slots",
  tbl_lib_group: "tbl_lib_group",
}

export async function ingestPgDump(input: IngestPgDumpInput): Promise<IngestPgDumpResult> {
  const parsed = parsePgDumpCopyTables(input.sql)
  const accepted: IngestPgDumpResult["accepted"] = []
  const rejected: IngestPgDumpResult["rejected"] = []

  const pkg = await createPackageLog({
    siteCode: input.siteCode,
    batchId: input.batchId,
    mode: input.mode,
    rawMetadata: { source: "pg_dump", protocol: "table_backup.sql" },
  })

  let allOk = true
  for (const tbl of parsed) {
    const target = TABLE_MAPPING[tbl.tableName]
    if (!target) {
      rejected.push({ tableName: tbl.tableName, reason: "no_dispatch_target" })
      continue
    }
    const log = await createTableLog({
      packageLogId: pkg.id,
      siteCode: input.siteCode,
      batchId: input.batchId,
      tableName: target,
      syncMode: input.mode,
    })
    try {
      const records: Record<string, unknown>[] = tbl.rows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) out[k] = v
        return out
      })
      const result = await dispatchTable({
        tableName: target as never,
        siteCode: input.siteCode,
        records,
      })
      if (result.status === "success" || result.status === "partial" || result.status === "skipped") {
        await markTableSuccess(log.id, {
          processedRecordCount: result.received,
          insertedCount: result.inserted,
          updatedCount: result.updated,
          skippedCount: result.skipped,
        })
        accepted.push({ tableName: tbl.tableName, rows: tbl.rows.length })
      } else {
        await markTableFailed(log.id, { errorMessage: `dispatch ${result.status}` })
        rejected.push({ tableName: tbl.tableName, reason: `dispatch_${result.status}` })
        allOk = false
      }
    } catch (err) {
      await markTableFailed(log.id, {
        errorMessage: err instanceof Error ? err.message : "unknown",
      })
      rejected.push({ tableName: tbl.tableName, reason: "exception" })
      allOk = false
    }
  }

  if (allOk) {
    await markPackageSuccess(pkg.id, { successTableCount: accepted.length })
  } else {
    await markPackageFailed(pkg.id, {
      errorMessage: "one_or_more_tables_failed",
      failedTableCount: rejected.length,
    })
  }

  return {
    batchId: input.batchId,
    siteCode: input.siteCode,
    packageLogId: pkg.id,
    accepted,
    rejected,
  }
}

// Suppress unused warning
void DUMP_ALLOWED_TABLES
