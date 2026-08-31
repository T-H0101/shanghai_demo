/**
 * 存储卷「分配介质」：按设备分组（光库带 RFID，其他带 IP:port）
 * 数据均来自中心库 unified_*，不直连站点库。
 */

import { query } from "@/lib/db"
import {
  DEVICE_TYPE_LABELS,
  isOpticalDeviceTypeLabel,
  pickDeviceIp,
  pickDevicePort,
  resolveDeviceTypeLabel,
} from "@/lib/devices/device-display"
import {
  displaySlotIndex,
  normalizeOpticalDiscType,
  type OpticalDiscType,
} from "@/lib/devices/disc-slot-display"

export interface VolumeMediaCell {
  slotId: string
  /** 展示盘号 */
  displayNo: number
  discType: OpticalDiscType | null
  onLine: number | null
}

export interface VolumeMediaGroup {
  key: string
  deviceId: string | null
  deviceName: string
  deviceType: string | null
  deviceTypeLabel: string | null
  /** 光库才有 */
  cageRfid: string | null
  /** 非光库：IP:port 或 IP */
  endpoint: string | null
  isOptical: boolean
  mediaKind: "disc" | "disk" | "tape" | "media"
  mediaCount: number
  title: string
  cells: VolumeMediaCell[]
}

type AllocRow = {
  slot_id: string
  on_line: number | null
  slot_num: string | number | null
  slot_code: string | null
  slot_index: number | null
  disc_type_raw: string | number | null
  mag_rfid: string | null
  device_id: string | null
  device_name: string | null
  device_type: string | null
  ip_address: string | null
  device_raw: Record<string, unknown> | null
  via_hd: boolean
}

function mediaKindForDevice(
  typeLabel: string | undefined,
  viaHd: boolean,
): VolumeMediaGroup["mediaKind"] {
  if (isOpticalDeviceTypeLabel(typeLabel)) return "disc"
  if (viaHd || (typeLabel && (typeLabel.includes("硬盘") || typeLabel.includes("SAS")))) return "disk"
  if (typeLabel && typeLabel.includes("磁带")) return "tape"
  return "media"
}

function mediaKindLabel(kind: VolumeMediaGroup["mediaKind"]): string {
  switch (kind) {
    case "disc":
      return "光盘"
    case "disk":
      return "硬盘"
    case "tape":
      return "磁带"
    default:
      return "介质"
  }
}

function buildEndpoint(
  deviceRaw: Record<string, unknown> | null,
  ipAddress: string | null,
): string | null {
  const ip =
    (ipAddress && ipAddress.trim()) ||
    pickDeviceIp(deviceRaw) ||
    null
  if (!ip) return null
  const port = pickDevicePort(deviceRaw)
  return port ? `${ip}:${port}` : ip
}

function buildTitle(parts: {
  deviceName: string
  isOptical: boolean
  cageRfid: string | null
  endpoint: string | null
  typeLabel: string | null
  mediaKind: VolumeMediaGroup["mediaKind"]
  mediaCount: number
}): string {
  const typePart = parts.typeLabel ? `（${parts.typeLabel}）` : ""
  const countPart = `${mediaKindLabel(parts.mediaKind)}:${parts.mediaCount}`
  if (parts.isOptical && parts.cageRfid) {
    return `${parts.deviceName} · ${parts.cageRfid}${typePart}  ${countPart}`
  }
  if (parts.endpoint) {
    return `${parts.deviceName} · ${parts.endpoint}${typePart}  ${countPart}`
  }
  return `${parts.deviceName}${typePart}  ${countPart}`
}

