/**
 * 任务类型展示 —— 对齐业务系统 tbl_task.task_type + task_mode
 * 不含 task_name / data_source 特例分支
 */

/** 中心库 unified_tasks.task_type (varchar) → 源 tbl_task.task_type (int) */
const UNIFIED_TASK_TYPE_TO_NUM: Record<string, number> = {
  backup: 0,
  restore: 1,
  burn_and_seal: 2,
  epson_api: 3,
  scan: 4,
  optical_copy: 5,
  volume_copy: 6,
  s3: 7,
  package: 8,
  evidence: 9,
  power_on: 10,
  remote_backup: 11,
}

const NUM_TO_UNIFIED_TASK_TYPE: Record<number, string> = Object.fromEntries(
  Object.entries(UNIFIED_TASK_TYPE_TO_NUM).map(([k, v]) => [v, k]),
) as Record<number, string>

/** 仅 task_type 即可确定的标签 */
const TYPE_ONLY_LABELS: Record<number, string> = {
  0: "备份任务",
  3: "出版任务",
  4: "扫描任务",
  5: "硬盘复制到光盘",
  6: "硬盘复制到硬盘",
  7: "S3归档",
  8: "封包任务",
  10: "加电任务",
  11: "异地热备",
}

/** task_type-task_mode 组合标签 */
const TYPE_MODE_LABELS: Record<string, string> = {
  "0-6": "硬盘克隆",
  "0-8": "离线接收",
  "0-10": "接收校验",
  "1-0": "恢复任务",
  "1-1": "恢复任务",
  "1-2": "恢复任务",
  "1-11": "光盘复制到硬盘",
  "1-12": "巡检任务",
  "1-13": "在线巡检",
  "1-14": "介质巡检",
  "4-10": "接收任务",
  "8-8": "拷贝任务",
  "8-9": "封包任务",
  "8-10": "扫描任务",
  "8-11": "封包任务",
  "8-12": "封包任务",
  "9-0": "存证任务",
  "9-1": "验证任务",
  "11-0": "异地热备",
}

/**
 * 列表「任务类型」筛选：备份 / 恢复 / 巡检 / 扫描
 * value 格式同业务 chooseType（如 0,7 / 1-0,1-1 / 1-12 / 4）
 */
export const TASK_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "0,7", label: "备份" },
  { value: "1-0,1-1,1-2", label: "恢复" },
  { value: "1-12", label: "巡检" },
  { value: "4", label: "扫描" },
]

export type TaskTypeFilterGroup = {
  unifiedTypes: string[]
  modes?: number[]
  /** 兼容旧筛选：排除指定 mode */
  excludeModes?: number[]
}

/**
 * 解析筛选 value → SQL 条件组（多组 OR）
 * 对齐 LongTermStorage parseChooseTypeQuery，并兼容旧命名 value（backup/restore/package）
 */
