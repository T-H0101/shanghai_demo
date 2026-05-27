import type { Rack, RackSlot, RackStats, StorageVolume, DeviceLog, BackupFile, RestoreItem, RestoreTarget } from "@/lib/types/rack"

function generateSlots(total: number, used: number, mediaType: RackSlot["mediaType"] = "hdd"): RackSlot[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `slot-${i + 1}`,
    index: i + 1,
    occupied: i < used,
    status: i < used ? "used" as const : (Math.random() > 0.9 ? "error" as const : "free" as const),
    discNo: i < used ? `DISC-2026-${String(800 + i).padStart(4, "0")}` : undefined,
    label: i < used ? `槽${i + 1}` : undefined,
    mediaType: i < used ? mediaType : undefined,
    capacity: i < used ? `${(1 + Math.random() * 3).toFixed(1)} TB` : undefined,
    volumeId: i < used ? `VOL-${String(2026)}${String(i).padStart(3, "0")}` : undefined,
  }))
}

function generateHddSlots(total: number, used: number): RackSlot[] {
  return Array.from({ length: total }, (_, i) => ({
    id: `slot-${i + 1}`,
    index: i + 1,
    occupied: i < used,
    status: i < used ? "used" as const : (i === used ? "error" as const : "free" as const),
    discNo: i < used ? `HDD-${String(1000 + i)}` : undefined,
    label: i < used ? `盘位${i + 1}` : undefined,
    mediaType: "hdd" as const,
    capacity: i < used ? `${(1 + Math.random() * 7).toFixed(0)} TB` : undefined,
    volumeId: i < used ? `HDD-VOL-${String(i).padStart(3, "0")}` : undefined,
  }))
}

// ── 存储卷 ──────────────────────────────────────────────────────

const volumeS01: StorageVolume[] = [
  { id: "v1", name: "WD-WCC2EEP105U5", type: "composite", totalCapacity: "465.76 GB", remainingCapacity: "—", info: "WD-WCC2EEP105U5, WD-WCC2EEP105U5_1" },
  { id: "v2", name: "光盘卷", type: "optical", totalCapacity: "69.84 GB", remainingCapacity: "66.4 GB", info: "总盘数:3, 使用:1, 新盘:2", discCount: 3, usedCount: 1, newCount: 2 },
  { id: "v3", name: "硬盘卷", type: "magnetic", totalCapacity: "465.76 GB", remainingCapacity: "453.65 GB", info: "总盘数:1, 使用:1, 新盘:0", discCount: 1, usedCount: 1, newCount: 0 },
]

const volumeM220: StorageVolume[] = [
  { id: "v4", name: "光盘卷242", type: "optical", totalCapacity: "2.4 TB", remainingCapacity: "600 GB", info: "总盘数:24, 使用:18, 新盘:6", discCount: 24, usedCount: 18, newCount: 6 },
  { id: "v5", name: "光盘卷242-iso", type: "optical", totalCapacity: "100 GB", remainingCapacity: "25 GB", info: "ISO 存储卷", discCount: 0, usedCount: 0, newCount: 0 },
]

// ── 设备日志 ──────────────────────────────────────────────────────

const deviceLogsDu32: DeviceLog[] = [
  { id: "dl1", timestamp: "14:45:00", level: "info", message: "设备扫描完成：4 块硬盘，全部健康" },
  { id: "dl2", timestamp: "14:30:00", level: "info", message: "SMART 健康检测：4/4 通过" },
  { id: "dl3", timestamp: "14:00:00", level: "info", message: "设备扫描启动：du32 (10.186.1.237)" },
  { id: "dl4", timestamp: "08:30:00", level: "info", message: "任务 TK-20260526-001 开始执行" },
  { id: "dl5", timestamp: "00:00:00", level: "info", message: "设备上电，系统自检通过" },
]

const deviceLogsM220: DeviceLog[] = [
  { id: "dl6", timestamp: "10:00:00", level: "error", message: "光驱 S06 读写错误，请检查光盘是否损坏" },
  { id: "dl7", timestamp: "09:30:00", level: "warn", message: "光驱 S06 写入延迟异常" },
  { id: "dl8", timestamp: "08:00:00", level: "info", message: "设备模式切换为维护模式" },
  { id: "dl9", timestamp: "06:00:00", level: "info", message: "任务 TK-20260525-009 开始执行" },
  { id: "dl10", timestamp: "00:00:00", level: "info", message: "设备上电，光驱初始化完成" },
]

