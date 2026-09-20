/**
 * GET /api/tasks
 * 任务列表 API
 *
 * API mode: 读取 unified_tasks 真实中心表
 * Mock mode: 使用 mock 数据（通过 apiTaskProvider fallback）
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { resolveRequestScope, sqlColumnInSiteScope } from "@/lib/auth/site-scope"
import type { ApiResponse, PaginatedResponse, TaskDTO, TaskType, TaskPhase, Priority } from "@/lib/api/dto"
import { formatTaskTypeLabelFromUnified, resolveNumericTaskType, buildTaskTypeFilterSql } from "@/lib/tasks/task-type-display"
import {
  formatTaskStatusLabelFromUnified,
  resolveNumericTaskStatus,
  resolveTaskPhaseFromBusiness,
  resolveTaskStatusFromBusiness,
  buildTaskStatusFilterSql,
  PHASE_QUERY_TO_STATUS_FILTER,
} from "@/lib/tasks/task-status-display"
import { loadTaskPathAggregatesForRows } from "@/lib/tasks/task-path-aggregate"
import {
  loadUnifiedDiscAggregatesMultiSite,
  mergeDiscAggregateIntoTaskRow,
} from "@/lib/tasks/task-disc-aggregate"

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
  warning: "failed",
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
  // Sprint 2F.1
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
    sourceId: row.source_id,  // R.16: 源端 tbl_task.id (bigint), executor parseInt 必需
    taskNo: row.task_no,
    name: row.task_name || row.task_no,
    type: TYPE_MAP[row.task_type] ?? "other",
    typeLabel: formatTaskTypeLabelFromUnified(row.task_type, row.task_mode),
    statusLabel,
    phase,
    status,
    priority: (row.priority as Priority) ?? "normal",
    // Sprint 2F.1: 真实 progress, completed = 100, 否则 null (前端显示 —)
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
    // 业务时间：create_dt → startedAt，update_dt → completedAt（勿用中心库入库时间）
    startedAt: toIsoString(row.task_create_at) ?? "",
    updatedAt: toIsoString(row.task_end_at) ?? toIsoString(row.updated_at) ?? "",
    completedAt: toIsoString(row.task_end_at),
    fileCount: row.total_files ?? undefined,
    totalSize: row.total_size ? `${row.total_size}` : undefined,
    // Sprint 2F.1: 任务运行时字段
    taskMode: row.task_mode ?? undefined,
    errorMessage: row.error_message ?? undefined,
    runtime: row.runtime_seconds ?? undefined,
    packageCount: row.package_count ?? undefined,
    successCount: row.success_count ?? undefined,
    errorCount: row.error_count ?? undefined,
    currentPhase: row.current_phase ?? undefined,
    sm3Status: undefined, // 源表不在 source_restore
    recentLogs: [],
  }
}

export async function GET(request: NextRequest) {
  try {
    // Sprint R.29: 防越权 - 检查登录和权限
    const session = await requireSession(request)
    requirePermission(session, "tasks:read")
    const scope = await resolveRequestScope(session, {
      siteCode: request.nextUrl.searchParams.get("siteCode"),
      regionCode: request.nextUrl.searchParams.get("regionCode"),
    })

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10) || 50))
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const phase = searchParams.get("phase")
    const phaseGroup = searchParams.get("phaseGroup")
    const statusFilter = searchParams.get("statusFilter")
    const keyword = searchParams.get("keyword")
    const deviceId = searchParams.get("deviceId")?.trim() || null
    const device = searchParams.get("device")?.trim() || null
    const orderBy = searchParams.get("orderBy")

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (scope.kind === "listed" && scope.siteCodes.length === 0) {
      return NextResponse.json({
        code: 0,
        message: "ok",
        data: { items: [], page, pageSize, total: 0 },
        source: "database",
      })
    }

    const siteClause = sqlColumnInSiteScope("source_site_id", scope, paramIndex)
    conditions.push(siteClause.sql)
    params.push(...siteClause.params)
    paramIndex = siteClause.nextParam

    if (status && status !== "all") {
      conditions.push(`status = $${paramIndex++}`)
      params.push(status)
    }

    // 业务状态筛选（优先于旧 phase）；兼容 ?phase=completed 等跳转
    const resolvedStatusFilter =
      (statusFilter && statusFilter !== "all" ? statusFilter : null) ??
      (phase && phase !== "all" ? (PHASE_QUERY_TO_STATUS_FILTER[phase] ?? null) : null)

    if (resolvedStatusFilter) {
      const built = buildTaskStatusFilterSql(resolvedStatusFilter, paramIndex)
      if (built) {
        conditions.push(built.sql)
        params.push(...built.params)
        paramIndex = built.nextIndex
      } else {
        // 未识别的 statusFilter：回退旧 STATUS_PHASE_MAP phase 筛选
        const statuses = Object.entries(STATUS_PHASE_MAP)
          .filter(([, p]) => p === phase)
          .map(([s]) => s)
        if (statuses.length > 0) {
          conditions.push(`status = ANY($${paramIndex++})`)
          params.push(statuses)
        }
      }
    } else if (phaseGroup === "running") {
      const built = buildTaskStatusFilterSql("running", paramIndex)
      if (built) {
        conditions.push(built.sql)
        params.push(...built.params)
        paramIndex = built.nextIndex
      }
    }

    if (type && type !== "all") {
      const built = buildTaskTypeFilterSql(type, paramIndex)
      if (built) {
        conditions.push(built.sql)
        params.push(...built.params)
        paramIndex = built.nextIndex
      } else {
        // 兼容旧 DTO TaskType 英文名
        const dbTypes = Object.entries(TYPE_MAP)
          .filter(([dbType, uiType]) => dbType === type || uiType === type)
          .map(([dbType]) => dbType)
        const typesToMatch = dbTypes.length > 0 ? dbTypes : [type]
        conditions.push(`task_type = ANY($${paramIndex++})`)
        params.push(typesToMatch)
      }
    }
    if (keyword) {
      conditions.push(`(task_no ILIKE $${paramIndex} OR task_name ILIKE $${paramIndex} OR operator ILIKE $${paramIndex})`)
      params.push(`%${keyword}%`)
      paramIndex++
    }

    // 关联设备筛选：siteCode + deviceId 精确匹配（与列表 deviceName 解析一致）
    if (deviceId) {
      conditions.push(`device_id = $${paramIndex++}`)
      params.push(deviceId)
    } else if (device) {
      // 旧链接兼容：device=名称或 ID
      conditions.push(`(
        device_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM unified_devices d
          WHERE d.device_id = unified_tasks.device_id
            AND d.source_site_id = unified_tasks.source_site_id
            AND d.device_name ILIKE $${paramIndex + 1}
        )
      )`)
      params.push(device, `%${device}%`)
      paramIndex += 2
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
    const orderClause =
      orderBy === "recent"
        ? `ORDER BY COALESCE(task_end_at, updated_at, synced_at) DESC NULLS LAST`
        : `-- source_id 对应 tbl_task.id（数字），按数值降序，避免字符串排序 99 > 100
      ORDER BY
        CASE WHEN source_id ~ '^[0-9]+$' THEN source_id::bigint ELSE NULL END DESC NULLS LAST,
        source_id DESC`

    const dataSql = `
      SELECT id, source_id, source_site_id, task_no, task_name, task_type, status,
             phase, priority, operator, department, archive_name,
             source_path, package_path, device_id,
             total_files, total_size, created_at, updated_at, synced_at,
             task_create_at, task_end_at,
             task_mode, error_message, runtime_seconds,
             package_count, success_count, error_count, progress, current_phase
      FROM unified_tasks ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    const { rows } = await query<TaskRow>(dataSql, dataParams)

    // 按站点+device_id 查设备名（全站视图下 lib_id 可能跨站碰撞）
    const deviceKeys = [
      ...new Set(
        rows
          .filter((r) => r.device_id)
          .map((r) => `${r.source_site_id}\0${r.device_id}`)
      ),
    ]
    let deviceNameMap: Record<string, string> = {}
    if (deviceKeys.length > 0) {
      const deviceIds = [...new Set(rows.map((r) => r.device_id).filter(Boolean))] as string[]
      const siteIds = [...new Set(rows.map((r) => r.source_site_id))]
      const deviceResult = await query<{
        device_id: string
        device_name: string
        source_site_id: string
      }>(
        `SELECT device_id, device_name, source_site_id
         FROM unified_devices
         WHERE device_id = ANY($1) AND source_site_id = ANY($2)`,
        [deviceIds, siteIds]
      )
      for (const d of deviceResult.rows) {
        deviceNameMap[`${d.source_site_id}\0${d.device_id}`] = d.device_name
      }
    }

    const pathAggBySite = new Map<string, Awaited<ReturnType<typeof loadTaskPathAggregatesForRows>>>()
    const siteTasks = new Map<
      string,
      Array<{ sourceId: string; taskType: string; taskMode: number | null }>
    >()
    for (const row of rows) {
      const list = siteTasks.get(row.source_site_id) ?? []
      list.push({
        sourceId: row.source_id,
        taskType: row.task_type,
        taskMode: row.task_mode,
      })
      siteTasks.set(row.source_site_id, list)
    }
    for (const [site, tasks] of siteTasks) {
      pathAggBySite.set(site, await loadTaskPathAggregatesForRows(site, tasks))
    }

    // 列表缺封包统计时，按页批量从 unified_disc_media 补全
    const needDiscAgg = rows.filter(
      (r) => r.package_count == null || r.success_count == null || r.error_count == null
    )
    const discAggMap =
      needDiscAgg.length > 0
        ? await loadUnifiedDiscAggregatesMultiSite(
            needDiscAgg.map((r) => ({ siteCode: r.source_site_id, taskId: r.source_id }))
          )
        : new Map()

    const items = rows.map((row) => {
      const enriched = mergeDiscAggregateIntoTaskRow(
        row,
        discAggMap.get(`${row.source_site_id}::${row.source_id}`)
      )
      const dto = mapTaskToDTO(enriched)
      dto.deviceName = row.device_id
        ? deviceNameMap[`${row.source_site_id}\0${row.device_id}`] ?? undefined
        : undefined
      const pathAgg = pathAggBySite.get(row.source_site_id)?.get(String(row.source_id))
      if (pathAgg?.volumeNames) dto.volumeId = pathAgg.volumeNames
      if (pathAgg?.pathSource) dto.pathSource = pathAgg.pathSource
      if (pathAgg?.paths?.length) {
        dto.pathPairs = pathAgg.paths
        dto.sourcePath = pathAgg.sourcePath
        dto.packagePath = pathAgg.backupPath
      } else {
        if (pathAgg?.sourcePath) dto.sourcePath = pathAgg.sourcePath
        if (pathAgg?.backupPath) dto.packagePath = pathAgg.backupPath
      }
      if (pathAgg?.restoreErrorMessage && !dto.errorMessage) {
        dto.errorMessage = pathAgg.restoreErrorMessage
      }
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
    // Sprint R.29: Auth 错误直接返回
    if (error instanceof NextResponse) return error
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
