/**
 * 统一检索导出列 — 与检索结果表对齐（不含「操作」）
 */

import { formatBeijingTime } from "@/lib/time/beijing"

export const SEARCH_EXPORT_COLUMNS = [
  "name",
  "docType",
  "path",
  "size",
  "site",
  "volume",
  "extension",
  "checksum",
  "createdAt",
] as const

export type SearchExportColumn = (typeof SEARCH_EXPORT_COLUMNS)[number]

export const SEARCH_EXPORT_LABELS: string[] = [
  "名称",
  "类型",
  "路径",
  "大小",
  "站点",
  "存储卷",
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
  volume?: string | null
  fileType?: string | null
  checksum?: string | null
  createdAt?: string | null
}): SearchExportRow {
  return {
    name: dashToEmpty(file.fileName),
    docType: formatSearchDocType(file.docType),
    path: dashToEmpty(file.path),
    size:
      file.docType === "folder"
        ? ""
        : dashToEmpty(file.size) || formatSearchSize(file.sizeBytes, file.docType),
    site: formatSearchSiteLabel(file.siteName, file.siteCode),
    volume: dashToEmpty(file.volume),
    extension: file.docType === "folder" ? "目录" : dashToEmpty(file.fileType),
    checksum: dashToEmpty(file.checksum),
    createdAt: formatBeijingTime(file.createdAt) || "",
  }
}

/** 由 API/OpenSearch hit 组装导出行 */
export function toSearchExportRowFromHit(hit: {
  displayName?: string | null
  fileName?: string | null
  docType?: string | null
  folderPath?: string | null
  filePath?: string | null
  sizeBytes?: number | null
  siteName?: string | null
  sourceSiteId?: string | null
  volumeName?: string | null
  volumeId?: number | null
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
  const volume =
    hit.volumeName ||
    (hit.volumeId != null ? `卷-${hit.volumeId}` : "")
  return {
    name,
    docType: formatSearchDocType(docType),
    path: dashToEmpty(hit.folderPath || hit.filePath),
    size: formatSearchSize(hit.sizeBytes, docType),
    site: formatSearchSiteLabel(hit.siteName, hit.sourceSiteId),
    volume: dashToEmpty(volume),
    extension: docType === "folder" ? "目录" : dashToEmpty(hit.extension),
    checksum: dashToEmpty(hit.hash),
    createdAt: formatBeijingTime(hit.createDate ?? hit.updatedAt) || "",
  }
}
