/**
 * tbl_logical_volume.type → 总控 VolumeDTO / 中心库 volume_type / 展示文案
 *
 * 源注释 (disc_files.sql):
 * 1光盘卷；2磁盘卷（NAS）；3硬盘卷；5磁带库卷；6光盘校验卷；7磁带机卷；8接收中转卷
 *
 * 业务前端展示 (LongTermStorage-ui VolumeManagement.volumeTypeNameObj):
 * 0组合卷；1光存储卷；2/3磁存储卷；5磁带存储卷
 *
 * 分组对齐业务树: 光(1) / 磁(2,3) / 磁带(5) / 组合(0)
 */

import type { VolumeType } from "@/lib/api/dto"

/** 业务数字枚举 → 展示文案（优先对齐业务 UI，细类用 schema） */
export const VOLUME_TYPE_SOURCE_LABELS: Record<string, string> = {
  "0": "组合卷",
  "1": "光存储卷",
  "2": "磁存储卷",
  "3": "磁存储卷",
  "5": "磁带存储卷",
  "6": "光盘校验卷",
  "7": "磁带机卷",
  "8": "接收中转卷",
}

/** DTO 档位 → 列表/筛选主文案（对齐业务树） */
export const VOLUME_TYPE_DTO_LABELS: Record<VolumeType, string> = {
  optical: "光存储卷",
  magnetic: "磁存储卷",
  tape: "磁带存储卷",
  composite: "组合卷",
}

/** 数字 type → 中心库规范化存储值 */
const SOURCE_CODE_TO_STORAGE: Record<string, string> = {
  "0": "composite",
  "1": "optical",
  "2": "magnetic",
  "3": "hard_disk",
  "5": "tape",
  "6": "optical_verify",
  "7": "tape_drive",
  "8": "transit",
}

/** 数字 type → DTO 分组（对齐业务树） */
const SOURCE_CODE_TO_DTO: Record<string, VolumeType> = {
  "0": "composite",
  "1": "optical",
  "2": "magnetic",
  "3": "magnetic",
  "5": "tape",
  "6": "optical",
  "7": "tape",
  "8": "composite",
}

/** 已规范化 / 历史英文值 → DTO */
const STORAGE_TO_DTO: Record<string, VolumeType> = {
  optical: "optical",
  optical_verify: "optical",
  magnetic: "magnetic",
  hard_disk: "magnetic",
  hdd: "magnetic",
  tape: "tape",
  tape_drive: "tape",
  composite: "composite",
  transit: "composite",
}

/** 存储键 → 精确展示文案 */
const STORAGE_LABELS: Record<string, string> = {
  optical: "光存储卷",
  optical_verify: "光盘校验卷",
  magnetic: "磁存储卷",
  hard_disk: "磁存储卷",
  hdd: "磁存储卷",
  tape: "磁带存储卷",
  tape_drive: "磁带机卷",
  composite: "组合卷",
  transit: "接收中转卷",
}

function normalizeKey(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === "") return null
  return String(raw).trim().toLowerCase()
}

/** API / Adapter：任意 volume_type → VolumeDTO.type */
export function mapVolumeTypeToDto(raw: string | number | null | undefined): VolumeType {
  const key = normalizeKey(raw)
  if (!key) return "composite"
  return SOURCE_CODE_TO_DTO[key] ?? STORAGE_TO_DTO[key] ?? "composite"
}

/** 展示文案：优先业务 UI / schema 精确名，再回落到 DTO 档位名 */
export function mapVolumeTypeLabel(raw: string | number | null | undefined): string {
  const key = normalizeKey(raw)
  if (!key) return VOLUME_TYPE_DTO_LABELS.composite
  return (
    VOLUME_TYPE_SOURCE_LABELS[key] ??
    STORAGE_LABELS[key] ??
    VOLUME_TYPE_DTO_LABELS[mapVolumeTypeToDto(raw)]
  )
}

/**
 * 同步入库：把业务 type 规范化为英文枚举再写入 unified_volumes.volume_type。
 */
export function canonicalizeVolumeTypeForStorage(raw: unknown): string | null {
  if (raw == null || raw === "") return null
  const key = String(raw).trim().toLowerCase()
  if (SOURCE_CODE_TO_STORAGE[key]) return SOURCE_CODE_TO_STORAGE[key]
  if (key === "hdd") return "hard_disk"
  if (STORAGE_TO_DTO[key] || STORAGE_LABELS[key]) {
    return key === "hard_disk" ? "hard_disk" : key
  }
  return key
}

/** 列表筛选：DTO type → DB volume_type 可能取值（含历史数字串） */
export function volumeTypeFilterValues(dtoType: string): string[] {
  switch (dtoType) {
    case "optical":
      return ["optical", "optical_verify", "1", "6"]
    case "magnetic":
      return ["magnetic", "hard_disk", "hdd", "2", "3"]
    case "tape":
      return ["tape", "tape_drive", "5", "7"]
    case "composite":
      return ["composite", "transit", "0", "8"]
    default:
      return [dtoType]
  }
}
