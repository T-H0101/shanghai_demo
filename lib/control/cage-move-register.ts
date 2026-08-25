/**
 * lib/control/cage-move-register.ts
 * Sprint R.98 — 总控盘笼移位登记（不向站点下发执行）
 */

import { query } from "@/lib/db/postgres"
import { writeAudit } from "@/lib/control/audit"

export class CageMoveRegisterError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "CageMoveRegisterError"
    this.status = status
  }
}

export type CageMoveRegisterRow = {
  id: string
  cage_id: string | null
  magazine_rfid: string
  source_site_code: string
  source_device_ip: string
  source_device_port: string | null
  target_site_code: string
  target_device_ip: string
  target_device_port: string | null
  registrar_name: string
  operator_account_id: string
  remark: string | null
  status: string
  created_at: string
}

/** 列表展示用：站点名称/设备名称 + 站点 IP/设备 IP */
export type CageMoveRegisterListItem = CageMoveRegisterRow & {
  source_site_name: string
  source_site_ip: string | null
  source_device_name: string
  target_site_name: string
  target_site_ip: string | null
  target_device_name: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LIST_SELECT = `SELECT r.id, r.cage_id, r.magazine_rfid,
       r.source_site_code, r.source_device_ip, r.source_device_port,
       r.target_site_code, r.target_device_ip, r.target_device_port,
       r.registrar_name, r.operator_account_id::text AS operator_account_id,
       r.remark, r.status, r.created_at::text,
       COALESCE(NULLIF(TRIM(ss.site_name), ''), r.source_site_code) AS source_site_name,
       NULLIF(TRIM(ss.db_host), '') AS source_site_ip,
       COALESCE(NULLIF(TRIM(sd.device_name), ''), r.source_device_ip) AS source_device_name,
       COALESCE(NULLIF(TRIM(ts.site_name), ''), r.target_site_code) AS target_site_name,
       NULLIF(TRIM(ts.db_host), '') AS target_site_ip,
       COALESCE(NULLIF(TRIM(td.device_name), ''), r.target_device_ip) AS target_device_name
FROM unified_cage_move_register r
LEFT JOIN sync_sites ss ON ss.site_code = r.source_site_code
LEFT JOIN sync_sites ts ON ts.site_code = r.target_site_code
LEFT JOIN LATERAL (
  SELECT d.device_name
  FROM unified_devices d
  WHERE d.source_site_id = r.source_site_code
    AND (
      NULLIF(TRIM(d.ip_address), '') = r.source_device_ip
      OR COALESCE(d.raw_data->>'ip', d.raw_data->>'IP', d.raw_data->>'ip_address') = r.source_device_ip
    )
  ORDER BY d.synced_at DESC NULLS LAST
  LIMIT 1
) sd ON TRUE
LEFT JOIN LATERAL (
  SELECT d.device_name
  FROM unified_devices d
  WHERE d.source_site_id = r.target_site_code
    AND (
      NULLIF(TRIM(d.ip_address), '') = r.target_device_ip
      OR COALESCE(d.raw_data->>'ip', d.raw_data->>'IP', d.raw_data->>'ip_address') = r.target_device_ip
    )
  ORDER BY d.synced_at DESC NULLS LAST
  LIMIT 1
) td ON TRUE`

export type CageMoveRegisterInput = {
  cageId?: string | null
  magazineRfid: string
  sourceSiteCode: string
  sourceDeviceIp: string
  sourceDevicePort?: string | null
  targetSiteCode: string
  targetDeviceIp: string
  targetDevicePort?: string | null
  registrarName: string
  remark?: string | null
  operatorAccountId: string
  actor?: string
  actorIp?: string
}

export type MagazineCurrentLocation = {
  magazine_rfid: string
  target_site_code: string
  target_device_ip: string
  target_device_port: string | null
}

/** 详情盘位映射用：含原站/原设备，便于按 RFID 回查历史盘位 */
export type MagazineRelocation = MagazineCurrentLocation & {
  source_site_code: string
  source_device_ip: string
  source_device_port: string | null
}

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = String(value).trim()
  return t ? t : null
}

function requireText(value: string | null | undefined, label: string): string {
  const t = trimOrNull(value)
  if (!t) throw new CageMoveRegisterError(`${label}不能为空`)
  return t
}

export async function createCageMoveRegister(
  input: CageMoveRegisterInput
): Promise<CageMoveRegisterRow> {
  const magazineRfid = requireText(input.magazineRfid, "盘笼 RFID")
  const sourceSiteCode = requireText(input.sourceSiteCode, "原站点")
  const targetSiteCode = requireText(input.targetSiteCode, "目标站点")
  const sourceDeviceIp = requireText(input.sourceDeviceIp, "原设备 IP")
  const targetDeviceIp = requireText(input.targetDeviceIp, "目标设备 IP")
  const registrarName = requireText(input.registrarName, "登记人")
  const operatorAccountId = requireText(input.operatorAccountId, "操作人")

  if (sourceSiteCode === targetSiteCode) {
    throw new CageMoveRegisterError("原站点与目标站点不能相同")
  }
  if (sourceDeviceIp === targetDeviceIp) {
    throw new CageMoveRegisterError("原设备 IP 与目标设备 IP 不能相同")
  }

  const ins = await query<CageMoveRegisterRow>(
    `INSERT INTO unified_cage_move_register (
       cage_id, magazine_rfid,
       source_site_code, source_device_ip, source_device_port,
       target_site_code, target_device_ip, target_device_port,
       registrar_name, operator_account_id, remark, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'registered')
     RETURNING id, cage_id, magazine_rfid,
               source_site_code, source_device_ip, source_device_port,
               target_site_code, target_device_ip, target_device_port,
               registrar_name, operator_account_id::text AS operator_account_id,
               remark, status, created_at::text`,
    [
      trimOrNull(input.cageId),
      magazineRfid,
      sourceSiteCode,
      sourceDeviceIp,
      trimOrNull(input.sourceDevicePort),
      targetSiteCode,
      targetDeviceIp,
      trimOrNull(input.targetDevicePort),
      registrarName,
      operatorAccountId,
      trimOrNull(input.remark),
    ]
  )
  const row = ins.rows[0]
  if (!row) throw new CageMoveRegisterError("登记写入失败", 500)

  await writeAudit({
    action: "cage_move_registered",
    targetTable: "unified_cage_move_register",
    targetId: row.id,
    after: {
      magazineRfid,
      sourceSiteCode,
      targetSiteCode,
      sourceDeviceIp,
      targetDeviceIp,
      status: "registered",
    },
    actor: input.actor ?? operatorAccountId,
    actorIp: input.actorIp,
    siteCode: sourceSiteCode,
    result: "success",
  })

  return row
}

