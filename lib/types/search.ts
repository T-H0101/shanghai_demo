export interface SearchFile {
  id: string
  fileName: string
  path: string
  size: string
  sizeBytes: number
  siteName: string
  siteCode: string
  docType: string
  volumeId: number | null
  volume: string
  slotId: number | null
  fileType: string
  contentType: string | null
  createdAt: string
  checksum?: string
  taskId?: string | null
  status?: number | null
  sourceTable?: string | null
}

export interface SearchFilters {
  keyword: string
  site: string
  volume: string
  docType: string
  dateFrom: string
  dateTo: string
}
