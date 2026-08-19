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

export async function listCageMoveRegisters(opts?: {
  limit?: number
  offset?: number
}): Promise<{ items: CageMoveRegisterRow[]; total: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  const offset = Math.max(opts?.offset ?? 0, 0)
  try {
    const [countRes, dataRes] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM unified_cage_move_register`),
      query<CageMoveRegisterRow>(
        `SELECT id, cage_id, magazine_rfid,
                source_site_code, source_device_ip, source_device_port,
                target_site_code, target_device_ip, target_device_port,
                registrar_name, operator_account_id::text AS operator_account_id,
                remark, status, created_at::text
         FROM unified_cage_move_register
         ORDER BY created_at DESC
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
  try {
    const r = await query<MagazineCurrentLocation>(
      `SELECT DISTINCT ON (magazine_rfid)
              magazine_rfid, target_site_code, target_device_ip, target_device_port
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