export async function cancelCageMoveRegister(input: {
  id: string
  operatorAccountId: string
  actor?: string
  actorIp?: string
}): Promise<CageMoveRegisterRow> {
  const id = requireText(input.id, "登记 ID")
  if (!UUID_RE.test(id)) throw new CageMoveRegisterError("登记 ID 无效")
  const operatorAccountId = requireText(input.operatorAccountId, "操作人")

  const found = await query<CageMoveRegisterRow>(
    `SELECT id, cage_id, magazine_rfid,
            source_site_code, source_device_ip, source_device_port,
            target_site_code, target_device_ip, target_device_port,
            registrar_name, operator_account_id::text AS operator_account_id,
            remark, status, created_at::text
     FROM unified_cage_move_register
     WHERE id = $1::uuid
     LIMIT 1`,
    [id]
  )
  const row = found.rows[0]
  if (!row) throw new CageMoveRegisterError("登记不存在", 404)
  if (row.status !== "registered") {
    throw new CageMoveRegisterError("该登记已不在映射中", 409)
  }

  const upd = await query<CageMoveRegisterRow>(
    `UPDATE unified_cage_move_register
     SET status = 'cancelled'
     WHERE id = $1::uuid AND status = 'registered'
     RETURNING id, cage_id, magazine_rfid,
               source_site_code, source_device_ip, source_device_port,
               target_site_code, target_device_ip, target_device_port,
               registrar_name, operator_account_id::text AS operator_account_id,
               remark, status, created_at::text`,
    [id]
  )
  const cancelled = upd.rows[0]
  if (!cancelled) throw new CageMoveRegisterError("该登记已不在映射中", 409)

  await writeAudit({
    action: "cage_move_cancelled",
    targetTable: "unified_cage_move_register",
    targetId: cancelled.id,
    before: {
      magazineRfid: row.magazine_rfid,
      sourceSiteCode: row.source_site_code,
      targetSiteCode: row.target_site_code,
      sourceDeviceIp: row.source_device_ip,
      targetDeviceIp: row.target_device_ip,
      status: row.status,
    },
    after: {
      magazineRfid: cancelled.magazine_rfid,
      status: "cancelled",
    },
    actor: input.actor ?? operatorAccountId,
    actorIp: input.actorIp,
    siteCode: row.source_site_code,
    result: "success",
  })

  return cancelled
}

export async function listCageMoveRegisters(opts?: {
  limit?: number
  offset?: number
}): Promise<{ items: CageMoveRegisterListItem[]; total: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  const offset = Math.max(opts?.offset ?? 0, 0)
  try {
    const [countRes, dataRes] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM unified_cage_move_register
         WHERE status = 'registered'`
      ),
      query<CageMoveRegisterListItem>(
        `${LIST_SELECT}
         WHERE r.status = 'registered'
         ORDER BY r.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ])
    return {
      items: dataRes.rows,
      total: Number.parseInt(countRes.rows[0]?.count ?? "0", 10),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/unified_cage_move_register/i.test(msg) && /does not exist|42P01/i.test(msg)) {
      return { items: [], total: 0 }
    }
    throw e
  }
}

export async function listCurrentMagazineLocations(): Promise<MagazineCurrentLocation[]> {
  const rows = await listCurrentMagazineRelocations()
  return rows.map((row) => ({
    magazine_rfid: row.magazine_rfid,
    target_site_code: row.target_site_code,
    target_device_ip: row.target_device_ip,
    target_device_port: row.target_device_port,
  }))
}

export async function listCurrentMagazineRelocations(): Promise<MagazineRelocation[]> {
  try {
    const r = await query<MagazineRelocation>(
      `SELECT DISTINCT ON (magazine_rfid)
              magazine_rfid,
              source_site_code, source_device_ip, source_device_port,
              target_site_code, target_device_ip, target_device_port
       FROM unified_cage_move_register
       WHERE status = 'registered'
       ORDER BY magazine_rfid, created_at DESC`
    )
    return r.rows
  } catch {
    return []
  }
}

export async function loadSiteRfidRelocationFilter(siteCodes: string[]): Promise<{
  inboundRfids: string[]
  outboundRfids: string[]
}> {
  if (!siteCodes.length) return { inboundRfids: [], outboundRfids: [] }
  const selected = new Set(siteCodes)
  const locations = await listCurrentMagazineLocations()
  const inboundRfids: string[] = []
  const outboundRfids: string[] = []
  for (const loc of locations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    if (selected.has(loc.target_site_code)) inboundRfids.push(rfid)
    else outboundRfids.push(rfid)
  }
  return { inboundRfids, outboundRfids }
}
