/**
 * 站点预警展示标签 — 与站点 UI EarlyWarningList 枚举对齐
 * type: 0空间不足 / 1温度异常 / 2设备异常
 * s_level: 0警告 / 1错误 / 2严重错误 / 3紧急
 * status: 0未处理 / 1处理中 / 2已完成
 */

export const EARLY_WARNING_TYPE_LABELS = ["空间不足", "温度异常", "设备异常"] as const
export const EARLY_WARNING_LEVEL_LABELS = ["警告", "错误", "严重错误", "紧急"] as const
export const EARLY_WARNING_STATUS_LABELS = ["未处理", "处理中", "已完成"] as const

export function toIntOrNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function earlyWarningTypeLabel(type: number | null): string {
  if (type == null) return "—"
  return EARLY_WARNING_TYPE_LABELS[type] ?? `类型${type}`
}

export function earlyWarningLevelLabel(level: number | null): string {
  if (level == null) return "—"
  return EARLY_WARNING_LEVEL_LABELS[level] ?? `级别${level}`
}

export function earlyWarningStatusLabel(status: number | null): string {
  if (status == null) return "—"
  return EARLY_WARNING_STATUS_LABELS[status] ?? `状态${status}`
}

export interface EarlyWarningListItem {
  sourceSiteId: string
  sourceRecordId: string
  srcWarningId: number | null
  title: string
  type: number | null
  typeLabel: string
  level: number | null
  levelLabel: string
  status: number | null
  statusLabel: string
  triggeredAt: string | null
  libId: number | null
  syncedAt: string | null
}

export interface EarlyWarningFeedbackItem {
  sourceSiteId: string
  sourceRecordId: string
  srcFeedbackId: number | null
  warningId: number | null
  content: string
  userName: string | null
  feedbackAt: string | null
}

export function mapEarlyWarningRow(row: Record<string, unknown>): EarlyWarningListItem {
  const raw = (row.raw_data && typeof row.raw_data === "object"
    ? (row.raw_data as Record<string, unknown>)
    : {}) as Record<string, unknown>

  const type = toIntOrNull(row.warning_type ?? raw.type)
  const level = toIntOrNull(row.warning_level ?? raw.s_level)
  const status = toIntOrNull(row.status ?? raw.status)
  const title =
    (typeof row.message === "string" && row.message) ||
    (typeof raw.title === "string" && raw.title) ||
    ""

  const triggered =
    row.triggered_at != null
      ? String(row.triggered_at)
      : raw.create_date != null
        ? String(raw.create_date)
        : null

  return {
    sourceSiteId: String(row.source_site_id ?? ""),
    sourceRecordId: String(row.source_record_id ?? ""),
    srcWarningId: toIntOrNull(row.src_warning_id ?? raw.id),
    title,
    type,
    typeLabel: earlyWarningTypeLabel(type),
    level,
    levelLabel: earlyWarningLevelLabel(level),
    status,
    statusLabel: earlyWarningStatusLabel(status),
    triggeredAt: triggered,
    libId: toIntOrNull(row.lib_id ?? raw.lib_id),
    syncedAt: row.synced_at != null ? String(row.synced_at) : null,
  }
}

export function mapEarlyWarningFeedbackRow(row: Record<string, unknown>): EarlyWarningFeedbackItem {
  const raw = (row.raw_data && typeof row.raw_data === "object"
    ? (row.raw_data as Record<string, unknown>)
    : {}) as Record<string, unknown>

  return {
    sourceSiteId: String(row.source_site_id ?? ""),
    sourceRecordId: String(row.source_record_id ?? ""),
    srcFeedbackId: toIntOrNull(row.src_feedback_id ?? raw.id),
    warningId: toIntOrNull(row.warning_id ?? raw.early_warning_id),
    content:
      (typeof row.feedback_text === "string" && row.feedback_text) ||
      (typeof raw.content === "string" && raw.content) ||
      "",
    userName:
      (typeof row.user_name === "string" && row.user_name) ||
      (typeof raw.user_name === "string" && raw.user_name) ||
      null,
    feedbackAt:
      row.feedback_at != null
        ? String(row.feedback_at)
        : raw.create_date != null
          ? String(raw.create_date)
          : null,
  }
}
