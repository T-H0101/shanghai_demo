/**
 * GET /api/alerts
 * 告警列表 API
 *
 * @legacy Sprint 2A 临时实现: 直接 import lib/mock 数据拼接
 *   Sprint 4.7+ 计划: 改为统一 /api/dashboard/alerts 真实聚合
 *   详见 docs/summary/CODEBASE_QUALITY_AUDIT.md §4.4
 */

import { NextRequest, NextResponse } from "next/server"
import { taskAlerts } from "@/lib/mock/tasks"
import { racks } from "@/lib/mock/racks"
import { sites } from "@/lib/mock/sites"
import { adaptAlertList } from "@/lib/api/adapters"
import type { ApiResponse, PaginatedResponse, AlertDTO } from "@/lib/api/dto"

// 构造告警数据
interface AlertItem {
  id: string
  title: string
  severity: string
  message: string
  time: string
  status: string
  type: string
  siteCode?: string
  siteName?: string
  deviceId?: string
  deviceName?: string
}

function buildAlerts(): AlertItem[] {
  const alerts: AlertItem[] = [
    ...taskAlerts.map(alert => ({
      id: alert.id,
      title: alert.taskName,
      severity: alert.level,
      message: alert.message,
      time: alert.time,
      status: "active",
      type: "task",
    })),
    // 从站点添加告警
    ...sites
      .filter(s => s.alertCount && s.alertCount > 0)
      .flatMap(s =>
        Array.from({ length: s.alertCount ?? 0 }, (_, i): AlertItem => ({
          id: `site-alert-${s.id}-${i}`,
          title: `${s.name} 设备告警`,
          severity: i === 0 ? "critical" : "warning",
          message: s.description ?? "站点设备异常",
          time: s.lastSyncAt,
          status: "active",
          type: "device",
          siteCode: s.code,
          siteName: s.name,
        }))
      ),
    // 从盘架添加告警
    ...racks
      .filter(r => r.status === "fault" || r.status === "warning")
      .map(r => ({
        id: `rack-alert-${r.id}`,
        title: `${r.rackName} 状态异常`,
        severity: r.status === "fault" ? "critical" : "warning",
        message: `设备状态: ${r.status === "fault" ? "离线故障" : "警告"}`,
        time: r.lastSyncAt,
        status: "active",
        type: "device",
        deviceId: r.id,
        deviceName: r.rackName,
        siteCode: r.siteCode,
        siteName: r.siteName,
      })),
  ]
  return alerts
}

const allAlerts = buildAlerts()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") ?? "1")
    const pageSize = parseInt(searchParams.get("pageSize") ?? "20")
    const level = searchParams.get("level")
    const status = searchParams.get("status")
    const siteCode = searchParams.get("siteCode")

    // 过滤
    let filteredAlerts = [...allAlerts]
    if (level && level !== "all") {
      filteredAlerts = filteredAlerts.filter(a => a.severity === level)
    }
    if (status && status !== "all") {
      filteredAlerts = filteredAlerts.filter(a => a.status === status)
    }
    if (siteCode) {
      filteredAlerts = filteredAlerts.filter(a => a.siteCode === siteCode)
    }

    // 分页
    const total = filteredAlerts.length
    const start = (page - 1) * pageSize
    const paginatedAlerts = filteredAlerts.slice(start, start + pageSize)

    // 转换
    const adaptedAlerts = adaptAlertList(paginatedAlerts)

    const response: ApiResponse<PaginatedResponse<AlertDTO>> = {
      code: 0,
      message: "ok",
      data: {
        items: adaptedAlerts,
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