/** 将扁平分配行分组为 UI 结构（纯函数，便于自检） */
export function groupVolumeMediaRows(rows: AllocRow[]): VolumeMediaGroup[] {
  const map = new Map<string, VolumeMediaGroup>()

  for (const row of rows) {
    const typeLabel =
      resolveDeviceTypeLabel(row.device_type) ??
      (row.device_type ? DEVICE_TYPE_LABELS[row.device_type] ?? row.device_type : null)
    const isOptical = isOpticalDeviceTypeLabel(typeLabel ?? undefined)
    const deviceName = (row.device_name && row.device_name.trim()) || "未知设备"
    const cageRfid = isOptical && row.mag_rfid?.trim() ? row.mag_rfid.trim() : null
    const endpoint = isOptical ? null : buildEndpoint(row.device_raw, row.ip_address)
    const deviceId = row.device_id?.trim() || null
    const groupKey = [
      deviceId ?? "unknown",
      isOptical ? cageRfid ?? "_" : endpoint ?? "_",
    ].join("|")

    let group = map.get(groupKey)
    if (!group) {
      const kind = mediaKindForDevice(typeLabel ?? undefined, row.via_hd)
      group = {
        key: groupKey,
        deviceId,
        deviceName,
        deviceType: row.device_type,
        deviceTypeLabel: typeLabel,
        cageRfid,
        endpoint,
        isOptical,
        mediaKind: kind,
        mediaCount: 0,
        title: "",
        cells: [],
      }
      map.set(groupKey, group)
    }

    const discType = normalizeOpticalDiscType(
      row.disc_type_raw != null && row.disc_type_raw !== ""
        ? Number(row.disc_type_raw)
        : null,
    )
    // 展示盘号对齐业务：slot_order（0-based）+ 1；无物理位时才回退 slot_num
    const displayNo =
      row.slot_index != null && Number.isFinite(row.slot_index)
        ? displaySlotIndex(row.slot_index)
        : (() => {
            const fromSlotNum =
              row.slot_num != null && row.slot_num !== ""
                ? Number(row.slot_num)
                : null
            return fromSlotNum != null && Number.isFinite(fromSlotNum) && fromSlotNum > 0
              ? Math.trunc(fromSlotNum)
              : displaySlotIndex(null)
          })()

    group.cells.push({
      slotId: row.slot_id,
      displayNo,
      discType,
      onLine: row.on_line,
    })
  }

  const groups = Array.from(map.values())
  for (const g of groups) {
    g.cells.sort((a, b) => a.displayNo - b.displayNo)
    g.mediaCount = g.cells.length
    g.title = buildTitle({
      deviceName: g.deviceName,
      isOptical: g.isOptical,
      cageRfid: g.cageRfid,
      endpoint: g.endpoint,
      typeLabel: g.deviceTypeLabel,
      mediaKind: g.mediaKind,
      mediaCount: g.mediaCount,
    })
  }

  groups.sort((a, b) => a.deviceName.localeCompare(b.deviceName, "zh-CN"))
  return groups
}

/**
 * 查询某站点某卷的分配介质并按设备分组。
 * 光/磁带：volume_slot → slots → magazines → devices
 * 硬盘：volume_slot → hard_disks → slots(serial) → magazines → devices
 */
