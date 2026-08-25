/**
 * lib/ports/search-port.ts
 * R.85 — SearchPort interface (ADR 0002)
 */

import type { FileIndexDocument } from "@/lib/domain/search/file-index-document"

export type FileSearchQuery = {
  keyword: string
  siteCode?: string
  /** 设备 IP（索引 device_ip / 移位后当前设备） */
  deviceIp?: string
  docType?: "file" | "folder"
  departmentIds?: string[]
  inboundRfids?: string[]
  outboundRfids?: string[]
  deviceInboundRfids?: string[]
  deviceOutboundRfids?: string[]
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
  /** 逻辑卷类型：1光盘 3硬盘 … */
  volumeType: number | null
  slotId: number | null
  /** 片匣内盘位号（推送 slot_order，从 0 起）；跨站回迁寻址用，非 slot_id */
  slotOrder: number | null
  /** 光盘 AB 面：0=A，1=B（tbl_slots.disc_side） */
  discSide: number | null
  /** 索引盘笼 RFID；移位登记后身份不变 */
  magazineRfid: string | null
  /** 索引或登记覆盖后的设备 IP */
  deviceIp: string | null
  devicePort: string | null
  /** 设备展示名（可选，来自中心库补全） */
  deviceName: string | null
  /** 硬盘序列号（volume_type=3） */
  serialNum: string | null
  /**
   * 列表展示用站点编码：有移位登记时为最新目标站，否则为归档 sourceSiteId。
   * sourceSiteId 仍保留 ES 归档站，供存储卷名解析。
   */
  displaySiteCode?: string | null
  siteName?: string | null
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
