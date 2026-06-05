/**
 * GET /api/tasks
 * 任务列表 API
 *
 * API mode: 读取 unified_tasks 真实中心表
 * Mock mode: 使用 mock 数据（通过 apiTaskProvider fallback）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, PaginatedResponse, TaskDTO, TaskStatus, TaskType, TaskPhase, Priority } from "@/lib/api/dto"

// unified_tasks.status → TaskDTO.phase（基于真实状态推断阶段）
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

// unified_tasks.status → TaskDTO.status
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

// unified_tasks.task_type → TaskDTO.type
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
}

function mapTaskToDTO(row: TaskRow): TaskDTO {
  const deviceNameMap: Record<string, string> = {}
  return {
    id: row.id,
    taskNo: row.task_no,
    name: row.task_name || row.task_no,
    type: TYPE_MAP[row.task_type] ?? "other",
    phase: STATUS_PHASE_MAP[row.status] ?? "idle",
    status: STATUS_MAP[row.status] ?? "pending_dispatch",
    priority: (row.priority as Priority) ?? "normal",
    progress: STATUS_MAP[row.status] === "completed" ? 100 : 0,
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
    recentLogs: [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1")
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
    const siteCode = searchParams.get("siteCode")
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const keyword = searchParams.get("keyword")

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (siteCode) {
      conditions.push(`source_site_id = $${paramIndex++}`)
      params.push(siteCode)
    }
    if (status && status !== "all") {
      conditions.push(`status = $${paramIndex++}`)
      params.push(status)
    }
    if (type && type !== "all") {
      conditions.push(`task_type = $${paramIndex++}`)
      params.push(type)
    }
    if (keyword) {
      conditions.push(`(task_no ILIKE $${paramIndex} OR task_name ILIKE $${paramIndex} OR operator ILIKE $${paramIndex})`)
      params.push(`%${keyword}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    // 总数
    const countResult = await query<{ count: string }>(
      `SELECT count(*) as count FROM unified_tasks ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.count ?? "0")

    // 分页数据
    const offset = (page - 1) * pageSize
    const dataParams = [...params, pageSize, offset]
    const dataSql = `
      SELECT id, source_id, source_site_id, task_no, task_name, task_type, status,
             phase, priority, operator, department, archive_name,
             source_path, package_path, device_id,
             total_files, total_size, created_at, updated_at, synced_at
      FROM unified_tasks ${whereClause}
      ORDER BY created_at DESC NULLS LAST, source_id
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    const { rows } = await query<TaskRow>(dataSql, dataParams)

    // 异步获取 device_name 映射
    const deviceIds = [...new Set(rows.map(r => r.device_id).filter(Boolean))]
    let deviceNameMap: Record<string, string> = {}
    if (deviceIds.length > 0) {
      const deviceResult = await query<{ device_id: string; device_name: string }>(
        `SELECT device_id, device_name FROM unified_devices WHERE device_id = ANY($1) AND source_site_id = $2`,
        [deviceIds, siteCode ?? rows[0]?.source_site_id]
      )
      for (const d of deviceResult.rows) {
        deviceNameMap[d.device_id] = d.device_name
      }
    }

    const items = rows.map(row => {
      const dto = mapTaskToDTO(row)
      dto.deviceName = row.device_id ? deviceNameMap[row.device_id] ?? undefined : undefined
      return dto
    })

    const response = {
      code: 0,
      message: "ok",
      data: { items, page, pageSize, total },
      source: "database" as const,
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/tasks:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: null,
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
