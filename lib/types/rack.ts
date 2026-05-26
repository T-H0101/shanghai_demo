import type { OnlineStatus } from "./common"

export type RackStatus = "normal" | "warning" | "fault" | "maintenance"

export interface TransferRecord {
  id: string
  rackId: string
  fromSite: string
  toSite: string
  reason: string
  operator: string
  approver: string
  requestedAt: string
  completedAt?: string
  status: "pending" | "in_transit" | "completed" | "cancelled"
}

// 盘位状态
export type SlotStatus = "free" | "used" | "error" | "empty"

export interface RackSlot {
  id: string
  index: number
  occupied: boolean
  status: SlotStatus
  discNo?: string
  label?: string
  mediaType?: "hdd" | "bd" | "offline"
  capacity?: string
  volumeId?: string
}

export interface DeviceTray {
  id: string
  index: number
  slotCount: number
  usedCount: number
  label: string
}

export interface RelatedTask {
  id: string
  name: string
  type: string
  progress: number
  status: string
  startedAt: string
}

// 设备模式
export type DeviceMode = "off" | "standard" | "high_speed"

export const DEVICE_MODE_LABELS: Record<DeviceMode, string> = {
  off: "关",
  standard: "开-标准模式",
  high_speed: "开-高速模式（深度休眠不下电）",
}

export interface StorageVolume {
  id: string
  name: string
  type: "optical" | "magnetic" | "composite"
  totalCapacity: string
  remainingCapacity: string
  info: string
  discCount?: number
  usedCount?: number
  newCount?: number
}

export interface Rack {
  id: string
  rackId: string
  rackName: string
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
  transferHistory?: TransferRecord[]

  // 设备管理
  ip?: string
  deviceType?: string           // 智能硬盘库 / 光盘库 / CIFS网盘
  deviceStatus?: "online" | "offline" | "error" | "maintenance"
  onlineStatus?: OnlineStatus
  totalCapacity?: string
  remainingCapacity?: string
  currentTaskCount?: number
  trays?: DeviceTray[]
  mode?: DeviceMode
  // 存储卷列表
  volumes?: StorageVolume[]
  // 关联任务
  recentTasks?: RelatedTask[]
  // 设备日志
  deviceLogs?: DeviceLog[]
}

// 设备操作日志
export interface DeviceLog {
  id: string
  timestamp: string
  level: "info" | "warn" | "error"
  message: string
}

export interface RackStats {
  total: number
  normal: number
  warning: number
  fault: number
  maintenance: number
  online: number
  offline: number
  totalCapacity: string
  remainingCapacity: string
  usedSlots: number
  totalSlotsAll: number
  avgUsage: number
}