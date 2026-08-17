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
import type { ApiResponse, TaskDTO, TaskType, Priority } from "@/lib/api/dto"
import { formatTaskTypeLabelFromUnified, resolveNumericTaskType } from "@/lib/tasks/task-type-display"
import {
  formatTaskStatusLabelFromUnified,
  resolveNumericTaskStatus,
  resolveTaskPhaseFromBusiness,
  resolveTaskStatusFromBusiness,
} from "@/lib/tasks/task-status-display"
import { loadTaskPathAggregate } from "@/lib/tasks/task-path-aggregate"
import {
  loadUnifiedDiscAggregates,
  mergeDiscAggregateIntoTaskRow,
} from "@/lib/tasks/task-disc-aggregate"

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
  remote_backup: "other",
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
  task_create_at: Date | string | null
  task_end_at: Date | string | null
  task_mode: number | null
  error_message: string | null
  runtime_seconds: number | null
  package_count: number | null
  success_count: number | null
  error_count: number | null
  progress: number | null
  current_phase: string | null
}

function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined
  return typeof value === "string" ? value : value.toISOString()
}

function mapTaskToDTO(row: TaskRow): TaskDTO {
  const numericStatus = resolveNumericTaskStatus(row.status, row.task_type)
  const numericType = resolveNumericTaskType(row.task_type)
  const statusLabel = formatTaskStatusLabelFromUnified(row.task_type, row.status, row.task_mode)
  const phase = resolveTaskPhaseFromBusiness(numericStatus, numericType, row.task_mode, row.status, {
    packageCount: row.package_count,
    successCount: row.success_count,
  })
  const status = resolveTaskStatusFromBusiness(numericStatus, row.status)
  return {
    id: row.id,
    taskNo: row.task_no,
    name: row.task_name || row.task_no,
    type: TYPE_MAP[row.task_type] ?? "other",
    typeLabel: formatTaskTypeLabelFromUnified(row.task_type, row.task_mode),
    statusLabel,
    phase,
    status,
    priority: (row.priority as Priority) ?? "normal",
    progress: status === "completed"
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
    volumeId: undefined,
    backupScope: "full",
    deviceId: row.device_id ?? undefined,
    startedAt: toIsoString(row.task_create_at) ?? "",
    updatedAt: toIsoString(row.task_end_at) ?? toIsoString(row.updated_at) ?? "",
    completedAt: toIsoString(row.task_end_at),
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
              created_at, updated_at, synced_at, task_create_at, task_end_at,
              task_mode, error_message,
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

    let row = rows[0] as TaskRow
    // 已有库未回写时，按 unified_disc_media 即时补封包/成功/异常
    if (row.package_count == null || row.success_count == null || row.error_count == null) {
      const discMap = await loadUnifiedDiscAggregates(row.source_site_id, [row.source_id])
      row = mergeDiscAggregateIntoTaskRow(row, discMap.get(String(row.source_id)))
    }
    const adaptedTask = mapTaskToDTO(row)
    if (row.device_id) {
      const deviceResult = await query<{ device_name: string }>(
        `SELECT device_name FROM unified_devices
         WHERE device_id = $1 AND source_site_id = $2
         LIMIT 1`,
        [row.device_id, row.source_site_id]
      )
      if (deviceResult.rows[0]?.device_name) {
        adaptedTask.deviceName = deviceResult.rows[0].device_name
      }
    }

    // 目标卷 / 源路径 / 备份路径：tbl_task_items + tbl_logical_volume
    const pathAgg = await loadTaskPathAggregate(row.source_site_id, row.source_id)
    if (pathAgg.volumeNames) adaptedTask.volumeId = pathAgg.volumeNames
    if (pathAgg.paths.length > 0) {
      adaptedTask.pathPairs = pathAgg.paths
      adaptedTask.sourcePath = pathAgg.sourcePath
      adaptedTask.packagePath = pathAgg.backupPath
    } else {
      if (pathAgg.sourcePath) adaptedTask.sourcePath = pathAgg.sourcePath
      if (pathAgg.backupPath) adaptedTask.packagePath = pathAgg.backupPath
    }

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
