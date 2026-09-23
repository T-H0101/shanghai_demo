/**
 * 回迁相关用户可见文案（总控侧）
 * - 缺字段：英文字段名 → 中文（覆盖校验与站点返回的各类 key）
 * - 网络/系统原文 → 「未知异常」
 */

import {
  UNKNOWN_EXCEPTION_MESSAGE,
  formatApiErrorMessage,
} from "@/lib/api/http-error"

/** 物理位置 / 站点回迁相关字段中文名（可扩展，未知 key 显示「相关字段」） */
const FIELD_LABELS: Record<string, string> = {
  magazine_rfid: "盘笼RFID",
  slot_order: "盘位号",
  disc_side: "光盘面",
  file_path: "文件路径",
  file_hash: "文件校验码",
  file_name: "文件名",
  file_size: "文件大小",
  size: "文件大小",
  device_ip: "设备IP",
  device_port: "设备端口",
  lib_ip: "设备IP",
  lib_port: "设备端口",
  libIp: "设备IP",
  libPort: "设备端口",
  deviceIp: "设备IP",
  devicePort: "设备端口",
  region_code: "目标区域",
  regionCode: "目标区域",
  target_site_code: "目标站点",
  targetSiteCode: "目标站点",
  site_code: "目标站点",
  siteCode: "目标站点",
  "docType(folder_not_supported)": "目录类型（不支持回迁）",
  docType: "文档类型",
  folder_path: "目录路径",
  folderPath: "目录路径",
}

export function labelRestoreMissingField(key: string): string {
  const k = key.trim()
  if (!k) return "相关字段"
  if (FIELD_LABELS[k]) return FIELD_LABELS[k]
  const lower = k.toLowerCase()
  for (const [id, label] of Object.entries(FIELD_LABELS)) {
    if (id.toLowerCase() === lower) return label
  }
  // 未知技术字段名不直接展示英文
  if (/^[a-z][a-z0-9_]*$/i.test(k)) return "相关字段"
  return k
}

export function formatRestoreMissingFields(missing: string[]): string {
  if (!missing.length) return ""
  return missing.map(labelRestoreMissingField).join("、")
}

/** 「物理位置不齐全，缺少: a, b」类文案 → 中文字段 */
function rewriteMissingFieldsInMessage(raw: string): string {
  const m = raw.match(
    /^(.*缺少[:：]\s*)(.+)$/i,
  )
  if (!m) return raw
  const prefix = m[1].replace(/缺少:\s*$/i, "缺少：").replace(/缺少：\s*$/, "缺少：")
  const keys = m[2]
    .split(/[,，、]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!keys.length) return raw
  return `${prefix}${formatRestoreMissingFields(keys)}`
}

/**
 * 单条站点尝试 / 顶层失败 message → 用户可见中文
 */
export function formatRestoreUserMessage(
  message: string | null | undefined,
  reasonCode?: string | null,
): string {
  const raw = (message ?? "").trim()
  const code = (reasonCode ?? "").trim().toUpperCase()

  if (code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "ABORT") {
    return UNKNOWN_EXCEPTION_MESSAGE
  }
  if (
    code === "SITE_DISABLED" ||
    code === "SITE_ENDPOINT_MISSING" ||
    code === "RESTORE_IN_PROGRESS"
  ) {
    // 这些在 dispatch 里已是中文；若空则兜底
    if (raw && /[\u4e00-\u9fff]/.test(raw)) return rewriteMissingFieldsInMessage(raw)
  }

  if (!raw) {
    if (code) return formatApiErrorMessage(code)
    return UNKNOWN_EXCEPTION_MESSAGE
  }

  const rewritten = rewriteMissingFieldsInMessage(raw)
  return formatApiErrorMessage(rewritten)
}

export function formatPhysicalIncompleteMessage(missing: string[]): string {
  const labels = formatRestoreMissingFields(missing)
  return labels
    ? `物理位置不齐全，缺少：${labels}`
    : "物理位置不齐全"
}
