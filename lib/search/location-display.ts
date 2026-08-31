/**
 * 统一检索「设备位置」展示文案
 * 光盘：设备 · IP · 盘笼 RFID · 盘位 · A面/B面
 * 硬盘：设备 · IP · 硬盘 SN（不展示假托盘 RFID）
 */

export function formatDeviceEndpoint(
  deviceName?: string | null,
  deviceIp?: string | null,
  devicePort?: string | null,
): string {
  const tip = deviceIp?.trim() || ""
  const port = devicePort?.trim() || ""
  const endpoint = tip ? (port ? `${tip}:${port}` : tip) : ""
  const name = deviceName?.trim() || ""
  if (name && endpoint) return `${name} · ${endpoint}`
  if (name) return name
  return endpoint
}

/** 光盘 AB 面：0=A，1=B（与站点 tbl_slots.disc_side 一致） */
export function formatDiscSideLabel(discSide?: number | null): string | null {
  if (discSide == null || !Number.isFinite(Number(discSide))) return null
  const n = Number(discSide)
  if (n === 0) return "A面"
  if (n === 1) return "B面"
  return null
}

export function formatDeviceLocationLabel(input: {
  volumeType?: number | null
  deviceName?: string | null
  deviceIp?: string | null
  devicePort?: string | null
  magazineRfid?: string | null
  slotOrder?: number | null
  /** 光盘 AB 面：0=A，1=B */
  discSide?: number | null
  serialNum?: string | null
}): string {
  const device = formatDeviceEndpoint(input.deviceName, input.deviceIp, input.devicePort)
  const volumeType = input.volumeType
  const parts: string[] = []
  if (device) parts.push(device)

  if (volumeType === 3) {
    const sn = input.serialNum?.trim()
    if (sn) parts.push(`硬盘 ${sn}`)
  } else if (volumeType === 1 || volumeType == null) {
    // volume_type 缺省时按光盘字段尽力展示（兼容旧索引）
    const rfid = input.magazineRfid?.trim()
    if (rfid) parts.push(`盘笼 ${rfid}`)
    if (input.slotOrder != null && Number.isFinite(input.slotOrder)) {
      parts.push(`盘位 ${input.slotOrder}`)
    }
    const side = formatDiscSideLabel(input.discSide)
    if (side) parts.push(side)
  }

  return parts.length ? parts.join(" · ") : "—"
}

export function isHardDiskVolume(volumeType?: number | null): boolean {
  return volumeType === 3
}

export function canInitiatePhysicalRestore(volumeType?: number | null): boolean {
  // 硬盘暂不支持物理回迁；缺 volume_type 的旧光盘文档仍允许尝试
  return !isHardDiskVolume(volumeType)
}
