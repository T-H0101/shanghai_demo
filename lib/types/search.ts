export interface SearchFile {
  id: string
  fileName: string
  path: string
  size: string
  sizeBytes: number
  siteName: string
  siteCode: string
  discNo: string
  rackSlot: string
  department: string
  fileType: string
  createdAt: string
  volume: string
  checksum?: string
}

export interface SearchFilters {
  keyword: string
  site: string
  department: string
  discNo: string
  volume: string
  fileType: string
  dateFrom: string
  dateTo: string
}
