/**
 * GET /api/tasks/[id]
 * 任务详情 API — Sprint R.4 Bug 1 修复
 *
 * 修复前: 用 @/lib/mock/tasks (100% mock) 查找, DB 有 87 行 unified_tasks 全部 404
 * 修复后: 优先查 unified_tasks 真实中心表, 支持 siteCode 过滤, 找不到返回 404 JSON
 *
 * R.4 范围: 0 业务功能, 仅修 404 bug
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, TaskDTO, TaskStatus, TaskType, TaskPhase, Priority } from "@/lib/api/dto"

const STATUS_PHASE_MAP: Record<string, TaskPhase> = {
  burn_success: "completed",
  cancelled: "failed",
  make_task_done_backup_running: "writing",
  paused: "paused",
  remote_backup_created: "pending",
  data_preparing: "preparing",
  ready: "pending",
  burn_failed: "failed",
  download_success: "completed",
  restore_started: "writing",
  read_from_disc_done: "completed",
  read_from_disc_failed: "failed",
  reading_from_disc: "writing",
  read_failed: "failed",
  restore_warning: "failed",
  restful_ready: "pending",
  no_file_changed: "completed",
  jdf_generated: "pending",
  make_task_scan_started: "scanning",
  make_task_scan_unfinished: "scanning",
  s3_data_preparing: "preparing",
}

const STATUS_MAP: Record<string, TaskStatus> = {
  burn_success: "completed",
  cancelled: "failed",
  make_task_done_backup_running: "running",
  paused: "paused",
  remote_backup_created: "pending_dispatch",
  data_preparing: "running",
  ready: "pending_dispatch",
  burn_failed: "failed",
  download_success: "completed",
  restore_started: "running",
  read_from_disc_done: "completed",
  read_from_disc_failed: "failed",
  reading_from_disc: "running",
  read_failed: "failed",
  restore_warning: "failed",
  restful_ready: "pending_dispatch",
  no_file_changed: "completed",
  jdf_generated: "pending_dispatch",
  make_task_scan_started: "running",
  make_task_scan_unfinished: "running",
  s3_data_preparing: "running",
}

const TYPE_MAP: Record<string, TaskType> = {
  backup: "backup",
  restore: "restore",
  burn_and_seal: "other",
  epson_api: "other",
  scan: "device_scan",
  optical_copy: "other",
  volume_copy: "migrate",
  s3: "other",
  package: "full_package",
  evidence: "other",
  power_on: "other",
}

interface TaskRow {
  id: string
  source_id: string
  source_site_id: string
  task_no: string
  task_name: string | null
  task_type: string
  status: string
  phase: string | null
  priority: string | null
  operator: string | null
  department: string | null
  archive_name: string | null
  source_path: string | null
  package_path: string | null
  device_id: string | null
  total_files: number
  total_size: number
  created_at: Date | string | null
  updated_at: Date | string | null
  synced_at: Date | string
  task_mode: number | null
  error_message: string | null
  runtime_seconds: number | null
  package_count: number | null
  success_count: number | null
  error_count: number | null
  progress: number | null
  current_phase: string | null
}

function mapTaskToDTO(row: TaskRow): TaskDTO {
  return {
    id: row.id,
    taskNo: row.task_no,
    name: row.task_name || row.task_no,
    type: TYPE_MAP[row.task_type] ?? "other",
    phase: STATUS_PHASE_MAP[row.status] ?? "idle",
    status: STATUS_MAP[row.status] ?? "pending_dispatch",
    priority: (row.priority as Priority) ?? "normal",
    progress: STATUS_MAP[row.status] === "completed"
      ? 100
      : (row.progress != null ? row.progress : null),
    archiveName: row.archive_name ?? "",
    dataClassification: "",
    siteName: row.source_site_id,
    siteCode: row.source_site_id,
    operator: row.operator ?? "",
    department: row.department ?? undefined,
    sourcePath: row.source_path ?? "",
    packagePath: row.package_path ?? "",
    backupScope: "full",
    deviceId: row.device_id ?? undefined,
    startedAt: row.created_at
      ? (typeof row.created_at === "string" ? row.created_at : row.created_at.toISOString())
      : (typeof row.synced_at === "string" ? row.synced_at : row.synced_at.toISOString()),
    updatedAt: row.updated_at
      ? (typeof row.updated_at === "string" ? row.updated_at : row.updated_at.toISOString())
      : (typeof row.synced_at === "string" ? row.synced_at : row.synced_at.toISOString()),
    fileCount: row.total_files ?? undefined,
    totalSize: row.total_size ? `${row.total_size}` : undefined,
    taskMode: row.task_mode ?? undefined,
    errorMessage: row.error_message ?? undefined,
    runtime: row.runtime_seconds ?? undefined,
    packageCount: row.package_count ?? undefined,
    successCount: row.success_count ?? undefined,
    errorCount: row.error_count ?? undefined,
    currentPhase: row.current_phase ?? undefined,
    sm3Status: undefined,
    recentLogs: [],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const siteCode = request.nextUrl.searchParams.get("siteCode")

    // 1. UUID 格式校验, 防止 SQL 异常
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          code: 404,
          message: "Task not found (invalid id format)",
          data: null,
          source: "database",
          traceId: `api-${Date.now()}`,
        },
        { status: 404 }
      )
    }

    // 2. 真实查 unified_tasks (Sprint R.4 Bug 1 修复)
    const whereConditions = ["id = $1"]
    const queryParams: unknown[] = [id]
    if (siteCode) {
      whereConditions.push(`source_site_id = $2`)
      queryParams.push(siteCode)
    }

    const queryResult = await query<TaskRow>(
      `SELECT id, source_id, source_site_id, task_no, task_name, task_type,
              status, phase, priority, operator, department, archive_name,
              source_path, package_path, device_id, total_files, total_size,
              created_at, updated_at, synced_at, task_mode, error_message,
              runtime_seconds, package_count, success_count, error_count,
              progress, current_phase
       FROM unified_tasks
       WHERE ${whereConditions.join(" AND ")}
       LIMIT 1`,
      queryParams
    )
    const rows = queryResult.rows

    if (rows.length === 0) {
      return NextResponse.json(
        {
          code: 404,
          message: "Task not found",
          data: null,
          source: "database",
          traceId: `api-${Date.now()}`,
        },
        { status: 404 }
      )
    }

    const adaptedTask = mapTaskToDTO(rows[0] as TaskRow)
    const response: ApiResponse<TaskDTO> & { source?: string } = {
      code: 0,
      message: "ok",
      data: adaptedTask,
      source: "database",
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/tasks/[id]:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        source: "database",
        error: error instanceof Error ? error.message : String(error),
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