// ── 设备列表 ──────────────────────────────────────────────────────

export const racks: Rack[] = [
  {
    id: "r1", rackId: "R-A12", rackName: "硬盘库-A12",
    siteName: "上海数据中心", siteCode: "SH-RD-01", datacenter: "浦东 IDC-A",
    cages: ["笼-A", "笼-B"], totalSlots: 32, usedSlots: 28, usagePercent: 88,
    status: "normal", lastSyncAt: "2026-05-26 14:45:00",
    floor: "3F", room: "机房-A区",
    slots: generateHddSlots(32, 28),
    ip: "10.186.1.237", deviceType: "智能硬盘库",
    deviceStatus: "online", onlineStatus: "online",
    totalCapacity: "32 TB", remainingCapacity: "3.8 TB",
    currentTaskCount: 2,
    trays: [
      { id: "tray-1", index: 1, slotCount: 8, usedCount: 7, label: "托盘 1" },
      { id: "tray-2", index: 2, slotCount: 8, usedCount: 7, label: "托盘 2" },
      { id: "tray-3", index: 3, slotCount: 8, usedCount: 7, label: "托盘 3" },
      { id: "tray-4", index: 4, slotCount: 8, usedCount: 7, label: "托盘 4" },
    ],
    mode: "high_speed",
    volumes: volumeS01,
    recentTasks: [
      { id: "t0", name: "苏州市档案馆全量封包", type: "全量封包", progress: 58, status: "running", startedAt: "2026-05-26 08:30:00" },
      { id: "t1", name: "湖州市档案馆增量扫描", type: "增量扫描", progress: 42, status: "running", startedAt: "2026-05-26 10:15:00" },
    ],
    deviceLogs: deviceLogsDu32,
  },
  {
    id: "r2", rackId: "R-B03", rackName: "硬盘库-B03",
    siteName: "北京总部", siteCode: "BJ-HQ-02", datacenter: "亦庄 IDC-B",
    cages: ["笼-C"], totalSlots: 48, usedSlots: 44, usagePercent: 92,
    status: "warning", lastSyncAt: "2026-05-26 14:30:00",
    floor: "2F", room: "机房-B区",
    slots: generateHddSlots(48, 44),
    ip: "10.186.1.238", deviceType: "智能硬盘库",
    deviceStatus: "online", onlineStatus: "online",
    totalCapacity: "48 TB", remainingCapacity: "3.8 TB",
    currentTaskCount: 1,
    trays: [
      { id: "tray-1", index: 1, slotCount: 12, usedCount: 11, label: "托盘 1" },
      { id: "tray-2", index: 2, slotCount: 12, usedCount: 11, label: "托盘 2" },
      { id: "tray-3", index: 3, slotCount: 12, usedCount: 11, label: "托盘 3" },
      { id: "tray-4", index: 4, slotCount: 12, usedCount: 11, label: "托盘 4" },
    ],
    mode: "standard",
    volumes: volumeS01,
    recentTasks: [
      { id: "t7", name: "北京市档案馆增量备份", type: "数据备份", progress: 28, status: "failed", startedAt: "2026-05-26 02:00:00" },
      { id: "t9", name: "嘉兴市档案馆增量封包", type: "增量封包", progress: 100, status: "completed", startedAt: "2026-05-26 08:00:00" },
    ],
    deviceLogs: deviceLogsDu32,
  },
  {
    id: "r3", rackId: "R-M220", rackName: "光盘库-M220",
    siteName: "上海数据中心", siteCode: "SH-RD-01", datacenter: "浦东 IDC-A",
    cages: ["笼-D", "笼-E", "笼-F"], totalSlots: 24, usedSlots: 18, usagePercent: 75,
    status: "maintenance", lastSyncAt: "2026-05-25 09:10:00",
    floor: "3F", room: "机房-A区",
    slots: generateSlots(24, 18, "bd"),
    ip: "10.186.1.239", deviceType: "光盘库",
    deviceStatus: "maintenance", onlineStatus: "online",
    totalCapacity: "2.4 TB", remainingCapacity: "600 GB",
    currentTaskCount: 0,
    trays: [
      { id: "tray-1", index: 1, slotCount: 8, usedCount: 6, label: "托盘 1" },
      { id: "tray-2", index: 2, slotCount: 8, usedCount: 6, label: "托盘 2" },
      { id: "tray-3", index: 3, slotCount: 8, usedCount: 6, label: "托盘 3" },
    ],
    mode: "off",
    volumes: volumeM220,
    recentTasks: [
      { id: "t8", name: "苏州市档案馆全量封包", type: "全量封包", progress: 67, status: "failed", startedAt: "2026-05-25 14:00:00" },
    ],
    deviceLogs: deviceLogsM220,
  },
  {
    id: "r4", rackId: "R-WH01", rackName: "光盘库-WH01",
    siteName: "武汉备份中心", siteCode: "WH-BK-06", datacenter: "光谷 IDC-F",
    cages: ["笼-G"], totalSlots: 16, usedSlots: 6, usagePercent: 38,
    status: "fault", lastSyncAt: "2026-05-24 18:00:00",
    floor: "1F", room: "离线库房",
    slots: generateSlots(16, 6, "offline"),
    ip: "10.186.2.50", deviceType: "光盘库",
    deviceStatus: "offline", onlineStatus: "offline",
    totalCapacity: "1.6 TB", remainingCapacity: "1.0 TB",
    currentTaskCount: 0,
    trays: [
      { id: "tray-1", index: 1, slotCount: 8, usedCount: 3, label: "托盘 1" },
      { id: "tray-2", index: 2, slotCount: 8, usedCount: 3, label: "托盘 2" },
    ],
    mode: "off",
    volumes: [],
    recentTasks: [],
    deviceLogs: [
      { id: "dl11", timestamp: "18:00:00", level: "error", message: "设备离线，无法建立连接" },
      { id: "dl12", timestamp: "12:00:00", level: "warn", message: "设备心跳丢失，尝试重连" },
      { id: "dl13", timestamp: "08:00:00", level: "info", message: "设备最后在线时间" },
    ],
  },
  {
    id: "r5", rackId: "R-NAS01", rackName: "CIFS网盘-NAS01",
    siteName: "南京中心", siteCode: "NJ-DC-05", datacenter: "江宁 IDC-E",
    cages: ["网盘挂载"], totalSlots: 0, usedSlots: 0, usagePercent: 72,
    status: "normal", lastSyncAt: "2026-05-26 14:20:00",
    floor: "2F", room: "机房-C区",
    slots: [],
    ip: "172.168.6.15", deviceType: "CIFS 网盘",
    deviceStatus: "online", onlineStatus: "online",
    totalCapacity: "120 TB", remainingCapacity: "33.6 TB",
    currentTaskCount: 1,
    trays: [],
    mode: "standard",
    volumes: [
      { id: "v6", name: "NAS-主存储", type: "magnetic", totalCapacity: "120 TB", remainingCapacity: "33.6 TB", info: "CIFS 挂载，120 TB 总容量" },
    ],
    recentTasks: [
      { id: "t4", name: "蓝盘卷242盘笼移位任务", type: "盘笼移位", progress: 68, status: "running", startedAt: "2026-05-26 15:00:00" },
    ],
    deviceLogs: [
      { id: "dl14", timestamp: "14:20:00", level: "info", message: "设备状态正常，存储空间使用 72%" },
      { id: "dl15", timestamp: "10:00:00", level: "info", message: "CIFS 连接保持中" },
      { id: "dl16", timestamp: "00:00:00", level: "info", message: "设备挂载成功，路径 /netshare/172.168.6.15/" },
    ],
  },
]

