/**
 * Alert Adapter - 告警数据适配器
 * 将 Mock/DB 数据转换为 AlertDTO
 */

import type { AlertDTO, AlertStatsDTO } from "@/lib/api/dto"

// AlertSeverity 映射
const SEVERITY_MAP: Record<string, AlertDTO["severity"]> = {
  critical: "critical",
  warning: "warning",
}

// AlertStatus 映射
const STATUS_MAP: Record<string, AlertDTO["status"]> = {
  active: "active",
  resolved: "resolved",
  acknowledged: "acknowledged",
}

// 安全的类型转换
function safeAdaptSeverity(severity: string): AlertDTO["severity"] {
  return SEVERITY_MAP[severity] ?? "warning"
}

function safeAdaptAlertStatus(status: string): AlertDTO["status"] {
  return STATUS_MAP[status] ?? "active"
}

export interface MockAlert {
  id: string
  title: string
  type?: string
  severity: string
  status?: string
  message?: string
  level?: string
  deviceId?: string
  deviceName?: string
  siteCode?: string
  siteName?: string
  time?: string
  createdAt?: string
}

export function adaptAlert(alert: MockAlert): AlertDTO {
  return {
    id: alert.id,
    title: alert.title ?? "",
    type: alert.type ?? "",
    severity: safeAdaptSeverity(alert.severity ?? alert.level ?? "warning"),
    status: safeAdaptAlertStatus(alert.status ?? "active"),
    message: alert.message ?? "",
    deviceId: alert.deviceId,
    deviceName: alert.deviceName,
    siteCode: alert.siteCode,
    siteName: alert.siteName,
    createdAt: alert.time ?? alert.createdAt ?? new Date().toISOString(),
  }
}

export function adaptAlertList(alerts: MockAlert[]): AlertDTO[] {
  return alerts.map(adaptAlert)
}

export function adaptAlertStats(alerts: MockAlert[]): AlertStatsDTO {
  const critical = alerts.filter(a => a.severity === "critical" || a.level === "critical").length
  const warning = alerts.filter(a => a.severity === "warning" || a.level === "warning").length
  const active = alerts.filter(a => a.status === "active").length

  return {
    total: alerts.length,
    critical,
    warning,
    active,
  }
}
