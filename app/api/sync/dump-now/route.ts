/**
 * POST /api/sync/dump-now
 *
 * Sprint R.83.3 Task 11 — 真实端到端同步入口
 *
 * 区别于 /api/sync/trigger:
 * - trigger 写 control_command 队列,等 Agent 拉取
 * - dump-now 直接 spawn dump + ingest 子进程,真把 source_restore 站点数据 upsert 到中心库
 *
 * 本路由本身不引用 SOURCE_DATABASE_URL;通过 spawn 子进程调用 scripts/sync/**
 */

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Client } from "pg"

const ALLOWED_PACKAGE_TABLES = [
  "tbl_task", "tbl_disc_lib", "tbl_magzines", "tbl_slots", "tbl_hd_info",
  "tbl_lib_task", "tbl_disc", "tbl_logical_volume", "tbl_volume_slot",
  "tbl_user_task", "tbl_user", "tbl_site", "tbl_platform",
  "tbl_user_role", "tbl_depa", "tbl_workspace", "tbl_workspace_user",
  "tbl_depa_user", "tbl_depa_user_info", "tbl_project", "tbl_project_site",
  "tbl_task_projects", "tbl_task_receipts", "tbl_task_files", "tbl_task_check",
  "tbl_receipt", "tbl_receipt_check", "tbl_receipt_file",
  "tbl_role", "tbl_role_fuc", "tbl_fuc", "tbl_dict_category", "tbl_dict",
  "tbl_dict_item", "tbl_sys_log", "tbl_api_log", "tbl_api_interface",
  "tbl_user_mfa", "tbl_archives_type", "tbl_archives_level", "tbl_platform_type",
  "tbl_credible_prove", "tbl_credible_verify",
  "tbl_check_category", "tbl_check_sub_category", "tbl_check_item", "tbl_check_sector",
  "tbl_check_template", "tbl_check_task", "tbl_check_task_item", "tbl_check_task_file",
  "tbl_check_file", "tbl_check_files", "tbl_check_log",
  "tbl_check_patrol_strategy", "tbl_check_patrol_task", "tbl_check_patrol_task_item",
  "tbl_check_patrol_log",
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  "tbl_volume_group", "tbl_volume_dataclass", "tbl_volume_depa", "tbl_volume_user", "tbl_volume_workspace",
  "tbl_schedule_job", "tbl_register_management", "tbl_interface_task",
  "tbl_hot_backup_record", "tbl_hot_restore_record",
  "tbl_device_device", "tbl_drivers", "tbl_drivers_burn", "tbl_raid_group", "tbl_hd_manager",
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  "tbl_data_receive_list", "tbl_data_receive_log", "tbl_data_receive_tasks",
  "tbl_data_classification", "tbl_early_warning", "tbl_early_warning_feedback",
  "tbl_disc_print", "tbl_disc_inspect", "tbl_disc_type",
  "tbl_evidence_details", "tbl_evidence_record_drp",
  "tbl_verify_details", "tbl_verify_record_drp",
  "tbl_download_record", "tbl_upload_record",
  // R.83.6 ISO + 元数据 + 系统族 15 张
  "tbl_iso_location", "tbl_iso_task_sync", "tbl_meta_data",
  "tbl_sys", "tbl_sys_env",
  "tbl_mount_dir", "tbl_buffer_dir", "tbl_cd_cabinet",
  "tbl_film_operat", "tbl_ft_file", "tbl_ft_sys",
  "tbl_back_window", "tbl_zip_file", "tbl_temp_slots", "tbl_lib_group",
]

