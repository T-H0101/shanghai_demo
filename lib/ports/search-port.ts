/**
 * lib/ports/search-port.ts
 * R.85 — SearchPort interface (ADR 0002)
 */

import type { FileIndexDocument } from "@/lib/domain/search/file-index-document"

export type FileSearchQuery = {
  keyword: string
  siteCode?: string
  volumeId?: number
  docType?: "file" | "folder"
  departmentIds?: string[]
  limit: number
  /** @deprecated 已改为 search_after；保留兼容，忽略 */
  offset?: number
  /** 上一页最后一条文档 _id（OpenSearch _id = site:table:recordId） */
  searchAfter?: string | null
}

export type FileSearchHit = {
  /** OpenSearch 文档 _id */
  docId?: string
  sourceSiteId: string
  sourceTable: string | null
  sourceRecordId: string
  docType: "file" | "folder" | string
  displayName: string
  fileName: string
  filePath: string | null
  folderPath: string | null
  extension: string | null
  contentType: string | null
  sizeBytes: number | null
  volumeId: number | null
  volumeCode: string | null
  volumeName: string | null
  slotId: number | null
  hash: string | null
  taskId: string | null
  status: number | null
  createDate: string | null
  updatedAt: string | null
  /** @deprecated 索引无此字段，恒为 null */
  discCode: string | null
}

export type FileSearchSource = "opensearch" | "blocked_by_external_system"

export type FileSearchResult = {
  hits: FileSearchHit[]
  /** 游标分页下不再保证精确总数；固定 0 */
  total: number
  nextSearchAfter: string | null
  hasMore: boolean
  source: FileSearchSource
  blocker?: string
}

export interface SearchPort {
  searchFiles(query: FileSearchQuery): Promise<FileSearchResult>
  indexFiles(documents: FileIndexDocument[]): Promise<{
    indexed: number
    failed: number
    blocker?: string
  }>
}
