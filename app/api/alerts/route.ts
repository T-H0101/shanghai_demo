/**
 * GET /api/alerts
 * 告警列表 API (Sprint 4.7 真实聚合)
 *
 * 数据源 (Sprint 4.7 后):
 *   1. sync_package_log: status IN ('failed','partial') → 同步失败告警 (critical)
 *   2. sync_table_log:   status = 'failed' → 表级失败告警 (warning)
 *   3. control_command:  status IN ('failed','cancelled') → 控制失败告警 (warning)
 *
 * Sprint 4.7 之前: 直接 import lib/mock 数据拼接 (Sprint 2A 临时实现)
 * 现状: 真实聚合, 无 mock 依赖
 *
 * 不实现的告警来源 (CLAUDE.md 禁项):
 *   - tbl_file / tbl_folder 大表 (ES/ClickHouse)
 *   - 设备在线/离线实时探测 (无 sensor 接入)
 *   - 真实站点 API 异常 (无真实站点)
 *
 * 详见 docs/summary/CODEBASE_QUALITY_AUDIT.md §4.4
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { adaptAlertList } from "@/lib/api/adapters"
import type { ApiResponse, PaginatedResponse, AlertDTO } from "@/lib/api/dto"
import type { MockAlert } from "@/lib/api/adapters/alert-adapter"

interface RawAlert {
  id: string
  title: string
  severity: "critical" | "warning"
  message: string
  time: string
  status: "active" | "resolved" | "acknowledged"
  type: "sync" | "table" | "control"
  site_code: string | null
}

const MAX_ALERTS_PER_SOURCE = 200  // 防 N+1, 取最近 N 条合并

async function fetchFailedSyncPackages(): Promise<RawAlert[]> {
  const r = await query<{
    id: string
    site_code: string
    status: string
    error_message: string | null
    finished_at: string | null
    batch_id: string
  }>(
    `SELECT id, site_code, status, error_message, finished_at::text AS finished_at, batch_id
     FROM sync_package_log
     WHERE status IN ('failed', 'partial') AND finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT $1`,
    [MAX_ALERTS_PER_SOURCE]
  )
  return r.rows.map((row) => ({
    id: `sync-pkg-${row.id}`,
    title: `同步包失败: ${row.batch_id}`,
    severity: row.status === "failed" ? ("critical" as const) : ("warning" as const),
    message: row.error_message ?? `包处理状态: ${row.status}`,
    time: row.finished_at ?? new Date().toISOString(),
    status: "active" as const,
    type: "sync" as const,
    site_code: row.site_code,
  }))
}

async function fetchFailedSyncTables(): Promise<RawAlert[]> {
  const r = await query<{
    id: string
    site_code: string
    table_name: string
    error_message: string | null
    finished_at: string | null
    batch_id: string
  }>(
    `SELECT id, site_code, table_name, error_message, finished_at::text AS finished_at, batch_id
     FROM sync_table_log
     WHERE status = 'failed' AND failed_count > 0 AND finished_at IS NOT NULL
     ORDER BY finished_at DESC
     LIMIT $1`,
    [MAX_ALERTS_PER_SOURCE]
  )
  return r.rows.map((row) => ({
    id: `sync-tbl-${row.id}`,
    title: `表同步失败: ${row.table_name}`,
    severity: "warning" as const,
    message: row.error_message ?? `${row.table_name} (${row.batch_id}) 失败`,
    time: row.finished_at ?? new Date().toISOString(),
    status: "active" as const,
    type: "table" as const,
    site_code: row.site_code,
  }))
}

async function fetchFailedControlCommands(): Promise<RawAlert[]> {
  const r = await query<{
    id: string
    source_site_id: string
    command_no: string
    command_type: string
    status: string
    error_message: string | null
    completed_at: string | null
  }>(
    `SELECT id, source_site_id, command_no, command_type, status, error_message, completed_at::text AS completed_at
     FROM control_command
     WHERE status IN ('failed', 'cancelled') AND completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT $1`,
    [MAX_ALERTS_PER_SOURCE]
  )
  return r.rows.map((row) => ({
    id: `ctrl-cmd-${row.id}`,
    title: `控制命令 ${row.status === "failed" ? "失败" : "取消"}: ${row.command_type}`,
    severity: row.status === "failed" ? ("critical" as const) : ("warning" as const),
    message: row.error_message ?? `命令 ${row.command_no} 状态: ${row.status}`,
    time: row.completed_at ?? new Date().toISOString(),
    status: "active" as const,
    type: "control" as const,
    site_code: row.source_site_id,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1")
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
    const level = searchParams.get("level")
    const status = searchParams.get("status")
    const siteCode = searchParams.get("siteCode")

    // 1. 并行查 3 个真实源
    const [syncPkgs, syncTables, ctrlCmds] = await Promise.all([
      fetchFailedSyncPackages(),
      fetchFailedSyncTables(),
      fetchFailedControlCommands(),
    ])

    // 2. 合并 + 按时间倒序
    let merged: RawAlert[] = [...syncPkgs, ...syncTables, ...ctrlCmds].sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    )

    // 3. 过滤
    if (level && level !== "all") {
      merged = merged.filter((a) => a.severity === level)
    }
    if (status && status !== "all") {
      merged = merged.filter((a) => a.status === status)
    }
    if (siteCode) {
      merged = merged.filter((a) => a.site_code === siteCode)
    }

    // 4. 分页
    const total = merged.length
    const start = (page - 1) * pageSize
    const pageItems = merged.slice(start, start + pageSize)

    // 5. 转 DTO (用 alert-adapter 的 MockAlert 接口, 不重复实现)
    const mockShaped: MockAlert[] = pageItems.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      severity: a.severity,
      status: a.status,
      message: a.message,
      time: a.time,
      siteCode: a.site_code ?? undefined,
    }))
    const adapted = adaptAlertList(mockShaped)

    const response: ApiResponse<PaginatedResponse<AlertDTO>> = {
      code: 0,
      message: "ok",
      data: {
        items: adapted,
        page,
        pageSize,
        total,
      },
      traceId: `api-${Date.now()}`,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/alerts:", error)
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