function srcToUnified(src: string): string {
  // 简单规则 + R.83.3 命名修正
  let u = src.replace(/^tbl_/, "unified_")
  if (src === "tbl_disc_lib") u = "unified_devices"
  if (src === "tbl_magzines") u = "unified_magazines"
  if (src === "tbl_hd_info") u = "unified_hard_disks"
  if (src === "tbl_disc") u = "unified_disc_media"
  if (src === "tbl_logical_volume") u = "unified_volumes"
  if (src === "tbl_volume_slot") u = "unified_volume_slots"
  if (src === "tbl_user_task") u = "unified_user_tasks"
  if (src === "tbl_depa") u = "unified_departments"
  if (src === "tbl_depa_user") u = "unified_department_users"
  if (src === "tbl_depa_user_info") u = "unified_department_user_info"
  if (src === "tbl_project_site") u = "unified_project_sites"
  if (src === "tbl_task_projects") u = "unified_task_projects"
  if (src === "tbl_task_receipts") u = "unified_task_receipts"
  if (src === "tbl_task_check") u = "unified_task_check"
  if (src === "tbl_receipt") u = "unified_receipts"
  if (src === "tbl_receipt_check") u = "unified_receipt_checks"
  if (src === "tbl_receipt_file") u = "unified_receipt_files"
  if (src === "tbl_role_fuc") u = "unified_role_fucs"
  if (src === "tbl_user_mfa") u = "unified_user_mfas"
  if (src === "tbl_credible_prove") u = "unified_credible_proves"
  if (src === "tbl_credible_verify") u = "unified_credible_verifies"
  if (src === "tbl_dict_category") u = "unified_dict_categories"
  if (src === "tbl_dict_item") u = "unified_dict_items"
  if (src === "tbl_archives_type") u = "unified_archives_types"
  if (src === "tbl_archives_level") u = "unified_archives_levels"
  if (src === "tbl_platform_type") u = "unified_platform_types"
  if (src === "tbl_api_interface") u = "unified_api_interfaces"
  if (src === "tbl_check_category") u = "unified_check_categories"
  if (src === "tbl_check_sub_category") u = "unified_check_sub_categories"
  if (src === "tbl_check_item") u = "unified_check_items"
  if (src === "tbl_check_sector") u = "unified_check_sectors"
  if (src === "tbl_check_template") u = "unified_check_templates"
  if (src === "tbl_check_task") u = "unified_check_tasks"
  if (src === "tbl_check_task_item") u = "unified_check_task_items"
  if (src === "tbl_check_task_file") u = "unified_check_task_files"
  if (src === "tbl_check_log") u = "unified_check_logs"
  if (src === "tbl_check_patrol_strategy") u = "unified_check_patrol_strategies"
  if (src === "tbl_check_patrol_task") u = "unified_check_patrol_tasks"
  if (src === "tbl_check_patrol_task_item") u = "unified_check_patrol_task_items"
  if (src === "tbl_check_patrol_log") u = "unified_check_patrol_logs"
  // R.83.4 存储卷 + 调度/接口 + 设备业务族 15 张
  if (src === "tbl_volume_group") u = "unified_volume_groups"
  if (src === "tbl_volume_dataclass") u = "unified_volume_dataclasses"
  if (src === "tbl_volume_depa") u = "unified_volume_depas"
  if (src === "tbl_volume_user") u = "unified_volume_users"
  if (src === "tbl_volume_workspace") u = "unified_volume_workspaces"
  if (src === "tbl_schedule_job") u = "unified_schedule_jobs"
  if (src === "tbl_register_management") u = "unified_register_managements"
  if (src === "tbl_interface_task") u = "unified_interface_tasks"
  if (src === "tbl_hot_backup_record") u = "unified_hot_backup_records"
  if (src === "tbl_hot_restore_record") u = "unified_hot_restore_records"
  if (src === "tbl_device_device") u = "unified_device_devices"
  if (src === "tbl_drivers") u = "unified_drivers"
  if (src === "tbl_drivers_burn") u = "unified_drivers_burns"
  if (src === "tbl_raid_group") u = "unified_raid_groups"
  if (src === "tbl_hd_manager") u = "unified_hd_managers"
  // R.83.5 数据接收 + 告警 + 媒体族 15 张
  if (src === "tbl_data_receive_list") u = "unified_data_receive_lists"
  if (src === "tbl_data_receive_log") u = "unified_data_receive_logs"
  if (src === "tbl_data_receive_tasks") u = "unified_data_receive_tasks"
  if (src === "tbl_data_classification") u = "unified_data_classifications"
  if (src === "tbl_early_warning") u = "unified_early_warnings"
  if (src === "tbl_early_warning_feedback") u = "unified_early_warning_feedbacks"
  if (src === "tbl_disc_print") u = "unified_disc_prints"
  if (src === "tbl_disc_inspect") u = "unified_disc_inspects"
  if (src === "tbl_disc_type") u = "unified_disc_types"
  if (src === "tbl_evidence_details") u = "unified_evidence_details"
  if (src === "tbl_evidence_record_drp") u = "unified_evidence_record_drps"
  if (src === "tbl_verify_details") u = "unified_verify_details"
  if (src === "tbl_verify_record_drp") u = "unified_verify_record_drps"
  if (src === "tbl_download_record") u = "unified_download_records"
  if (src === "tbl_upload_record") u = "unified_upload_records"
  // R.83.6 ISO + 元数据 + 系统族 15 张
  if (src === "tbl_iso_location") u = "unified_iso_locations"
  if (src === "tbl_iso_task_sync") u = "unified_iso_task_syncs"
  if (src === "tbl_meta_data") u = "unified_meta_datas"
  if (src === "tbl_sys") u = "unified_sys_configs"
  if (src === "tbl_sys_env") u = "unified_sys_envs"
  if (src === "tbl_mount_dir") u = "unified_mount_dirs"
  if (src === "tbl_buffer_dir") u = "unified_buffer_dirs"
  if (src === "tbl_cd_cabinet") u = "unified_cd_cabinets"
  if (src === "tbl_film_operat") u = "unified_film_operats"
  if (src === "tbl_ft_file") u = "unified_ft_files"
  if (src === "tbl_ft_sys") u = "unified_ft_systems"
  if (src === "tbl_back_window") u = "unified_back_windows"
  if (src === "tbl_zip_file") u = "unified_zip_files"
  if (src === "tbl_temp_slots") u = "unified_temp_slots"
  if (src === "tbl_lib_group") u = "unified_lib_groups"
  return u
}

