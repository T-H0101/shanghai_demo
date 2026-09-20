/**
 * tbl_disc_lib.type → unified_devices.device_type 后的中文展示
 * 文案与 disc_files.sql / 业务系统注释一致
 */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
  gen2_library: "二代库",
  gen2_offline: "二代离线库",
  gen1_legacy: "一代旧库",
  gen1_new: "一代新库",
  gen1_offline: "一代离线库",
  gen3_library: "三代库",
  publisher: "出版设备",
  hdd_library: "硬盘库",
  tape_library: "磁带库",
  tape_drive: "磁带机",
  sas_hdd_library: "新SAS硬盘库",
  film_library: "胶片库",
  nas: "网盘",
  alarm: "报警器",
  gen4_library: "四代库",
}

const OPTICAL_LABELS = new Set([
  "二代库",
  "一代旧库",
  "一代新库",
  "三代库",
  "四代库",
])

const HDD_LABELS = new Set(["硬盘库", "新SAS硬盘库"])

const OFFLINE_LIBRARY_LABELS = new Set(["二代离线库", "一代离线库"])

const TAPE_LABELS = new Set(["磁带库", "磁带机"])

export function isOpticalDeviceTypeLabel(label: string | undefined): boolean {
  return !!label && OPTICAL_LABELS.has(label)
}

export function isHddDeviceTypeLabel(label: string | undefined): boolean {
  return !!label && HDD_LABELS.has(label)
}

/** 离线库设备类型（与光盘库/硬盘库同级，非在线/离线状态） */
export function isOfflineLibraryTypeLabel(label: string | undefined): boolean {
  return !!label && OFFLINE_LIBRARY_LABELS.has(label)
}

export function isTapeDeviceTypeLabel(label: string | undefined): boolean {
  return !!label && TAPE_LABELS.has(label)
}

/** 解析设备类型编码或中文标签，用于盘位分组标题策略 */
export function resolveDeviceTypeLabel(deviceType: string | null | undefined): string | undefined {
  if (!deviceType) return undefined
  return DEVICE_TYPE_LABELS[deviceType] ?? deviceType
}

export function isNasDeviceTypeLabel(label: string | undefined): boolean {
  if (!label) return false
  return label === "网盘" || label.includes("网盘") || label.includes("NAS") || label.includes("CIFS")
}

/** 兼容源包键名大小写（MySQL 常为 IP，PG 常为 ip） */
export function pickDeviceIp(source: Record<string, unknown> | null | undefined): string | null {
  if (!source) return null
  for (const key of ["ip", "IP", "ip_address"]) {
    const v = source[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/** 兼容源包键名（tbl_disc_lib.port / device_port / listen_port） */
export function pickDevicePort(source: Record<string, unknown> | null | undefined): string | null {
  if (!source) return null
  for (const key of ["port", "PORT", "device_port", "listen_port"]) {
    const v = source[key]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return null
}
