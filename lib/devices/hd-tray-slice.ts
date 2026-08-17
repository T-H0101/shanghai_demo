/**
 * 硬盘库托盘槽位裁剪 —— 对齐 MultimediumCentral lib_magInfo / sliceHdLibInfoSlots
 *
 * 触发条件（与业务一致）：
 *   slots.length > 8 && mag.disc_type == 9（硬盘托盘）
 *
 * 分支：
 *   - SAS 新硬盘库 (type=11 / sas_hdd_library)：
 *       2 托盘 → 各取前 12；否则 mag_order===1 取 24，其余取 12
 *   - 普通硬盘库：
 *       2 托盘且 mag_order===1（四代库托盘+片匣）→ 24
 *       mag_order===4（第 5 托盘后仓）→ 4
 *       其余 → 8
 */

export function sliceHdMagazineSlots<T>(
  slots: T[],
  opts: {
    magDiscType: number | null | undefined
    magOrder: number | null | undefined
    magCount: number
    /** unified_devices.device_type，如 hdd_library / sas_hdd_library */
    deviceType: string | null | undefined
  }
): T[] {
  if (!slots || slots.length <= 8) return slots
  if (opts.magDiscType !== 9) return slots

  const magOrder = opts.magOrder ?? 0
  const magCount = opts.magCount
  const isSas = opts.deviceType === "sas_hdd_library"

  if (isSas) {
    if (magCount === 2) return slots.slice(0, 12)
    if (magOrder === 1) return slots.slice(0, 24)
    return slots.slice(0, 12)
  }

  if (magCount === 2 && magOrder === 1) return slots.slice(0, 24)
  if (magOrder === 4) return slots.slice(0, 4)
  return slots.slice(0, 8)
}
