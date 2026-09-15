/**
 * 日志检索页的有限枚举值定义
 * 口径对齐业务推送终态 + 各 Tab 真实写入值（非历史大杂烩）
 */

export const LOG_STATUS_OPTIONS_BY_TAB = {
  /** 推送终态三态；receiving 覆盖推到一半卡住 */
  sync_package: ["success", "partial", "failed", "receiving"],
  /** 表级落库终态基本只有成功/失败 */
  sync_table: ["success", "failed"],
  /** success 筛选时同时匹配历史 completed（立即同步旧值） */
  sync_scheduler: ["success", "partial", "failed"],
  sync_consistency: ["matched", "mismatched", "failed"],
  control: ["success", "failed"],
  audit: ["success", "failed"],
  login_audit: ["success", "failed", "locked", "logout"],
} as const

export type LogTabKey = keyof typeof LOG_STATUS_OPTIONS_BY_TAB

/** 通用状态码 → 中文（列表/详情；登录审计见下方专用） */
export const LOG_STATUS_LABELS: Record<string, string> = {
  success: "成功",
  failed: "失败",
  running: "运行中",
  pending: "待处理",
  completed: "成功", // 调度历史：与 success 同义展示
  matched: "一致",
  mismatched: "不一致",
  receiving: "接收中",
  partial: "部分成功",
  duplicated: "重复包",
  skipped: "已跳过",
  abandoned: "已放弃",
  warning: "警告",
  pulled: "已拉取",
  cancelled: "已取消",
  unsupported: "不支持",
  dry_run_success: "模拟成功",
  locked: "已锁定",
  logout: "已退出",
  accepted: "已受理",
}

/** 登录审计 result → 中文（勿与通用「成功/失败」共用） */
export const LOGIN_AUDIT_STATUS_LABELS: Record<string, string> = {
  success: "登录成功",
  failed: "登录失败",
  locked: "登录锁定",
  logout: "已退出",
}

export function logStatusLabel(
  status: string | null | undefined,
  logType?: string | null,
): string {
  if (!status) return "—"
  if (logType === "login_audit") {
    return LOGIN_AUDIT_STATUS_LABELS[status] ?? status
  }
  return LOG_STATUS_LABELS[status] ?? status
}

/** 站点展示：导出审计写死的 __ALL__ → 全部站点 */
export function logSiteCodeLabel(siteCode: string | null | undefined): string {
  if (!siteCode || !siteCode.trim()) return "—"
  if (siteCode === "__ALL__") return "全部站点"
  return siteCode
}

// command_type 来自 databases/sprint-r39/sync-command-types.sql
export const LOG_TASK_TYPE_OPTIONS = [
  { value: "task_pause", label: "暂停任务" },
  { value: "task_resume", label: "恢复任务" },
  { value: "task_reset", label: "重置任务" },
  { value: "task_create", label: "新建任务" },
  { value: "task_priority_restore", label: "优先级恢复" },
  { value: "inspect_start", label: "开始巡检" },
  { value: "recovery_start", label: "开始热恢复" },
  { value: "sync_full", label: "全量同步" },
  { value: "sync_incremental", label: "增量同步" },
] as const

/** action / command_type → 中文操作名（列表「操作」列） */
export const LOG_OPERATION_LABELS: Record<string, string> = {
  // 控制命令 / 任务
  task_pause: "暂停任务",
  task_resume: "恢复任务",
  task_reset: "重置任务",
  task_create: "新建任务",
  task_create_queued: "新建任务",
  task_priority_restore: "优先级恢复",
  inspect_start: "开始巡检",
  recovery_start: "开始热恢复",
  sync_full: "全量同步",
  sync_incremental: "增量同步",
  sync_full_triggered: "触发全量同步",
  sync_incremental_triggered: "触发增量同步",
  cage_move_register: "盘笼移位",
  cage_move_registered: "盘笼移位",
  cage_move_cancelled: "撤销盘笼移位",
  restore_file_register: "发起回迁",
  restore_file_register_fanout: "区域回迁登记",
  permission_sync: "权限同步",
  permission_sync_queued: "权限同步",
  // 账号
  create_account: "创建用户",
  update_account: "更新用户",
  enable_account: "启用用户",
  disable_account: "停用用户",
  delete_account: "删除用户",
  reset_password: "重置密码",
  unlock_account: "解锁账号",
  change_password: "修改密码",
  create_account_mapping: "创建账号映射",
  update_account_mapping: "更新账号映射",
  delete_account_mapping: "删除账号映射",
  // 角色
  role_create: "创建角色",
  role_permissions_update: "更新角色权限",
  role_meta_update: "更新角色信息",
  role_delete: "删除角色",
  // 站点 / SSO / 区域
  update_site: "更新站点",
  disable_site: "停用站点",
  site_sso_jump: "站点单点登录",
  site_region_create: "创建站点区域",
  site_region_update: "更新站点区域",
  site_region_delete: "删除站点区域",
  site_region_reorder: "调整区域顺序",
  // 同步
  notify_site_push: "立即同步",
  push_now: "立即同步",
  index_export: "导出索引",
  // 系统
  update_config: "更新系统配置",
  // 导出（无细分时的兜底）
  export: "导出数据",
  // 登录审计 result
  success: "登录成功",
  failed: "登录失败",
  locked: "账号锁定",
  logout: "退出登录",
}

