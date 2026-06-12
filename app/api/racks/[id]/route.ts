/**
 * GET /api/racks/[id]
 * 盘架详情 API (R.17 真实化)
 *
 * R.17 修改: 从 mock racks[] 改为 unified_devices 真实查询,
 * 含 slot/magazine 真实关联。
 *
 * 返回:
 *   - rack: RackDTO (含 slot/magazine 聚合)
 *   - cages: 按盘匣分组的 slot 列表
 *   - sourceEvidence: { sourceTable, sourceId, rawData, syncedAt, mapper } 强制披露
 *
 * 严格:
 *   - 不 mock fallback
 *   - 缺数据 → 404 + blocker (R.1 §一)
 *   - 含 sourceEvidence 字段 (R.5 §10 + R.17 §任务 3)
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import type { ApiResponse, RackDTO, RackSlotGroupDTO, RackSlotDTO, SlotStatus, MediaType, OnlineStatus, RackStatus, DeviceMode } from "@/lib/api/dto"

const DEVICE_TYPE_LABELS: Record<string, string> = {
  gen2_library: "Gen2 光盘库",
  gen2_offline: "Gen2 离线库",
  gen1_legacy: "Gen1 旧库",
  gen1_new: "Gen1 新库",
  gen1_offline: "Gen1 离线库",
  gen3_library: "Gen3 光盘库",
  publisher: "光盘打印机",
  hdd_library: "智能硬盘库",
  tape_library: "磁带库",
  tape_drive: "磁带机",
  sas_hdd_library: "SAS 硬盘库",
  film_library: "胶片库",
  nas: "NAS",
  alarm: "告警设备",
  gen4_library: "Gen4 光盘库",
}

const DEVICE_STATUS_MAP: Record<string, OnlineStatus> = {
  online: "online", offline: "offline", deleted: "offline", warning: "offline", error: "offline",
}

const RACK_STATUS_MAP: Record<string, RackStatus> = {
  online: "normal", offline: "fault", deleted: "fault", warning: "warning", error: "fault",
}

// R.17: tbl_slots.disc_type 数值 → 介质类型 + 状态
// disc_type: 0=空位, 1=新盘未使用, 2=封盘, 3=有剩余容量, 4=损坏, 5=硬盘格式化中, 10=中间状态
// hd_type:   0=光盘, 1=硬盘, 2=磁带, 3=阵列
function discTypeToMediaType(discType: number | null | undefined, hdType: number | null | undefined): { mediaType: MediaType; slotStatus: SlotStatus; occupied: boolean } {
  if (hdType === 1) return { mediaType: "hdd", slotStatus: "used", occupied: true }
  if (hdType === 2) return { mediaType: "offline", slotStatus: "used", occupied: true } // 磁带当 offline
  if (hdType === 3) return { mediaType: "hdd", slotStatus: "used", occupied: true } // 阵列按 hdd
  if (discType === 0) return { mediaType: "offline", slotStatus: "free", occupied: false }
  if (discType === 1) return { mediaType: "bd", slotStatus: "used", occupied: true }
  if (discType === 2) return { mediaType: "bd", slotStatus: "used", occupied: true }
  if (discType === 3) return { mediaType: "bd", slotStatus: "used", occupied: true }
  if (discType === 4) return { mediaType: "offline", slotStatus: "error", occupied: true }
  if (discType === 5) return { mediaType: "hdd", slotStatus: "empty", occupied: true } // 格式化中
  return { mediaType: "offline", slotStatus: "empty", occupied: false }
}

function formatBytes(bytes: number | null | undefined): string | undefined {
  if (bytes == null || bytes <= 0) return undefined
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(1)} ${units[i]}`
}

interface DeviceRow {
  device_id: string
  device_name: string | null
  device_type: string
  status: string | null
  ip_address: string | null
  source_site_id: string
  site_code: string | null
  slot_count: number | null
  cage_count: number | null
  model: string | null
  manufacturer: string | null
  serial_no: string | null
  synced_at: Date | string
  total_capacity: number | null
  used_capacity: number | null
  used_slots: number | null
}

interface SlotRow {
  source_id: string
  source_site_id: string
  slot_id: string | null
  slot_index: number | null
  device_id: string | null
  magazine_id: string | null
  status: string | null
  occupied: boolean | null
  media_id: string | null
  media_type: string | null
  capacity: string | null
  serial_num: string | null
  raw_data: any
}

interface MagazineRow {
  source_id: string
  source_site_id: string
  magazine_id: string | null
  device_id: string | null
  status: string | null
  position: string | null
  slot_count: number | null
  barcode: string | null
  rfid: string | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json(
        { code: 400, message: "missing id", data: null, traceId: `api-${Date.now()}` },
        { status: 400 }
      )
    }

    // 1. 查设备 (用 source_id 或 device_id, 兼容两种)
    const devRes = await query<DeviceRow>(
      `SELECT device_id, device_name, device_type, status, ip_address,
              source_site_id, site_code, slot_count, cage_count,
              model, manufacturer, serial_no, synced_at,
              total_capacity, used_capacity, used_slots
       FROM unified_devices
       WHERE device_id = $1 OR source_id = $1
       LIMIT 1`,
      [id]
    )
    const dev = devRes.rows[0]
    if (!dev) {
      return NextResponse.json(
        { code: 404, message: "Rack not found", data: null, blocker: "blocked_by_source_schema" as any, traceId: `api-${Date.now()}` },
        { status: 404 }
      )
    }

    // 2. 查该设备下所有盘匣 (按 site 拉所有, R.17 简化为 site 级)
    //    unified_magazines.device_id 存的是源端 lib_id (int), unified_devices.device_id 存的是 uuid
    //    关联: source lib_id 通过 tbl_magzines 同步时存进 unified_magazines.device_id
    //    暂时按 source_site_id 拉, 在前端按 position 排序
    const magsAll = (await query<MagazineRow>(
      `SELECT source_id, source_site_id, magazine_id, device_id, status,
              position, slot_count, barcode, rfid
       FROM unified_magazines
       WHERE source_site_id = $1
       ORDER BY magazine_id NULLS LAST, source_id`,
      [dev.source_site_id]
    )).rows

    // 3. 查该设备下所有 slot
    const slotRes = await query<SlotRow>(
      `SELECT source_id, source_site_id, slot_id, slot_index, device_id, magazine_id,
              status, occupied, media_id, media_type, capacity, raw_data
       FROM unified_slots
       WHERE source_site_id = $1
       ORDER BY magazine_id NULLS LAST, slot_index NULLS LAST, source_id`,
      [dev.source_site_id]
    )
    const slots = slotRes.rows
    // 取 serial_num 从 raw_data (mapper 未独立映射, R.17 增强)
    for (const s of slots) {
      if (!s.serial_num) s.serial_num = s.raw_data?.serial_num ?? undefined
    }

    // 4. 查 unified_disc_media 关联 slot_id
    const slotIds = slots.map(s => s.source_id).filter(Boolean)
    const discMediaBySlot = new Map<string, any>()
    if (slotIds.length > 0) {
      const dmRes = await query<{ slot_id: number | null; disc_label: string | null; source_id: string; used_size: number | null }>(
        `SELECT slot_id, disc_label, source_id, used_size FROM unified_disc_media
         WHERE source_site_id = $1 AND slot_id = ANY($2::int[])`,
        [dev.source_site_id, slotIds.map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n))]
      )
      for (const r of dmRes.rows) {
        if (r.slot_id != null) discMediaBySlot.set(String(r.slot_id), r)
      }
    }

    // 5. 查 unified_hard_disks 关联
    const hdBySlot = new Map<string, any>()
    if (slotIds.length > 0) {
      const hdRes = await query<{ source_id: string; model: string | null; total_capacity: number | null; used_capacity: number | null; health_status: string | null }>(
        `SELECT source_id, model, total_capacity, used_capacity, health_status FROM unified_hard_disks
         WHERE source_site_id = $1 AND source_id = ANY($2::text[])`,
        [dev.source_site_id, slotIds]
      )
      for (const r of hdRes.rows) hdBySlot.set(r.source_id, r)
    }

    // 6. 查 volume-slot 关联 (走 unified_volumes.raw_data._aggregate + 站点源表, R.17 加)
    const volSlotBySlot = new Map<string, any[]>()
    // 中心表已聚合在 unified_volumes.raw_data._aggregate.slot_count, 不存 slot→volume 反向
    // R.17 决定: 走站点 source_restore 直查 (跨库)
    const siteDbUrl = process.env.SITE_DATABASE_URL
    if (siteDbUrl) {
      try {
        const { sourceQuery } = await import("@/lib/db/source-pool")
        const vsRes = await sourceQuery<{ slot_id: number; volume_id: number; on_line: number }>(
          `SELECT slot_id, volume_id, on_line FROM tbl_volume_slot`
        )
        for (const r of vsRes.rows) {
          const arr = volSlotBySlot.get(String(r.slot_id)) ?? []
          arr.push(r)
          volSlotBySlot.set(String(r.slot_id), arr)
        }
      } catch { /* 站点不可达, 跳过 volume 关联 */ }
    }

    // 7. 构造 cages (按盘匣分组)
    const magsById = new Map<string, MagazineRow>()
    for (const m of magsAll) magsById.set(m.magazine_id ?? m.source_id, m)

    const slotsByMag = new Map<string, SlotRow[]>()
    for (const s of slots) {
      const mid = s.magazine_id ?? "_unassigned"
      const arr = slotsByMag.get(mid) ?? []
      arr.push(s)
      slotsByMag.set(mid, arr)
    }

    const slotGroups: RackSlotGroupDTO[] = []
    for (const [mid, magsList] of Array.from(slotsByMag.entries())) {
      const mag = mid === "_unassigned" ? null : magsById.get(mid)
      const slotDtos: RackSlotDTO[] = magsList.map(s => {
        const slotIdInt = s.slot_id ? parseInt(s.slot_id, 10) : null
        const raw = s.raw_data ?? {}
        const dt = raw.disc_type as number | undefined
        const ht = raw.hd_type as number | undefined
        const { mediaType, slotStatus, occupied } = discTypeToMediaType(dt, ht)
        const disc = slotIdInt != null ? discMediaBySlot.get(String(slotIdInt)) : undefined
        const hd = hdBySlot.get(s.source_id)
        const vss = slotIdInt != null ? volSlotBySlot.get(String(slotIdInt)) : undefined

        return {
          id: s.source_id,
          index: s.slot_index ?? 0,
          occupied: s.occupied ?? occupied,
          status: slotStatus,
          sourceSiteId: s.source_site_id,
          sourceTable: "tbl_slots",
          sourceId: s.source_id,
          cageId: mid === "_unassigned" ? "" : mid,
          cageName: mag?.rfid ?? mag?.barcode ?? `盘匣-${mid}`,
          cageIndex: mag?.position ? parseInt(mag.position, 10) : 0,
          slotId: s.slot_id ?? s.source_id,
          discNo: disc?.disc_label ?? s.serial_num ?? s.source_id,
          label: s.serial_num ?? disc?.disc_label ?? undefined,
          mediaType,
          capacity: formatBytes(s.capacity ? Number(s.capacity) : null) ?? undefined,
          usedCapacity: disc?.used_size ? formatBytes(disc.used_size) : (hd?.used_capacity ? formatBytes(hd.used_capacity) : undefined),
          remainingCapacity: undefined,
          volumeId: vss?.[0] ? String(vss[0].volume_id) : undefined,
        }
      })

      slotGroups.push({
        cageId: mid === "_unassigned" ? "" : mid,
        cageName: mid === "_unassigned" ? "未分配盘匣" : (mag?.rfid ?? mag?.barcode ?? `盘匣-${mid}`),
        cageIndex: mag?.position ? parseInt(mag.position, 10) : 0,
        slots: slotDtos,
      })
    }
    slotGroups.sort((a, b) => a.cageIndex - b.cageIndex)

    // 8. 构造 rack DTO
    const totalCapacity = dev.total_capacity
    const usedCapacity = dev.used_capacity
    const usagePercent = totalCapacity != null && totalCapacity > 0 && usedCapacity != null
      ? Math.round((usedCapacity / totalCapacity) * 100)
      : undefined
    const usedSlotsCount = slots.filter(s => s.occupied).length

    const rack: RackDTO = {
      id: dev.device_id,
      rackId: dev.device_id,
      rackName: dev.device_name ?? `设备-${dev.device_id}`,
      siteName: dev.site_code ?? dev.source_site_id,
      siteCode: dev.source_site_id,
      datacenter: "",
      cages: slotGroups.map(g => g.cageName),
      totalSlots: dev.slot_count ?? slots.length,
      usedSlots: dev.used_slots ?? usedSlotsCount,
      usagePercent,
      status: RACK_STATUS_MAP[dev.status ?? ""] ?? "fault",
      lastSyncAt: typeof dev.synced_at === "string" ? dev.synced_at : dev.synced_at.toISOString(),
      ip: dev.ip_address ?? undefined,
      deviceType: DEVICE_TYPE_LABELS[dev.device_type] ?? dev.device_type,
      deviceStatus: DEVICE_STATUS_MAP[dev.status ?? ""] ?? "offline",
      onlineStatus: DEVICE_STATUS_MAP[dev.status ?? ""] ?? "offline",
      totalCapacity: formatBytes(totalCapacity),
      remainingCapacity: totalCapacity && usedCapacity != null ? formatBytes(totalCapacity - usedCapacity) : undefined,
      currentTaskCount: 0,
      cageCount: dev.cage_count ?? slotGroups.length,
      slots: slots.map(s => ({
        id: s.source_id,
        index: s.slot_index ?? 0,
        occupied: s.occupied ?? false,
        status: "free" as SlotStatus,
        sourceSiteId: s.source_site_id,
        sourceTable: "tbl_slots",
        sourceId: s.source_id,
      })),
    }

    const response = {
      code: 0,
      message: "ok",
      data: {
        ...rack,
        cages: slotGroups,
      },
      source: "database" as const,
      sourceEvidence: {
        sourceTable: "unified_devices",
        sourceId: dev.device_id,
        rawData: { device: dev, slotCount: slots.length, magazineCount: slotGroups.length },
        syncedAt: rack.lastSyncAt,
        mapper: "R.17 inlineUpsert (Sprint 2H.2)",
      },
      traceId: `api-${Date.now()}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[API Error] /api/racks/[id]:", error)
    return NextResponse.json(
      { code: 500, message: "Internal server error", data: null, traceId: `api-${Date.now()}` },
      { status: 500 }
    )
  }
}
