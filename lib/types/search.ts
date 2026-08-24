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
  deviceLabel: string
  /** 当前物理设备 IP（移位登记覆盖后） */
  deviceIp?: string | null
  devicePort?: string | null
  magazineRfid: string | null
  slotId: number | null
  /** 片匣内盘位号；跨站回迁物理寻址用 */
  slotOrder?: number | null
  /** 光盘 AB 面：0=A，1=B */
  discSide?: number | null
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
