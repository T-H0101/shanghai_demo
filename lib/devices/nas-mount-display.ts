/**
 * 网盘挂载展示：对齐业务 NetDiskDetail / filterProtocol / filterEncoding
 */

export const MOUNT_PROTOCOL_LABELS: Record<number, string> = {
  1: "NFS",
  2: "CIFS",
  3: "FTP",
  4: "SFTP",
  5: "S3",
  6: "S3不挂载",
}

export const MOUNT_ENCODING_LABELS: Record<number, string> = {
  0: "UTF8",
  1: "GBK",
  2: "UTF16",
  3: "UTF32",
}

export interface NasMountInfo {
  protocol?: number
  protocolLabel?: string
  encoding?: number
  encodingLabel?: string
  /** 传输协议（S3）：http / https，来自 encoding 开关 */
  transportProtocol?: string
  srcPath?: string
  managerPath?: string
  mountPoint?: string
  userName?: string
  /** 脱敏后的密码展示，恒为 **** 或空 */
  passwordMasked?: string
  hasPassword?: boolean
  quotaBytes?: number
  quotaLabel?: string
  permission?: number
  permissionLabel?: string
  maxSpeed?: number
  maxSpeedLabel?: string
  extraParam?: string
  mountedAt?: string
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function formatQuotaBytes(bytes: number | null | undefined): string | undefined {
  if (bytes == null || bytes < 0) return undefined
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  let size = bytes
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * 从 unified_mount_dirs 行（含 raw_data）构建挂载信息；密码不落明文。
 */
export function buildNasMountInfo(row: {
  mount_path?: string | null
  mounted_at?: Date | string | null
  raw_data?: Record<string, unknown> | null
} | null | undefined): NasMountInfo | undefined {
  if (!row) return undefined
  const raw = row.raw_data ?? {}
  const protocol = numberValue(raw.protocol)
  const encoding = numberValue(raw.encoding)
  const permission = numberValue(raw.permission)
  const maxSpeed = numberValue(raw.max_speed)
  const quotaBytes = numberValue(raw.quota_bytes)
  const pwd = stringValue(raw.pwd)
  const mountPoint =
    stringValue(row.mount_path) ?? stringValue(raw.mount_point)
  const mountedAt =
    row.mounted_at == null
      ? stringValue(raw.mount_date)
      : typeof row.mounted_at === "string"
        ? row.mounted_at
        : row.mounted_at.toISOString()

  const info: NasMountInfo = {
    protocol: protocol ?? undefined,
    protocolLabel:
      protocol !== null ? MOUNT_PROTOCOL_LABELS[protocol] ?? String(protocol) : undefined,
    encoding: encoding ?? undefined,
    encodingLabel:
      encoding !== null ? MOUNT_ENCODING_LABELS[encoding] ?? String(encoding) : undefined,
    transportProtocol:
      protocol === 5 ? (encoding ? "https" : "http") : undefined,
    srcPath: stringValue(raw.src_path),
    managerPath: stringValue(raw.manager_path),
    mountPoint,
    userName: stringValue(raw.user_name),
    hasPassword: Boolean(pwd),
    passwordMasked: pwd ? "****" : undefined,
    quotaBytes: quotaBytes ?? undefined,
    quotaLabel: formatQuotaBytes(quotaBytes),
    permission: permission ?? undefined,
    permissionLabel:
      permission === 1 ? "只读" : permission === 0 ? "读写" : undefined,
    maxSpeed: maxSpeed ?? undefined,
    maxSpeedLabel: maxSpeed != null && maxSpeed > 0 ? `${maxSpeed} MB/s` : undefined,
    extraParam: stringValue(raw.extra_param),
    mountedAt: mountedAt ?? undefined,
  }

  // 全空则视为无挂载信息
  const hasAny = Object.entries(info).some(([, v]) => v !== undefined && v !== null && v !== "")
  return hasAny ? info : undefined
}