function runCommand(
  cmd: string,
  args: string[],
  traceId: string
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: process.cwd(), env: process.env })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (chunk) => {
      const s = chunk.toString()
      stdout += s
      process.stdout.write(`[${traceId}] ${s}`)
    })
    proc.stderr.on("data", (chunk) => {
      const s = chunk.toString()
      stderr += s
      process.stderr.write(`[${traceId}] ${s}`)
    })
    proc.on("close", (code) => resolve({ ok: code === 0, stdout, stderr }))
    proc.on("error", (err) => {
      stderr += String(err)
      resolve({ ok: false, stdout, stderr })
    })
  })
}

async function verifyCenterRows(
  siteCode: string
): Promise<{ table: string; rows: number; unified: string }[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const result: { table: string; rows: number; unified: string }[] = []
    for (const srcTable of ALLOWED_PACKAGE_TABLES) {
      const unified = srcToUnified(srcTable)
      try {
        const r = await client.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM ${unified} WHERE source_site_id = $1`,
          [siteCode]
        )
        result.push({ table: srcTable, unified, rows: Number(r.rows[0]?.count ?? 0) })
      } catch {
        // 表不存在时记为 -1,不应阻塞整个 verify
        result.push({ table: srcTable, unified, rows: -1 })
      }
    }
    return result
  } finally {
    await client.end()
  }
}

export async function POST(req: NextRequest) {
  const traceId = `dump-now-${Date.now()}`
  try {
    const body = await req.json().catch(() => ({}))
    const siteCode = String(body.siteCode ?? "SH01")
    if (!/^[A-Z0-9]+$/.test(siteCode)) {
      throw new Error(`invalid siteCode: ${siteCode}`)
    }

    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL not set on server; cannot verify center rows")
    }

    process.stdout.write(`[${traceId}] start dump-now siteCode=${siteCode}\n`)

    // 1. 准备临时目录
    const tmpDir = mkdtempSync(join(tmpdir(), `dump-${siteCode}-`))
    const dumpFile = join(tmpDir, `${siteCode}-dump.sql`)

    try {
      // 2. spawn export-restore-dump.ts (子进程独享 SOURCE_DATABASE_URL)
      process.stdout.write(`[${traceId}] step 1: export-restore-dump\n`)
      const exportResult = await runCommand(
        "pnpm",
        ["exec", "tsx", "scripts/sync/export-restore-dump.ts", `--siteCode=${siteCode}`, `--out=${dumpFile}`],
        traceId
      )
      if (!exportResult.ok) {
        throw new Error(`export-restore-dump failed: ${exportResult.stderr.slice(-300)}`)
      }

      // 3. spawn ingest-dump.ts (子进程通过 DATABASE_URL 写中心库)
      process.stdout.write(`[${traceId}] step 2: ingest-dump\n`)
      const ingestResult = await runCommand(
        "pnpm",
        ["exec", "tsx", "scripts/sync/ingest-dump.ts", `--siteCode=${siteCode}`, `--file=${dumpFile}`],
        traceId
      )
      if (!ingestResult.ok) {
        throw new Error(`ingest-dump failed: ${ingestResult.stderr.slice(-300)}`)
      }
    } finally {
      // 4. 清理临时目录(成功失败都清)
      rmSync(tmpDir, { recursive: true, force: true })
    }

    // 5. 验证中心库
    process.stdout.write(`[${traceId}] step 3: verify\n`)
    const verification = await verifyCenterRows(siteCode)
    const totalRows = verification.reduce((sum, v) => sum + Math.max(0, v.rows), 0)
    const tablesWithData = verification.filter((v) => v.rows > 0).length

    return NextResponse.json({
      code: 0,
      data: {
        siteCode,
        totalRows,
        tablesWithData,
        verification,
        message: `已真实同步 ${siteCode} 站点数据到中心库`,
      },
      traceId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[${traceId}] FAIL: ${msg}\n`)
    return NextResponse.json(
      { code: 500, message: msg, traceId },
      { status: 500 }
    )
  }
}