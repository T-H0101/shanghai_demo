/**
 * 统一检索导出列 — 与检索结果表对齐（不含「操作」）
 */

import { formatBeijingTime } from "@/lib/time/beijing"
import { formatDeviceLocationLabel } from "@/lib/search/location-display"

export const SEARCH_EXPORT_COLUMNS = [
  "name",
  // "docType", // 仅文件检索，类型列暂隐藏
  "path",
  "size",
  "site",
  "location",
  "extension",
  "checksum",
  "createdAt",
] as const

export type SearchExportColumn = (typeof SEARCH_EXPORT_COLUMNS)[number]

export const SEARCH_EXPORT_LABELS: string[] = [
  "名称",
  // "类型",
  "路径",
  "大小",
  "区域/站点",
  "设备位置",
  "扩展名",
  "校验码",
  "创建时间",
]

export type SearchExportRow = Record<SearchExportColumn, string>

export function formatSearchSize(sizeBytes: number | null | undefined, docType?: string | null): string {
  if (docType === "folder") return ""
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return ""
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
  return `${(sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function formatSearchDocType(docType?: string | null): string {
  return docType === "folder" ? "目录" : "文件"
}

export function formatSearchSiteLabel(
  siteName?: string | null,
  siteCode?: string | null,
): string {
  const code = (siteCode ?? "").trim()
  const name = (siteName ?? "").trim()
  if (name && code && name !== code) return `${name} (${code})`
  return name || code || ""
}

export function dashToEmpty(value: string | null | undefined): string {
  if (value == null) return ""
  const t = String(value).trim()
  if (!t || t === "—") return ""
  return t
}

/** 由页面 SearchFile 形态组装导出行 */
export function toSearchExportRowFromUi(file: {
  fileName: string
  docType?: string | null
  path?: string | null
  size?: string | null
  sizeBytes?: number | null
  siteName?: string | null
  siteCode?: string | null
  locationLabel?: string | null
  magazineRfid?: string | null
  volume?: string | null
  volumeType?: number | null
  deviceName?: string | null
  deviceIp?: string | null
  devicePort?: string | null
  slotOrder?: number | null
  discSide?: number | null
  serialNum?: string | null
  fileType?: string | null
  checksum?: string | null
  createdAt?: string | null
}): SearchExportRow {
  const location =
    dashToEmpty(file.locationLabel) ||
    formatDeviceLocationLabel({
      volumeType: file.volumeType,
      deviceName: file.deviceName,
      deviceIp: file.deviceIp,
      devicePort: file.devicePort,
      magazineRfid: file.magazineRfid,
      slotOrder: file.slotOrder,
      discSide: file.discSide,
      serialNum: file.serialNum,
    })
  return {
    name: dashToEmpty(file.fileName),
    path: dashToEmpty(file.path),
    size:
      file.docType === "folder"
        ? ""
        : dashToEmpty(file.size) || formatSearchSize(file.sizeBytes, file.docType),
    site: formatSearchSiteLabel(file.siteName, file.siteCode),
    location: location === "—" ? "" : location,
    extension: file.docType === "folder" ? "目录" : dashToEmpty(file.fileType),
    checksum: dashToEmpty(file.checksum),
    createdAt: formatBeijingTime(file.createdAt) || "",
  }
}

export function toSearchExportRowFromHit(hit: {
  displayName?: string | null
  fileName?: string | null
  docType?: string | null
  folderPath?: string | null
  filePath?: string | null
  sizeBytes?: number | null
  siteName?: string | null
  sourceSiteId?: string | null
  displaySiteCode?: string | null
  siteDisplayLabel?: string | null
  locationLabel?: string | null
  magazineRfid?: string | null
  volumeName?: string | null
  volumeId?: number | null
  volumeType?: number | null
  deviceName?: string | null
  deviceIp?: string | null
  devicePort?: string | null
  slotOrder?: number | null
  discSide?: number | null
  serialNum?: string | null
  extension?: string | null
  hash?: string | null
  createDate?: string | null
  updatedAt?: string | null
}): SearchExportRow {
  const docType = hit.docType === "folder" ? "folder" : "file"
  const name =
    hit.displayName ||
    hit.fileName ||
    (docType === "folder" ? "(未命名目录)" : "(未命名文件)")
  const location =
    dashToEmpty(hit.locationLabel) ||
    formatDeviceLocationLabel({
      volumeType: hit.volumeType,
      deviceName: hit.deviceName,
      deviceIp: hit.deviceIp,
      devicePort: hit.devicePort,
      magazineRfid: hit.magazineRfid,
      slotOrder: hit.slotOrder,
      discSide: hit.discSide,
      serialNum: hit.serialNum,
    })
  return {
    name,
    path: dashToEmpty(hit.folderPath || hit.filePath),
    size: formatSearchSize(hit.sizeBytes, docType),
    site:
      dashToEmpty(hit.siteDisplayLabel) ||
      formatSearchSiteLabel(hit.siteName, hit.displaySiteCode || hit.sourceSiteId),
    location: location === "—" ? "" : location,
    extension: docType === "folder" ? "目录" : dashToEmpty(hit.extension),
    checksum: dashToEmpty(hit.hash),
    createdAt: formatBeijingTime(hit.createDate ?? hit.updatedAt) || "",
  }
}

