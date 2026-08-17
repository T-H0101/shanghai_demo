/**
 * Volume Adapter - 存储卷数据适配器
 * 将 Mock/DB 数据转换为 VolumeDTO
 */

import type { StorageVolume } from "@/lib/types/rack"
import type { VolumeDTO } from "@/lib/api/dto"
import { mapVolumeTypeToDto, mapVolumeTypeLabel } from "@/lib/devices/volume-type"

export function adaptVolume(volume: StorageVolume): VolumeDTO {
  return {
    id: volume.id,
    name: volume.name ?? "",
    type: mapVolumeTypeToDto(volume.type),
    typeLabel: mapVolumeTypeLabel(volume.type),
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
