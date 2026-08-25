/**
 * 物理回迁展示纯函数（无 DB 依赖，可供 Client Component 引用）
 */

/** 物理位置回迁：task_type=1 + task_mode=2 */
export function isPhysicalRestoreTask(
  taskType: string | number | null | undefined,
  taskMode: number | null | undefined
): boolean {
  if (taskMode !== 2) return false
  if (taskType === 1 || taskType === "1") return true
  if (typeof taskType === "string" && taskType === "restore") return true
  return false
}

/** restore_status：1 待处理 / 6 成功 / 7 离线 / 9 失败 */
export function formatRestoreFileStatus(status: number | null | undefined): string {
  switch (status) {
    case 1:
      return "待处理"
    case 6:
      return "回迁成功"
    case 7:
      return "离线"
    case 9:
      return "回迁失败"
    default:
      return status == null ? "—" : `状态${status}`
  }
}