// ── 统计数据 ──────────────────────────────────────────────────────
export const rackStats: RackStats = {
  total: racks.length,
  normal: racks.filter(r => r.status === "normal").length,
  warning: racks.filter(r => r.status === "warning").length,
  fault: racks.filter(r => r.status === "fault").length,
  maintenance: racks.filter(r => r.status === "maintenance").length,
  online: racks.filter(r => r.deviceStatus === "online").length,
  offline: racks.filter(r => r.deviceStatus === "offline" || r.deviceStatus === "error").length,
  totalCapacity: "203.6 TB",
  remainingCapacity: "42.8 TB",
  usedSlots: racks.reduce((s, r) => s + r.usedSlots, 0),
  totalSlotsAll: racks.reduce((s, r) => s + r.totalSlots, 0),
  avgUsage: Math.round(racks.reduce((s, r) => s + r.usagePercent, 0) / racks.length),
}

export const allSites = ["上海数据中心", "北京总部", "南京中心", "武汉备份中心", "广州生产基地"]

// 设备名称到 rackId 的映射
export const deviceNameToRackId: Record<string, string> = Object.fromEntries(
  racks.map(r => [r.rackId, r.rackId])
)

// ============================================================
// 存储浏览 / 数据恢复 Mock 数据
// ============================================================