export async function loadVolumeMediaGroups(
  siteCode: string,
  volumeId: string,
): Promise<VolumeMediaGroup[]> {
  const res = await query<AllocRow>(
    `WITH vs AS (
       SELECT
         vs.slot_id::text AS slot_id,
         vs.on_line,
         vs.slot_num,
         vs.slot_code,
         vs.source_site_id
       FROM unified_volume_slots vs
       WHERE vs.source_site_id = $1
         AND vs.volume_id = $2
     ),
     direct AS (
       SELECT
         vs.slot_id,
         vs.on_line,
         vs.slot_num,
         vs.slot_code,
         s.slot_index,
         COALESCE(
           NULLIF(s.raw_data->>'disc_type', ''),
           NULLIF(s.media_type, '')
         ) AS disc_type_raw,
         m.rfid AS mag_rfid,
         COALESCE(s.device_id, m.device_id) AS device_id,
         d.device_name,
         d.device_type,
         d.ip_address,
         d.raw_data AS device_raw,
         FALSE AS via_hd
       FROM vs
       INNER JOIN unified_slots s
         ON s.source_site_id = vs.source_site_id
        AND (
          s.slot_id = vs.slot_id
          OR s.source_id = vs.slot_id
          OR s.source_record_id = vs.slot_id
        )
       LEFT JOIN unified_magazines m
         ON m.source_site_id = s.source_site_id
        AND (
          m.magazine_id = s.magazine_id
          OR m.source_id = s.magazine_id
          OR m.source_record_id = s.magazine_id
        )
       LEFT JOIN unified_devices d
         ON d.source_site_id = COALESCE(s.source_site_id, m.source_site_id)
        AND (
          d.device_id = COALESCE(s.device_id, m.device_id)
          OR d.source_id = COALESCE(s.device_id, m.device_id)
          OR d.source_record_id = COALESCE(s.device_id, m.device_id)
        )
     ),
     via_hd AS (
       SELECT
         vs.slot_id,
         vs.on_line,
         vs.slot_num,
         vs.slot_code,
         s.slot_index,
         COALESCE(
           NULLIF(s.raw_data->>'disc_type', ''),
           NULLIF(s.media_type, '')
         ) AS disc_type_raw,
         m.rfid AS mag_rfid,
         COALESCE(s.device_id, m.device_id) AS device_id,
         d.device_name,
         d.device_type,
         d.ip_address,
         d.raw_data AS device_raw,
         TRUE AS via_hd
       FROM vs
       INNER JOIN unified_hard_disks hd
         ON hd.source_site_id = vs.source_site_id
        AND (
          hd.source_id = vs.slot_id
          OR hd.source_record_id = vs.slot_id
          OR hd.disk_id = vs.slot_id
        )
       INNER JOIN unified_slots s
         ON s.source_site_id = vs.source_site_id
        AND (
          NULLIF(s.raw_data->>'serial_num', '') = hd.serial_no
          OR NULLIF(s.raw_data->>'serial_no', '') = hd.serial_no
        )
        AND hd.serial_no IS NOT NULL
        AND hd.serial_no <> ''
       LEFT JOIN unified_magazines m
         ON m.source_site_id = s.source_site_id
        AND (
          m.magazine_id = s.magazine_id
          OR m.source_id = s.magazine_id
          OR m.source_record_id = s.magazine_id
        )
       LEFT JOIN unified_devices d
         ON d.source_site_id = COALESCE(s.source_site_id, m.source_site_id)
        AND (
          d.device_id = COALESCE(s.device_id, m.device_id)
          OR d.source_id = COALESCE(s.device_id, m.device_id)
          OR d.source_record_id = COALESCE(s.device_id, m.device_id)
        )
       WHERE NOT EXISTS (
         SELECT 1 FROM direct di WHERE di.slot_id = vs.slot_id
       )
     ),
     orphan AS (
       SELECT
         vs.slot_id,
         vs.on_line,
         vs.slot_num,
         vs.slot_code,
         NULL::int AS slot_index,
         NULL::text AS disc_type_raw,
         NULL::text AS mag_rfid,
         NULL::text AS device_id,
         NULL::text AS device_name,
         NULL::text AS device_type,
         NULL::text AS ip_address,
         NULL::jsonb AS device_raw,
         EXISTS (
           SELECT 1 FROM unified_hard_disks hd
           WHERE hd.source_site_id = vs.source_site_id
             AND (
               hd.source_id = vs.slot_id
               OR hd.source_record_id = vs.slot_id
             )
         ) AS via_hd
       FROM vs
       WHERE NOT EXISTS (SELECT 1 FROM direct di WHERE di.slot_id = vs.slot_id)
         AND NOT EXISTS (SELECT 1 FROM via_hd vh WHERE vh.slot_id = vs.slot_id)
     )
     SELECT * FROM direct
     UNION ALL
     SELECT * FROM via_hd
     UNION ALL
     SELECT * FROM orphan`,
    [siteCode, volumeId],
  )

  return groupVolumeMediaRows(res.rows)
}
