/**
 * Volume Adapter - 存储卷数据适配器
 * 将 Mock/DB 数据转换为 VolumeDTO
 */

import type { StorageVolume } from "@/lib/types/rack"
import type { VolumeDTO } from "@/lib/api/dto"

// VolumeType 映射
const TYPE_MAP: Record<string, VolumeDTO["type"]> = {
  optical: "optical",
  magnetic: "magnetic",
  composite: "composite",
}

// 安全的类型转换
function safeAdaptVolumeType(type: string): VolumeDTO["type"] {
  return TYPE_MAP[type] ?? "composite"
}

export function adaptVolume(volume: StorageVolume): VolumeDTO {
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

export function adaptVolumeList(volumes: StorageVolume[]): VolumeDTO[] {
  return volumes.map(adaptVolume)
}
