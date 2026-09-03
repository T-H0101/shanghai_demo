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
  /** 逻辑卷类型：1光盘 3硬盘 */
  volumeType?: number | null
  deviceLabel: string
  /** 当前物理设备 IP（移位登记覆盖后） */
  deviceIp?: string | null
  devicePort?: string | null
  magazineRfid: string | null
  /** 硬盘序列号 */
  serialNum?: string | null
  slotId: number | null
  /** 片匣内盘位号；跨站回迁物理寻址用 */
  slotOrder?: number | null
  /** 光盘 AB 面：0=A，1=B */
  discSide?: number | null
  /** 列表「设备位置」拼好的展示文案 */
  locationLabel?: string
  /** 区域/站点展示：如 上海/上海01 或 南通 · 盘笼移位（站点未定） */
  siteDisplayLabel?: string
  /** 盘笼已登记迁入区域 */
  relocated?: boolean
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
