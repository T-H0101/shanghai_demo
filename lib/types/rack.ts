export type RackStatus = "normal" | "warning" | "fault" | "maintenance"

export interface RackSlot {
  id: string
  index: number
  occupied: boolean
  discNo?: string
  label?: string
}

export interface Rack {
  id: string
  rackId: string
  siteName: string
  siteCode: string
  datacenter: string
  cages: string[]
  totalSlots: number
  usedSlots: number
  usagePercent: number
  status: RackStatus
  lastSyncAt: string
  floor?: string
  room?: string
  slots: RackSlot[]
}

export interface RackStats {
  total: number
  normal: number
  warning: number
  fault: number
  avgUsage: number
}
