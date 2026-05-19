export interface Notification {
  id: string
  type: "task" | "system" | "security" | "info"
  title: string
  description: string
  time: string
  read: boolean
  targetPath?: string
}

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "task",
    title: "任务完成",
    description: "临床试验数据回迁任务 A09 已完成，共处理 128 个文件",
    time: "2 分钟前",
    read: false,
    targetPath: "/tasks",
  },
  {
    id: "n2",
    type: "security",
    title: "安全告警",
    description: "用户 guest_sh 连续 5 次登录失败，账号已锁定",
    time: "15 分钟前",
    read: false,
    targetPath: "/logs",
  },
  {
    id: "n3",
    type: "system",
    title: "系统通知",
    description: "上海研发中心站点存储卷使用率已达 85%，请及时扩容",
    time: "1 小时前",
    read: false,
    targetPath: "/sites",
  },
  {
    id: "n4",
    type: "task",
    title: "任务异常",
    description: "任务 A12 执行失败，错误码：DISC_NOT_FOUND，请检查光盘状态",
    time: "2 小时前",
    read: true,
    targetPath: "/tasks",
  },
  {
    id: "n5",
    type: "info",
    title: "系统维护",
    description: "系统将于今晚 22:00 进行例行维护，预计耗时 30 分钟",
    time: "3 小时前",
    read: true,
    targetPath: "/settings",
  },
  {
    id: "n6",
    type: "system",
    title: "设备告警",
    description: "盘架 R-03 温度异常，当前温度 42°C，请及时处理",
    time: "5 小时前",
    read: true,
    targetPath: "/racks",
  },
]
