/**
 * 跨站回迁：按物理位置组包与校验（不依赖 slot_id 主键）
 *
 * 必填物理位置：
 *   device_ip / device_port / magazine_rfid / slot_order / disc_side / file_path / file_hash
 * 可选：size（文件大小，写入站点 tbl_restore_file.size，不强制）
 */

export type PhysicalRestorePayload = {
  device_ip: string
  device_port: string
  magazine_rfid: string
  slot_order: number
  /** 光盘 AB 面：0=A，1=B */
  disc_side: number
  file_path: string
  file_hash: string
  /** 文件字节数；缺省不传，站点可写 null */
  size?: number | null
  file_name?: string
  request_id?: string
  site_code?: string
  requested_by?: string | null
  source?: string
}

export type PhysicalRestoreInput = {
  deviceIp?: string | null
  devicePort?: string | null
  magazineRfid?: string | null
  slotOrder?: number | null
  discSide?: number | null
  filePath?: string | null
  folderPath?: string | null
  fileName?: string | null
  fileHash?: string | null
  fileSize?: number | null
  docType?: string | null
}

export type PhysicalRestoreValidation =
  | { ok: true; payload: PhysicalRestorePayload; missing: [] }
  | { ok: false; payload: null; missing: string[] }

function trimOrEmpty(v: string | null | undefined): string {
  return typeof v === "string" ? v.trim() : ""
}

/** 去掉尾部 /，但保留根目录 "/"（不可剥成空串） */
function stripTrailingSlashesPreserveRoot(p: string): string {
  const raw = p.replace(/\\/g, "/")
  if (!raw || raw === "—" || raw === "-") return ""
  if (raw === "/") return "/"
  return raw.replace(/\/+$/, "")
}

/** 目录路径 + 文件名 → 站点约定的文件全路径（根目录文件为 /文件名） */
export function buildRestoreFileFullPath(
  folderPath: string | null | undefined,
  fileName: string | null | undefined,
  filePath?: string | null | undefined,
): string {
  const name = trimOrEmpty(fileName)
  const folder = stripTrailingSlashesPreserveRoot(trimOrEmpty(folderPath))
  if (folder && name) {
    if (folder === "/") return `/${name}`
    if (folder.endsWith(`/${name}`) || folder === name) return folder
    return `${folder}/${name}`
  }
  const pathOnly = stripTrailingSlashesPreserveRoot(trimOrEmpty(filePath))
  if (pathOnly === "/" && name) return `/${name}`
  if (pathOnly && name && pathOnly !== name && !pathOnly.endsWith(`/${name}`)) {
    return `${pathOnly}/${name}`
  }
  if (pathOnly) return pathOnly
  return name
}

function normalizeOptionalSize(v: number | null | undefined): number | null {
  if (v == null) return null
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null
  return Math.trunc(v)
}

export function validatePhysicalRestoreInput(
  input: PhysicalRestoreInput,
): PhysicalRestoreValidation {
  const missing: string[] = []
  const docType = trimOrEmpty(input.docType) || "file"
  if (docType === "folder") {
    return {
      ok: false,
      payload: null,
      missing: ["docType(folder_not_supported)"],
    }
  }

  const device_ip = trimOrEmpty(input.deviceIp)
  const device_port = trimOrEmpty(input.devicePort)
  const magazine_rfid = trimOrEmpty(input.magazineRfid)
  const file_hash = trimOrEmpty(input.fileHash)
  const file_name = trimOrEmpty(input.fileName) || undefined
  const folderRaw = trimOrEmpty(input.folderPath)
  const pathRaw = trimOrEmpty(input.filePath)
  // 索引/展示为空或占位符时，不臆造根路径 "/"
  const hasParentPath =
    (folderRaw && folderRaw !== "—" && folderRaw !== "-") ||
    (pathRaw && pathRaw !== "—" && pathRaw !== "-")
  const file_path = hasParentPath
    ? buildRestoreFileFullPath(input.folderPath, input.fileName, input.filePath)
    : ""
  const size = normalizeOptionalSize(input.fileSize)

  const slotRaw = input.slotOrder
  const slot_order =
    typeof slotRaw === "number" && Number.isFinite(slotRaw)
      ? Math.trunc(slotRaw)
      : null

  const discRaw = input.discSide
  // 0=A / 1=B 均为有效值；缺字段才算缺失
  const disc_side =
    typeof discRaw === "number" && Number.isFinite(discRaw)
      ? Math.trunc(discRaw)
      : null

  if (!device_ip) missing.push("device_ip")
  if (!device_port) missing.push("device_port")
  if (!magazine_rfid) missing.push("magazine_rfid")
  if (slot_order == null || slot_order < 0) missing.push("slot_order")
  if (disc_side == null || disc_side < 0) missing.push("disc_side")
  if (!file_path || file_path === "—" || file_path === "-") missing.push("file_path")
  if (!file_hash) missing.push("file_hash")

  if (missing.length) {
    return { ok: false, payload: null, missing }
  }

  return {
    ok: true,
    missing: [],
    payload: {
      device_ip,
      device_port,
      magazine_rfid,
      slot_order: slot_order as number,
      disc_side: disc_side as number,
      file_path,
      file_hash,
      ...(size != null ? { size } : {}),
      ...(file_name ? { file_name } : {}),
    },
  }
}