export function parseTaskTypeFilter(value: string): {
  groups: TaskTypeFilterGroup[]
} | null {
  if (!value || value === "all") return null

  // 兼容旧 Tab / URL
  if (value === "backup") {
    return { groups: [{ unifiedTypes: ["backup", "s3"] }] }
  }
  if (value === "restore") {
    return { groups: [{ unifiedTypes: ["restore"], modes: [0, 1, 2] }] }
  }
  if (value === "package") {
    return { groups: [{ unifiedTypes: ["package"], excludeModes: [10] }] }
  }
  if (value === "scan") {
    return { groups: [{ unifiedTypes: ["scan"], excludeModes: [10] }] }
  }
  // 纯 unified 英文名（旧下拉）
  if (!/^\d/.test(value) && !value.includes(",") && !value.includes("-")) {
    return { groups: [{ unifiedTypes: [value] }] }
  }

  const parts = String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const hasAnyMode = parts.some((p) => {
    const typePart = p.includes("@") ? p.slice(0, p.indexOf("@")) : p
    return typePart.includes("-")
  })

  // 无 mode：如 0,7 / 5,6 / 4 / 10 → 一组 type IN (...)
  if (!hasAnyMode) {
    const unifiedTypes: string[] = []
    for (const part of parts) {
      const t = parseInt(part, 10)
      if (!Number.isFinite(t)) continue
      unifiedTypes.push(NUM_TO_UNIFIED_TASK_TYPE[t] ?? `unknown_type_${t}`)
    }
    if (unifiedTypes.length === 0) return null
    return { groups: [{ unifiedTypes }] }
  }

  // 有 mode：如 1-0,1-1 / 1-12 / 4-10 → 每段一组，最终 OR
  const groups: TaskTypeFilterGroup[] = []
  for (const part of parts) {
    const typePart = part.includes("@") ? part.slice(0, part.indexOf("@")) : part
    const [tStr, mStr] = typePart.split("-")
    const t = parseInt(tStr, 10)
    if (!Number.isFinite(t)) continue
    const unified = NUM_TO_UNIFIED_TASK_TYPE[t] ?? `unknown_type_${t}`
    if (mStr != null && mStr !== "") {
      const m = parseInt(mStr, 10)
      if (!Number.isFinite(m)) continue
      groups.push({ unifiedTypes: [unified], modes: [m] })
    } else {
      groups.push({ unifiedTypes: [unified] })
    }
  }
  if (groups.length === 0) return null
  return { groups }
}

/** 将 parseTaskTypeFilter 结果转为 SQL 片段 */
export function buildTaskTypeFilterSql(
  value: string,
  paramIndex: number,
): { sql: string; params: unknown[]; nextIndex: number } | null {
  const parsed = parseTaskTypeFilter(value)
  if (!parsed) return null

  const params: unknown[] = []
  const groupSqls: string[] = []
  let idx = paramIndex

  for (const g of parsed.groups) {
    const parts: string[] = []
    parts.push(`task_type = ANY($${idx++})`)
    params.push(g.unifiedTypes)
    if (g.modes && g.modes.length > 0) {
      parts.push(`task_mode = ANY($${idx++})`)
      params.push(g.modes)
    }
    if (g.excludeModes && g.excludeModes.length > 0) {
      parts.push(`(task_mode IS NULL OR NOT (task_mode = ANY($${idx++})))`)
      params.push(g.excludeModes)
    }
    groupSqls.push(`(${parts.join(" AND ")})`)
  }

  if (groupSqls.length === 0) return null
  return {
    sql: `(${groupSqls.join(" OR ")})`,
    params,
    nextIndex: idx,
  }
}

export function resolveNumericTaskType(unifiedTaskType: string): number | null {
  const mapped = UNIFIED_TASK_TYPE_TO_NUM[unifiedTaskType]
  if (mapped != null) return mapped
  const unknown = /^unknown_type_(\d+)$/.exec(unifiedTaskType)
  if (unknown) return parseInt(unknown[1], 10)
  return null
}

/** 源 tbl_task 数值 task_type + task_mode → 中文类型名 */
export function formatTaskTypeLabel(
  taskType: number,
  taskMode: number | null | undefined,
): string {
  const mode = taskMode ?? 0

  if (taskType === 1 || taskType === 8 || (taskType === 4 && mode === 10)) {
    const key = `${taskType}-${mode}`
    return TYPE_MODE_LABELS[key] ?? TYPE_ONLY_LABELS[taskType] ?? `类型${taskType}-${mode}`
  }

  if (taskType === 9) {
    if (mode === 0) return "存证任务"
    if (mode === 1) return "验证任务"
  }

  if (taskType === 0) {
    if (mode === 8) return "离线接收"
    if (mode === 10) return "接收校验"
    if (mode === 6) return "硬盘克隆"
  }

  return TYPE_ONLY_LABELS[taskType] ?? `类型${taskType}`
}

/** 中心库 unified_tasks.task_type + task_mode → 中文类型名 */
export function formatTaskTypeLabelFromUnified(
  unifiedTaskType: string,
  taskMode: number | null | undefined,
): string {
  const num = resolveNumericTaskType(unifiedTaskType)
  if (num == null) return unifiedTaskType
  return formatTaskTypeLabel(num, taskMode)
}
