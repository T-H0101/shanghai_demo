/**
 * unified_devices.status ← tbl_disc_lib.device_status
 *
 * 源注释: 1在线，0离线，2删除，3警告（光驱坏1个），4错误（光驱全坏）
 */

import type { RackStatus } from "@/lib/api/dto"

/** 列表/徽章用设备运行态（不含 deleted，删除设备应过滤） */
export type DeviceRuntimeStatus = "online" | "offline" | "warning" | "error"

/** 连通性：仅 online / offline */
export type DeviceOnlineStatus = "online" | "offline"

const DELETED_STATUSES = new Set(["deleted"])

export function isDeletedDeviceStatus(status: string | null | undefined): boolean {
  if (status == null || status === "") return false
  return DELETED_STATUSES.has(status)
}

/**
 * unified_devices.status → 设备运行态
 * deleted 不应进入此映射（调用方先过滤）
 */
export function mapUnifiedStatusToDeviceRuntime(
  status: string | null | undefined,
): DeviceRuntimeStatus {
  switch (status) {
    case "online":
      return "online"
    case "offline":
      return "offline"
    case "warning":
      return "warning"
    case "error":
      return "error"
    default:
      // unknown / null：按离线展示，避免误标异常
      return "offline"
  }
}

/** 连通性：仅 device_status=1(online) 为 online */
export function mapUnifiedStatusToOnline(
  status: string | null | undefined,
): DeviceOnlineStatus {
  return status === "online" ? "online" : "offline"
}

/**
 * 健康状态（统计「异常」用）
 * - online / offline → normal（离线不算异常）
 * - warning → warning
 * - error → fault
 */
export function mapUnifiedStatusToRackStatus(
  status: string | null | undefined,
): RackStatus {
  switch (status) {
    case "online":
    case "offline":
      return "normal"
    case "warning":
      return "warning"
    case "error":
      return "fault"
    default:
      return "normal"
  }
}

/** SQL：排除已删除设备 */
export const SQL_EXCLUDE_DELETED_DEVICES = `(status IS NULL OR status <> 'deleted')`

/** 是否计入「异常」统计/筛选 */
export function isAbnormalDevice(opts: {
  deviceStatus?: string | null
  status?: string | null
}): boolean {
  const ds = opts.deviceStatus
  if (ds === "warning" || ds === "error") return true
  const s = opts.status
  return s === "warning" || s === "fault" || s === "maintenance"
}
