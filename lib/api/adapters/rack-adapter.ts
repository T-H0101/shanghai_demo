/**
 * Rack Adapter - 盘架/设备数据适配器
 * 将 Mock/DB 数据转换为 RackDTO
 */

import type { Rack, RackSlot, RackStats, StorageVolume, DeviceLog } from "@/lib/types/rack"
import type { RackDTO, RackStatsDTO, RackSlotDTO, VolumeDTO } from "@/lib/api/dto"

// RackStatus 映射
const STATUS_MAP: Record<string, RackDTO["status"]> = {
  normal: "normal",
  warning: "warning",
  fault: "fault",
  maintenance: "maintenance",
}

// OnlineStatus 映射
const ONLINE_STATUS_MAP: Record<string, RackDTO["deviceStatus"]> = {
  online: "online",
  offline: "offline",
}

// SlotStatus 映射
const SLOT_STATUS_MAP: Record<string, RackSlotDTO["status"]> = {
  free: "free",
  used: "used",
  error: "error",
  empty: "empty",
}

// MediaType 映射
const MEDIA_TYPE_MAP: Record<string, RackSlotDTO["mediaType"]> = {
  hdd: "hdd",
  bd: "bd",
  offline: "offline",
}

// VolumeType 映射
const VOLUME_TYPE_MAP: Record<string, VolumeDTO["type"]> = {
  optical: "optical",
  magnetic: "magnetic",
  composite: "composite",
}

// 安全的类型转换
function safeAdaptStatus(status: string): RackDTO["status"] {
  return STATUS_MAP[status] ?? "normal"
}

function safeAdaptOnlineStatus(status: string): RackDTO["deviceStatus"] {
  return ONLINE_STATUS_MAP[status] ?? "online"
}

function safeAdaptSlotStatus(status: string): RackSlotDTO["status"] {
  return SLOT_STATUS_MAP[status] ?? "free"
}

function safeAdaptMediaType(type: string | undefined): RackSlotDTO["mediaType"] | undefined {
  if (!type) return undefined
  return MEDIA_TYPE_MAP[type] ?? "hdd"
}

function safeAdaptVolumeType(type: string): VolumeDTO["type"] {
  return VOLUME_TYPE_MAP[type] ?? "composite"
}

function adaptSlot(slot: RackSlot): RackSlotDTO {
  return {
    id: slot.id,
    index: slot.index,
    occupied: slot.occupied ?? false,
    status: safeAdaptSlotStatus(slot.status ?? (slot.occupied ? "used" : "free")),
    discNo: slot.discNo,
    label: slot.label,
    mediaType: safeAdaptMediaType(slot.mediaType),
    capacity: slot.capacity,
    volumeId: slot.volumeId,
  }
}

function adaptVolume(volume: StorageVolume): VolumeDTO {
  return {
    id: volume.id,
    name: volume.name ?? "",
    type: safeAdaptVolumeType(volume.type ?? "composite"),
    totalCapacity: volume.totalCapacity ?? "",
    remainingCapacity: volume.remainingCapacity ?? "",
    info: volume.info ?? "",
    discCount: volume.discCount,
    usedCount: volume.usedCount,
    newCount: volume.newCount,
  }
}

export function adaptRack(rack: Rack): RackDTO {
  return {
    id: rack.id,
    rackId: rack.rackId ?? rack.id,
    rackName: rack.rackName ?? "",
    siteName: rack.siteName ?? "",
    siteCode: rack.siteCode ?? "",
    datacenter: rack.datacenter ?? "",
    cages: rack.cages ?? [],
    totalSlots: rack.totalSlots ?? 0,
    usedSlots: rack.usedSlots ?? 0,
    usagePercent: rack.usagePercent ?? 0,
    status: safeAdaptStatus(rack.status ?? "normal"),
    lastSyncAt: rack.lastSyncAt ?? "",
    floor: rack.floor,
    room: rack.room,

    // 设备信息
    ip: rack.ip,
    deviceType: rack.deviceType,
    deviceStatus: rack.deviceStatus ? safeAdaptOnlineStatus(rack.deviceStatus) : undefined,
    onlineStatus: rack.onlineStatus ? safeAdaptOnlineStatus(rack.onlineStatus) : undefined,
    totalCapacity: rack.totalCapacity,
    remainingCapacity: rack.remainingCapacity,
    currentTaskCount: rack.currentTaskCount,
    mode: rack.mode,
    cageCount: rack.cages?.length,

    // 详情
    slots: rack.slots?.map(adaptSlot),
    trays: rack.trays,
    volumes: rack.volumes?.map(adaptVolume),
    recentTasks: rack.recentTasks,
    deviceLogs: rack.deviceLogs,
  }
}

export function adaptRackList(racks: Rack[]): RackDTO[] {
  return racks.map(adaptRack)
}

export function adaptRackStats(stats: RackStats): RackStatsDTO {
  return {
    total: stats.total,
    normal: stats.normal,
    warning: stats.warning,
    fault: stats.fault,
    maintenance: stats.maintenance,
    online: stats.online,
    offline: stats.offline,
    totalCapacity: stats.totalCapacity ?? "0",
    remainingCapacity: stats.remainingCapacity ?? "0",
    usedSlots: stats.usedSlots ?? 0,
    totalSlotsAll: stats.totalSlotsAll ?? 0,
    avgUsage: stats.avgUsage ?? 0,
  }
}
