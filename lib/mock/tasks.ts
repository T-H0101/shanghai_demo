import type { TaskItem, TaskLogEntry, TaskStats, TaskAlert, TaskPhase } from "@/lib/types/task"

const nowTime = () => new Date().toLocaleTimeString("zh-CN", { hour12: false })
const nowString = () => new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")

function makeLog(id: string, taskId: string, timestamp: string, level: TaskLogEntry["level"], message: string, operator = "系统"): TaskLogEntry {
  return { id, taskId, timestamp, level, message, operator }
}

// ── 异常告警 ──────────────────────────────────────────────────────
export const taskAlerts: TaskAlert[] = [
  { id: "ta1", taskName: "苏州市档案馆全量封包", level: "critical", message: "封包进程异常终止：光驱读写错误，数据块损坏率 3.2%", time: "22:30:00" },
  { id: "ta2", taskName: "北京市档案馆全量扫描", level: "warning", message: "执行时间超过阈值 180 分钟，当前已运行 210 分钟", time: "14:45:30" },
]

// ── 任务列表 ──────────────────────────────────────────────────────

export const tasks: TaskItem[] = [
  // 1. 全量封包 - 进行中
  {
    id: "t0", taskNo: "TK-20260526-001", name: "苏州市档案馆全量封包", type: "full_package",
    phase: "packaging", status: "running", priority: "high", progress: 58,
    archiveName: "苏州市档案馆", dataClassification: "馆藏档案",
    siteName: "上海数据中心", siteCode: "SH-RD-01", operator: "张建国", department: "设备运维部",
    sourcePath: "/data/suzhou/archive/full/", packagePath: "/output/suzhou/20260526/",
    volumeId: "VOL-SU-2026-Q2", backupScope: "full", packagingMode: "scan_while_package",
    deviceId: "r1", deviceName: "du32", rackId: "R-A12", rackName: "硬盘库-A12",
    startedAt: "2026-05-26 08:30:00", updatedAt: "2026-05-26 15:40:00",
    fileCount: 128456, totalSize: "2.8 TB", packagedSize: "1.62 TB",
    packageCount: 24, successCount: 22, errorCount: 1, speed: "320 MB/s",
    packagingThreads: [
      { id: "th1", name: "线程 1", status: "completed", progress: 100, speed: "1.2 GB/min" },
      { id: "th2", name: "线程 2", status: "completed", progress: 100, speed: "1.1 GB/min" },
      { id: "th3", name: "线程 3", status: "running", progress: 65, speed: "800 MB/min" },
      { id: "th4", name: "线程 4", status: "running", progress: 28, speed: "600 MB/min" },
    ],
    sm3Status: "pending", sm3Progress: 0,
    recentLogs: [
      makeLog("rl0a", "t0", "15:40:15", "info", "线程 3：封包 SU-20260526-012.iso 进度 65%"),
      makeLog("rl0b", "t0", "15:35:00", "info", "线程 1：封包 SU-20260526-008.iso 完成，SM3 校验通过"),
      makeLog("rl0c", "t0", "15:30:00", "info", "线程 2：封包 SU-20260526-009.iso 完成，SM3 校验通过"),
      makeLog("rl0d", "t0", "15:20:00", "warn", "线程 4：等待分配光盘槽位，队列等待中"),
      makeLog("rl0e", "t0", "08:30:00", "info", "开始扫描源目录 /data/suzhou/archive/full/"),
      makeLog("rl0f", "t0", "08:30:30", "info", "完成文件统计：共 128,456 个文件，总大小 2.8 TB"),
      makeLog("rl0g", "t0", "08:31:00", "info", "开始分盘：计划分为 42 个数据包"),
      makeLog("rl0h", "t0", "08:35:00", "info", "线程 1 开始封包，模式：边扫描边封包"),
    ],
  },

  // 2. 增量扫描 - 进行中
  {
    id: "t1", taskNo: "TK-20260526-002", name: "湖州市档案馆增量扫描", type: "incremental_scan",
    phase: "scanning", status: "running", priority: "normal", progress: 42,
    archiveName: "湖州市档案馆", dataClassification: "增量档案",
    siteName: "上海数据中心", siteCode: "SH-RD-01", operator: "张建国", department: "数据管理部",
    sourcePath: "/data/huzhou/archive/incremental/", packagePath: "/output/huzhou/inc-20260526/",
    volumeId: "VOL-HZ-INC-0526", backupScope: "incremental", packagingMode: "scan_then_package",
    deviceId: "r1", deviceName: "du32", rackId: "R-A12", rackName: "硬盘库-A12",
    startedAt: "2026-05-26 10:15:00", updatedAt: "2026-05-26 15:38:00",
    fileCount: 128456, totalSize: "2.8 TB",  // 已扫描部分
    packagedSize: "0 B", packageCount: 0, successCount: 0, errorCount: 0, speed: "85 MB/s",
    sm3Status: "pending",
    recentLogs: [
      makeLog("rl1a", "t1", "15:38:00", "info", "增量扫描进度 42%：已发现 5,400 个变更文件"),
      makeLog("rl1b", "t1", "14:45:30", "warn", "执行时间超过阈值 180 分钟，当前已运行 210 分钟"),
      makeLog("rl1c", "t1", "12:00:00", "info", "加载上次全量备份索引：TK-20260501-FULL"),
      makeLog("rl1d", "t1", "10:15:00", "info", "开始增量扫描：与上次全量备份对比差异文件"),
      makeLog("rl1e", "t1", "10:15:30", "info", "索引加载完成，开始遍历源目录"),
    ],
  },

  // 3. 全量扫描 - 已完成
  {
    id: "t2", taskNo: "TK-20260526-003", name: "绍兴市档案馆全量扫描", type: "full_scan",
    phase: "completed", status: "completed", priority: "normal", progress: 100,
    archiveName: "绍兴市档案馆", dataClassification: "馆藏档案",
    siteName: "南京中心", siteCode: "NJ-DC-05", operator: "孙丽", department: "数据管理部",
    sourcePath: "/data/shaoxing/archive/full/", packagePath: "/output/shaoxing/scan-20260526/",
    volumeId: "VOL-SX-FULL-0526", backupScope: "full", packagingMode: "scan_then_package",
    deviceId: "r2", deviceName: "du32-bj", rackId: "R-B03", rackName: "硬盘库-B03",
    startedAt: "2026-05-26 06:00:00", updatedAt: "2026-05-26 12:30:00",
    completedAt: "2026-05-26 12:30:00",
    fileCount: 67890, totalSize: "1.5 TB",
    packagedSize: "0 B", packageCount: 0, successCount: 67890, errorCount: 2, speed: "1.2 GB/s",
    sm3Status: "completed", sm3Progress: 100,
    recentLogs: [
      makeLog("rl2a", "t2", "12:30:00", "info", "全量扫描完成：67,890 个文件，1.5 TB，无异常文件 2 个"),
      makeLog("rl2b", "t2", "12:25:00", "info", "SM3 哈希校验完成：67,890/67,890 全部通过"),
      makeLog("rl2c", "t2", "06:00:00", "info", "开始全量扫描：/data/shaoxing/archive/full/"),
      makeLog("rl2d", "t2", "06:05:00", "info", "完成文件统计：共 67,890 个文件，1.5 TB"),
    ],
  },

  // 4. 数据恢复 - 待处理
  {
    id: "t3", taskNo: "TK-20260526-004", name: "馆藏 GC 数据恢复任务", type: "restore",
    phase: "pending", status: "pending_dispatch", priority: "high", progress: 0,
    archiveName: "绍兴市档案馆", dataClassification: "馆藏档案",
    siteName: "上海数据中心", siteCode: "SH-RD-01", operator: "赵磊", department: "数据利用部",
    sourcePath: "/output/shaoxing/gc-data/", packagePath: "/restore/shaoxing/gc-data/",
    volumeId: "VOL-GC-RESTORE", backupScope: "full", packagingMode: "scan_then_package",
    deviceId: "r3", deviceName: "R-M220", rackId: "R-M220", rackName: "光盘库-M220",
    startedAt: "—", updatedAt: "2026-05-26 09:00:00",
    fileCount: 12340, totalSize: "450 GB",
    recentLogs: [
      makeLog("rl3a", "t3", "09:00:00", "info", "恢复任务创建，等待调度"),
      makeLog("rl3b", "t3", "09:00:05", "info", "目标设备 R-M220 当前空闲，可以执行"),
      makeLog("rl3c", "t3", "09:00:10", "info", "任务已加入调度队列，等待下发"),
      makeLog("rl3d", "t3", "09:00:15", "info", "源数据校验：12,340 个文件，450 GB，准备就绪"),
    ],
  },

  // 5. 盘笼移位 - 进行中
  {
    id: "t4", taskNo: "TK-20260526-005", name: "蓝盘卷242盘笼移位任务", type: "migrate",
    phase: "writing", status: "running", priority: "normal", progress: 68,
    archiveName: "蓝盘卷242", dataClassification: "蓝光盘卷",
    siteName: "南京中心", siteCode: "NJ-DC-05", operator: "孙丽", department: "设备运维部",
    sourcePath: "/shelf/cage-242/", packagePath: "/shelf/cage-280/",
    volumeId: "VOL-BLUE242", backupScope: "full", packagingMode: "scan_then_package",
    deviceId: "r5", deviceName: "172.168.6.15", rackId: "R-NAS01", rackName: "CIFS网盘-NAS01",
    startedAt: "2026-05-26 15:00:00", updatedAt: "2026-05-26 16:35:00",
    fileCount: 96, totalSize: "17.8 TB",
    packagedSize: "12.1 TB", packageCount: 0, successCount: 65, errorCount: 0, speed: "3.5 TB/h",
    recentLogs: [
      makeLog("rl4a", "t4", "16:35:00", "info", "搬运单元 1：已搬运 65/96 块蓝光盘"),
      makeLog("rl4b", "t4", "16:30:00", "info", "搬运单元 2：正在搬运第 31 块光盘"),
      makeLog("rl4c", "t4", "15:00:00", "info", "盘笼移位任务启动：南京 IDC-A → 南京 IDC-E"),
      makeLog("rl4d", "t4", "15:00:30", "info", "扫描待移位盘片：共 96 块蓝光盘"),
      makeLog("rl4e", "t4", "15:05:00", "info", "盘片编号校验完成，移位准备就绪"),
    ],
  },

  // 6. 设备扫描 - 已完成
  {
    id: "t5", taskNo: "TK-20260526-006", name: "du32 硬盘库设备扫描", type: "device_scan",
    phase: "completed", status: "completed", priority: "normal", progress: 100,
    archiveName: "du32", dataClassification: "设备扫描",
    siteName: "上海数据中心", siteCode: "SH-RD-01", operator: "系统", department: "设备运维部",
    sourcePath: "/dev/sda", packagePath: "/dev/sda",
    backupScope: "full", packagingMode: "scan_then_package",
    deviceId: "r1", deviceName: "du32", rackId: "R-A12", rackName: "硬盘库-A12",
    startedAt: "2026-05-26 14:00:00", updatedAt: "2026-05-26 14:45:00",
    completedAt: "2026-05-26 14:45:00",
    fileCount: 4, totalSize: "32 TB",
    packagedSize: "0 B", packageCount: 0, successCount: 4, errorCount: 0, speed: "—",
    recentLogs: [
      makeLog("rl5a", "t5", "14:45:00", "info", "设备扫描完成：4 块硬盘，全部健康"),
      makeLog("rl5b", "t5", "14:30:00", "info", "SMART 健康检测：4/4 通过"),
      makeLog("rl5c", "t5", "14:00:00", "info", "设备扫描启动：du32 (10.186.1.237)"),
    ],
  },

  // 7. RAID 校验 - 待处理
  {
    id: "t6", taskNo: "TK-20260526-007", name: "硬盘库 RAID 5 校验任务", type: "raid_check",
    phase: "pending", status: "pending_dispatch", priority: "high", progress: 0,
    archiveName: "du32-bj", dataClassification: "RAID校验",
    siteName: "北京总部", siteCode: "BJ-HQ-02", operator: "系统", department: "设备运维部",
    sourcePath: "/dev/sda", packagePath: "/dev/sda",
    backupScope: "full", packagingMode: "scan_then_package",
    deviceId: "r2", deviceName: "du32-bj", rackId: "R-B03", rackName: "硬盘库-B03",
    startedAt: "—", updatedAt: "2026-05-26 09:30:00",
    fileCount: 4, totalSize: "48 TB",
    recentLogs: [
      makeLog("rl6a", "t6", "09:30:00", "info", "RAID 校验任务创建，等待调度"),
      makeLog("rl6b", "t6", "09:30:10", "info", "RAID 类型：RAID 5，成员盘 4 块"),
      makeLog("rl6c", "t6", "09:30:20", "info", "校验模式：一致性校验，预期耗时约 6 小时"),
    ],
  },

  // 8. 数据备份 - 已失败
  {
    id: "t7", taskNo: "TK-20260526-008", name: "北京市档案馆增量备份", type: "backup",
    phase: "failed", status: "failed", priority: "high", progress: 28,
    archiveName: "北京市档案馆", dataClassification: "增量档案",
    siteName: "北京总部", siteCode: "BJ-HQ-02", operator: "王芳", department: "数据管理部",
    sourcePath: "/data/beijing/incremental/20260526/", packagePath: "/output/beijing/inc-20260526/",
    volumeId: "VOL-BJ-INC-0526", backupScope: "incremental", packagingMode: "scan_while_package",
    deviceId: "r2", deviceName: "du32-bj", rackId: "R-B03", rackName: "硬盘库-B03",
    startedAt: "2026-05-26 02:00:00", updatedAt: "2026-05-26 09:45:00",
    errorMessage: "校验失败：128 个数据块中 7 个 SM3 哈希不匹配，损坏率 5.47%，超过阈值 1%",
    fileCount: 450000, totalSize: "5.2 TB",
    packagedSize: "1.46 TB", packageCount: 4, successCount: 3, errorCount: 1, speed: "320 MB/s",
    sm3Status: "failed", sm3Progress: 28,
    retryCount: 3, lastRetryAt: "2026-05-26 09:45:10",
    recentLogs: [
      makeLog("rl7a", "t7", "09:45:10", "error", "任务失败：SM3 校验不通过，7 个数据块损坏"),
      makeLog("rl7b", "t7", "09:30:00", "error", "校验异常：数据块 BK-0089 SM3 不匹配，标记损坏"),
      makeLog("rl7c", "t7", "08:15:00", "warn", "发现第 5 个异常数据块：BK-0067"),
      makeLog("rl7d", "t7", "06:00:00", "info", "校验进度 28%：128/456 个数据块完成"),
      makeLog("rl7e", "t7", "02:00:00", "info", "SM3 哈希校验启动：目标 456 个数据块"),
    ],
  },

  // 9. 全量封包 - 已失败
  {
    id: "t8", taskNo: "TK-20260525-009", name: "苏州市档案馆全量封包", type: "full_package",
    phase: "failed", status: "failed", priority: "high", progress: 67,
    archiveName: "苏州市档案馆", dataClassification: "馆藏档案",
    siteName: "上海数据中心", siteCode: "SH-RD-01", operator: "陈强", department: "设备运维部",
    sourcePath: "/data/suzhou/archive/full/", packagePath: "/output/suzhou/20260525/",
    volumeId: "VOL-SU-PKG-0525", backupScope: "full", packagingMode: "scan_while_package",
    deviceId: "r3", deviceName: "R-M220", rackId: "R-M220", rackName: "光盘库-M220",
    startedAt: "2026-05-25 14:00:00", updatedAt: "2026-05-25 22:30:00",
    errorMessage: "封包线程异常：光驱 R-M220-S06 读写错误，无法继续写入",
    fileCount: 89234, totalSize: "1.8 TB",
    packagedSize: "1.21 TB", packageCount: 12, successCount: 10, errorCount: 1, speed: "8x",
    packagingThreads: [
      { id: "th1", name: "线程 1", status: "completed", progress: 100 },
      { id: "th2", name: "线程 2", status: "completed", progress: 100 },
      { id: "th3", name: "线程 3", status: "error", progress: 45 },
      { id: "th4", name: "线程 4", status: "completed", progress: 100 },
    ],
    sm3Status: "pending", sm3Progress: 0,
    recentLogs: [
      makeLog("rl8a", "t8", "22:30:00", "error", "线程 3 异常：光驱 S06 读写错误，封包中止"),
      makeLog("rl8b", "t8", "22:25:00", "warn", "线程 3：检测到写入延迟异常，尝试重试"),
      makeLog("rl8c", "t8", "20:00:00", "info", "线程 4：封包完成，SM3 校验通过"),
      makeLog("rl8d", "t8", "14:00:00", "info", "封包任务启动：89,234 个文件"),
      makeLog("rl8e", "t8", "14:10:00", "info", "文件扫描完成，生成 28 个封包计划"),
    ],
  },

  // 10. 增量封包 - 已完成
  {
    id: "t9", taskNo: "TK-20260526-010", name: "嘉兴市档案馆增量封包", type: "incremental_package",
    phase: "completed", status: "completed", priority: "normal", progress: 100,
    archiveName: "嘉兴市档案馆", dataClassification: "增量档案",
    siteName: "北京总部", siteCode: "BJ-HQ-02", operator: "王芳", department: "数据管理部",
    sourcePath: "/data/jiaxing/incremental/20260526/", packagePath: "/output/jiaxing/inc-20260526/",
    volumeId: "VOL-JX-INC-0526", backupScope: "incremental", packagingMode: "scan_then_package",
    deviceId: "r2", deviceName: "du32-bj", rackId: "R-B03", rackName: "硬盘库-B03",
    startedAt: "2026-05-26 08:00:00", updatedAt: "2026-05-26 14:30:00",
    completedAt: "2026-05-26 14:30:00",
    fileCount: 23400, totalSize: "520 GB",
    packagedSize: "520 GB", packageCount: 8, successCount: 8, errorCount: 0, speed: "1.5 GB/min",
    packagingThreads: [
      { id: "th1", name: "线程 1", status: "completed", progress: 100 },
      { id: "th2", name: "线程 2", status: "completed", progress: 100 },
      { id: "th3", name: "线程 3", status: "completed", progress: 100 },
    ],
    sm3Status: "completed", sm3Progress: 100,
    recentLogs: [
      makeLog("rl9a", "t9", "14:30:00", "info", "任务执行完成：8 个封包，校验通过"),
      makeLog("rl9b", "t9", "14:25:00", "info", "SM3 校验完成：8/8 全部通过"),
      makeLog("rl9c", "t9", "08:00:00", "info", "增量封包启动"),
      makeLog("rl9d", "t9", "08:05:00", "info", "增量扫描完成：23,400 个变更文件"),
      makeLog("rl9e", "t9", "14:20:00", "info", "所有封包写入完成，开始最终校验"),
    ],
  },
]

// ── 统计数据（从任务列表实时计算） ──────────────────────────────
export const taskStats: TaskStats = {
  total: tasks.length,
  pending: tasks.filter(t => t.phase === "pending").length,
  running: tasks.filter(t => ["scanning", "preparing", "splitting", "packaging", "verifying", "writing"].includes(t.phase)).length,
  completed: tasks.filter(t => t.phase === "completed").length,
  failed: tasks.filter(t => t.phase === "failed").length,
  paused: tasks.filter(t => t.phase === "paused").length,
}

// ── 任务日志（从任务 recentLogs 汇总） ──────────────────────────
export const taskLogs: TaskLogEntry[] = tasks.flatMap(t => t.recentLogs).slice(0, 30)