/** exportType → 导出对象中文（详情「导出对象」列） */
export const EXPORT_OBJECT_LABELS: Record<string, string> = {
  devices: "设备",
  users: "用户",
  logs: "日志",
  login_audit: "登录审计",
  sync_package: "同步包",
  sync_table: "同步表",
  sync_scheduler: "调度日志",
  sync_consistency: "一致性日志",
  sync_control: "控制命令",
  sync_audit: "审计日志",
}

const EXPORT_TARGET_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(EXPORT_OBJECT_LABELS).map(([k, v]) => [k, `导出${v}`]),
)

/** 日志类型 → 中文（列表「类型」列 / 导出） */
export const LOG_TYPE_LABELS: Record<string, string> = {
  sync_package: "同步包日志",
  sync_table: "同步表日志",
  sync_scheduler: "调度日志",
  sync_consistency: "一致性日志",
  control: "控制命令",
  audit: "审计日志",
  login_audit: "登录审计",
}

export function logTypeLabel(t: string | null | undefined): string {
  if (!t) return "—"
  return LOG_TYPE_LABELS[t] ?? t
}

export function exportObjectLabel(exportType: string | null | undefined): string {
  if (!exportType) return "—"
  return EXPORT_OBJECT_LABELS[exportType] ?? exportType
}

/**
 * 详情里目标字段的展示：导出用「导出对象」，同步表用「表名」，其它用「目标」。
 */
export function logTargetDisplay(row: {
  log_type: string
  detail?: unknown
  ref_table_name?: string | null
}): { label: string; value: string } | null {
  const raw = row.ref_table_name?.trim()
  if (!raw) return null

  if (row.log_type === "audit") {
    const action = detailField(row.detail, "action")
    if (action === "export") {
      return { label: "导出对象", value: exportObjectLabel(raw) }
    }
    return { label: "目标", value: raw }
  }
  if (row.log_type === "sync_table") {
    return { label: "表名", value: raw }
  }
  return { label: "目标", value: raw }
}

const LOG_TYPE_OPERATION_FALLBACK: Record<string, string> = {
  sync_package: "同步包传输",
  sync_table: "同步表写入",
  sync_scheduler: "定时调度",
  sync_consistency: "一致性对账",
  control: "控制命令",
  audit: "业务操作",
  login_audit: "登录认证",
}

function detailField(detail: unknown, key: string): string | null {
  if (!detail || typeof detail !== "object") return null
  const v = (detail as Record<string, unknown>)[key]
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/**
 * 日志列表「操作」列：业务可读中文，摘要仍保留技术明细。
 */
export function logOperationLabel(row: {
  log_type: string
  status?: string | null
  detail?: unknown
  ref_table_name?: string | null
  error_code?: string | null
}): string {
  const t = row.log_type

  if (t === "login_audit") {
    const r = (row.status ?? "").toLowerCase()
    if (r === "success") return "登录成功"
    if (r === "failed") return "登录失败"
    if (r === "locked") return "账号锁定"
    if (r === "logout") return "退出登录"
    return LOG_TYPE_OPERATION_FALLBACK.login_audit
  }

  if (t === "sync_package" || t === "sync_table" || t === "sync_scheduler" || t === "sync_consistency") {
    // 调度日志里可能混有「立即同步」通知
    if (t === "sync_scheduler") {
      const runId = detailField(row.detail, "run_id") ?? ""
      if (runId.startsWith("notify-")) return "立即同步"
    }
    return LOG_TYPE_OPERATION_FALLBACK[t] ?? "同步操作"
  }

  if (t === "control") {
    const cmd =
      detailField(row.detail, "command_type") ??
      detailField(row.detail, "task_type") ??
      ""
    return LOG_OPERATION_LABELS[cmd] ?? LOG_TYPE_OPERATION_FALLBACK.control
  }

  if (t === "audit") {
    const action = detailField(row.detail, "action") ?? ""
    const target =
      detailField(row.detail, "target_table") ??
      row.ref_table_name ??
      ""

    if (action === "export") {
      return EXPORT_TARGET_LABELS[target] ?? "导出数据"
    }
    if (action && LOG_OPERATION_LABELS[action]) {
      return LOG_OPERATION_LABELS[action]
    }
    // 未登记的 action 不直接露英文码（摘要仍可看技术明细）
    return LOG_TYPE_OPERATION_FALLBACK.audit
  }

  return "其他操作"
}