// 备份文件目录树（模拟已备份数据）
export const mockBackupFiles: BackupFile[] = [
  {
    id: "bf-root",
    name: "已备份数据",
    type: "folder",
    path: "/backup",
    children: [
      {
        id: "bf-hdd",
        name: "硬盘卷",
        type: "folder",
        path: "/backup/hdd",
        children: [
          { id: "bf-hdd-1", name: "苏州市档案馆", type: "folder", path: "/backup/hdd/suzhou", children: [
            { id: "bf-hdd-1-1", name: "2024年度档案", type: "folder", path: "/backup/hdd/suzhou/2024", children: [
              { id: "bf-hdd-1-1-1", name: "文书档案", type: "folder", path: "/backup/hdd/suzhou/2024/docs", children: [
                { id: "bf-hdd-1-1-1-1", name: "2024-01.zip", type: "file", size: "2.3 GB", path: "/backup/hdd/suzhou/2024/docs/2024-01.zip", extension: "zip", updatedAt: "2024-02-01" },
                { id: "bf-hdd-1-1-1-2", name: "2024-02.zip", type: "file", size: "1.8 GB", path: "/backup/hdd/suzhou/2024/docs/2024-02.zip", extension: "zip", updatedAt: "2024-03-01" },
              ]},
              { id: "bf-hdd-1-1-2", name: "科技档案", type: "folder", path: "/backup/hdd/suzhou/2024/tech", children: [
                { id: "bf-hdd-1-1-2-1", name: "项目材料.pdf", type: "file", size: "156 MB", path: "/backup/hdd/suzhou/2024/tech/项目材料.pdf", extension: "pdf", updatedAt: "2024-03-15" },
              ]},
            ]},
            { id: "bf-hdd-1-2", name: "2023年度档案", type: "folder", path: "/backup/hdd/suzhou/2023", children: [] },
          ]},
          { id: "bf-hdd-2", name: "湖州市档案馆", type: "folder", path: "/backup/hdd/huzhou", children: [
            { id: "bf-hdd-2-1", name: "全量备份", type: "folder", path: "/backup/hdd/huzhou/full", children: [
              { id: "bf-hdd-2-1-1", name: "backup_full_2024Q4.tar", type: "file", size: "45.6 GB", path: "/backup/hdd/huzhou/full/backup_full_2024Q4.tar", extension: "tar", updatedAt: "2024-12-31" },
            ]},
          ]},
        ],
      },
      {
        id: "bf-optical",
        name: "光盘卷",
        type: "folder",
        path: "/backup/optical",
        children: [
          { id: "bf-optical-1", name: "历史档案光盘", type: "folder", path: "/backup/optical/history", children: [
            { id: "bf-optical-1-1", name: "1990-2000年档案", type: "folder", path: "/backup/optical/history/1990-2000", children: [
              { id: "bf-optical-1-1-1", name: "光盘镜像_001.iso", type: "file", size: "4.7 GB", path: "/backup/optical/history/1990-2000/光盘镜像_001.iso", extension: "iso", updatedAt: "2020-05-15" },
              { id: "bf-optical-1-1-2", name: "光盘镜像_002.iso", type: "file", size: "4.7 GB", path: "/backup/optical/history/1990-2000/光盘镜像_002.iso", extension: "iso", updatedAt: "2020-05-16" },
            ]},
            { id: "bf-optical-1-2", name: "2001-2010年档案", type: "folder", path: "/backup/optical/history/2001-2010", children: [
              { id: "bf-optical-1-2-1", name: "archive_dvd_001.iso", type: "file", size: "7.2 GB", path: "/backup/optical/history/2001-2010/archive_dvd_001.iso", extension: "iso", updatedAt: "2021-08-20" },
            ]},
          ]},
          { id: "bf-optical-2", name: "近期归档", type: "folder", path: "/backup/optical/recent", children: [
            { id: "bf-optical-2-1", name: "2025年第一季度", type: "folder", path: "/backup/optical/recent/2025Q1", children: [
              { id: "bf-optical-2-1-1", name: "Q1_documents.zip", type: "file", size: "8.4 GB", path: "/backup/optical/recent/2025Q1/Q1_documents.zip", extension: "zip", updatedAt: "2025-04-01" },
              { id: "bf-optical-2-1-2", name: "Q1_media.zip", type: "file", size: "12.1 GB", path: "/backup/optical/recent/2025Q1/Q1_media.zip", extension: "zip", updatedAt: "2025-04-01" },
            ]},
          ]},
        ],
      },
      {
        id: "bf-nas",
        name: "外部存储设备",
        type: "folder",
        path: "/backup/nas",
        children: [
          { id: "bf-nas-1", name: "NAS-主存储", type: "folder", path: "/backup/nas/main", children: [
            { id: "bf-nas-1-1", name: "共享文件", type: "folder", path: "/backup/nas/main/shared", children: [
              { id: "bf-nas-1-1-1", name: "会议纪要.pdf", type: "file", size: "2.3 MB", path: "/backup/nas/main/shared/会议纪要.pdf", extension: "pdf", updatedAt: "2026-01-15" },
              { id: "bf-nas-1-1-2", name: "项目计划.xlsx", type: "file", size: "456 KB", path: "/backup/nas/main/shared/项目计划.xlsx", extension: "xlsx", updatedAt: "2026-02-20" },
            ]},
          ]},
        ],
      },
    ],
  },
]

