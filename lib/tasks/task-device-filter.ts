/**
 * 任务列表按设备 deep link：siteCode + deviceId 精确筛选（对齐 unified_tasks 展示关联逻辑）
 */

export interface TaskDeviceFilterParams {
  siteCode: string
  deviceId: string
  deviceName?: string | null
}

export function buildTaskDeviceFilterHref(params: TaskDeviceFilterParams): string {
  const sp = new URLSearchParams()
  sp.set("siteCode", params.siteCode)
  sp.set("deviceId", params.deviceId)
  const name = params.deviceName?.trim()
  if (name) sp.set("deviceName", name)
  return `/tasks?${sp.toString()}`
}

export function parseTaskDeviceFilter(searchParams: URLSearchParams | null | undefined): {
  deviceId: string | null
  deviceName: string | null
  siteCode: string | null
} {
  if (!searchParams) {
    return { deviceId: null, deviceName: null, siteCode: null }
  }
  return {
    deviceId: searchParams.get("deviceId")?.trim() || null,
    deviceName: searchParams.get("deviceName")?.trim() || null,
    siteCode: searchParams.get("siteCode")?.trim() || null,
  }
}