// 服务器磁盘目录（用于恢复目标选择）
export const mockServerPaths: RestoreTarget[] = [
  { id: "sp-1", name: "C盘", path: "C:\\", type: "server", remainingCapacity: "120 GB", remainingBytes: 128849018880 },
  { id: "sp-2", name: "D盘-数据", path: "D:\\", type: "server", remainingCapacity: "500 GB", remainingBytes: 536870912000 },
  { id: "sp-3", name: "E盘-临时", path: "E:\\", type: "server", remainingCapacity: "200 GB", remainingBytes: 214748364800 },
  { id: "sp-4", name: "F盘-归档", path: "F:\\", type: "server", remainingCapacity: "1 TB", remainingBytes: 1099511627776 },
]

// 本地下载目录
export const mockLocalPaths: RestoreTarget[] = [
  { id: "lp-1", name: "下载", path: "/Users/tian/Downloads", type: "local", remainingCapacity: "—", remainingBytes: -1 },
  { id: "lp-2", name: "桌面", path: "/Users/tian/Desktop", type: "local", remainingCapacity: "—", remainingBytes: -1 },
  { id: "lp-3", name: "文档", path: "/Users/tian/Documents", type: "local", remainingCapacity: "—", remainingBytes: -1 },
]

// 将文件节点转换为 RestoreItem
export function toRestoreItems(files: BackupFile[]): RestoreItem[] {
  const items: RestoreItem[] = []
  function traverse(file: BackupFile, volumeId: string, volumeName: string) {
    if (file.type === "file") {
      items.push({
        id: file.id,
        name: file.name,
        type: "file",
        size: file.size,
        sourcePath: file.path,
        volumeId,
        volumeName,
      })
    }
    if (file.children) {
      file.children.forEach(child => traverse(child, volumeId, volumeName))
    }
  }
  // 根据路径确定卷ID和名称
  files.forEach(file => {
    if (file.path.startsWith("/backup/hdd")) {
      traverse(file, "v1", "硬盘卷")
    } else if (file.path.startsWith("/backup/optical")) {
      traverse(file, "v2", "光盘卷")
    } else if (file.path.startsWith("/backup/nas")) {
      traverse(file, "v6", "NAS-主存储")
    }
  })
  return items
}