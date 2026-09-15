/**
 * lib/control/cage-move-register.ts
 * Sprint R.104/R.106 — 总控盘笼移位登记（目标=站点区域；支持再迁）
 *
 * 权限：有盘笼移位页权限即可操作全站，不做站级裁剪。
 * 首次：原站+设备必填；再迁：原位置仅区域，站/设备可空。
 * 撤销：同一 RFID 仅最新一条 registered 可撤。
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
  source_region_code: string
  source_site_code: string | null
  source_device_ip: string | null
  source_device_port: string | null
  target_region_code: string
  target_site_code: string | null
  target_device_ip: string | null
  target_device_port: string | null
  registrar_name: string
  operator_account_id: string
  remark: string | null
  status: string
  created_at: string
}

/** 列表展示用：区域/站点名称 + 设备名称 */
export type CageMoveRegisterListItem = CageMoveRegisterRow & {
  source_region_name: string
  source_site_name: string | null
  source_site_ip: string | null
  source_device_name: string | null
  target_region_name: string
  target_site_name: string | null
  target_site_ip: string | null
  target_device_name: string | null
  /** 该 RFID 当前最新一条 registered（仅此条可撤销） */
  is_latest_registered: boolean
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LIST_SELECT = `SELECT r.id, r.cage_id, r.magazine_rfid,
       r.source_region_code, r.source_site_code, r.source_device_ip, r.source_device_port,
       r.target_region_code, r.target_site_code, r.target_device_ip, r.target_device_port,
       r.registrar_name, r.operator_account_id::text AS operator_account_id,
       r.remark, r.status, r.created_at::text,
       COALESCE(NULLIF(TRIM(sr_reg.name), ''), r.source_region_code) AS source_region_name,
       COALESCE(NULLIF(TRIM(tr_reg.name), ''), r.target_region_code) AS target_region_name,
       NULLIF(TRIM(ss.site_name), '') AS source_site_name,
       NULLIF(TRIM(ss.db_host), '') AS source_site_ip,
       COALESCE(NULLIF(TRIM(sd.device_name), ''), NULLIF(TRIM(r.source_device_ip), '')) AS source_device_name,
       NULLIF(TRIM(ts.site_name), '') AS target_site_name,
       NULLIF(TRIM(ts.db_host), '') AS target_site_ip,
       NULLIF(TRIM(td.device_name), '') AS target_device_name,
       (
         r.status = 'registered'
         AND r.id = (
           SELECT r2.id
           FROM unified_cage_move_register r2
           WHERE r2.magazine_rfid = r.magazine_rfid
             AND r2.status = 'registered'
           ORDER BY r2.created_at DESC
           LIMIT 1
         )
       ) AS is_latest_registered
FROM unified_cage_move_register r
LEFT JOIN site_regions sr_reg ON sr_reg.code = r.source_region_code
LEFT JOIN site_regions tr_reg ON tr_reg.code = r.target_region_code
LEFT JOIN sync_sites ss ON ss.site_code = r.source_site_code
LEFT JOIN sync_sites ts ON ts.site_code = r.target_site_code
LEFT JOIN LATERAL (
  SELECT d.device_name
  FROM unified_devices d
  WHERE r.source_site_code IS NOT NULL
    AND d.source_site_id = r.source_site_code
    AND r.source_device_ip IS NOT NULL
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
  WHERE r.target_site_code IS NOT NULL
    AND d.source_site_id = r.target_site_code
    AND r.target_device_ip IS NOT NULL
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
  /** 原区域（必填） */
  sourceRegionCode: string
  /** 首次迁移必填；再迁可空 */
  sourceSiteCode?: string | null
  sourceDeviceIp?: string | null
  sourceDevicePort?: string | null
  /** true=再迁（迁入本区域后的再次登记） */
  relocated?: boolean
  targetRegionCode: string
  registrarName: string
  remark?: string | null
  operatorAccountId: string
  actor?: string
  actorIp?: string
}

export type MagazineCurrentLocation = {
  magazine_rfid: string
  source_region_code: string
  target_region_code: string
  target_site_code: string | null
  target_device_ip: string | null
  target_device_port: string | null
}

/** 详情盘位映射用；区域再迁时 source 站/设备可空 */
export type MagazineRelocation = MagazineCurrentLocation & {
  source_site_code: string | null
  source_device_ip: string | null
  source_device_port: string | null
}

/** 登记弹窗：按区域列出可登记盘笼 */
export type RegionCageCandidate = {
  rfid: string
  label: string
  magazineId: string | null
  /** true=当前逻辑位置为迁入本区域 */
  relocated: boolean
  siteCode: string | null
  siteName: string | null
  deviceId: string | null
  deviceName: string | null
  deviceIp: string | null
  devicePort: string | null
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

function formatCageLabel(rfid: string, position: string | null): string {
  const n = position != null && position !== "" ? Number(position) : NaN
  if (Number.isFinite(n)) return `${rfid}·盘笼${n + 1}`
  return rfid
}

async function assertRegionActive(regionCode: string, label: string): Promise<void> {
  const r = await query<{ status: string }>(
    `SELECT status FROM site_regions WHERE code = $1 LIMIT 1`,
    [regionCode],
  )
  const row = r.rows[0]
  if (!row) throw new CageMoveRegisterError(`${label}不存在`)
  if (row.status !== "active") {
    throw new CageMoveRegisterError(`${label}未启用`)
  }
}

export async function createCageMoveRegister(
  input: CageMoveRegisterInput,
): Promise<CageMoveRegisterRow> {
  const magazineRfid = requireText(input.magazineRfid, "盘笼 RFID")
  const sourceRegionCode = requireText(input.sourceRegionCode, "原区域").toUpperCase()
  const targetRegionCode = requireText(input.targetRegionCode, "目标站点区域").toUpperCase()
  const registrarName = requireText(input.registrarName, "登记人")
  const operatorAccountId = requireText(input.operatorAccountId, "操作人")
  const relocated = Boolean(input.relocated)

  const sourceSiteCode = trimOrNull(input.sourceSiteCode)
  const sourceDeviceIp = trimOrNull(input.sourceDeviceIp)
  const sourceDevicePort = trimOrNull(input.sourceDevicePort)

  if (sourceRegionCode === targetRegionCode) {
    throw new CageMoveRegisterError("源区域与目标区域不能相同")
  }
  await assertRegionActive(sourceRegionCode, "原区域")
  await assertRegionActive(targetRegionCode, "目标站点区域")

  if (relocated) {
    // 再迁：校验 RFID 当前逻辑位置为本区域
    const current = await listCurrentMagazineRelocations()
    const loc = current.find((r) => r.magazine_rfid.trim() === magazineRfid)
    if (!loc || loc.target_region_code !== sourceRegionCode) {
      throw new CageMoveRegisterError(
        "该盘笼当前不是迁入本区域状态，请刷新后重选",
      )
    }
  } else {
    if (!sourceSiteCode) throw new CageMoveRegisterError("原站点不能为空")
    if (!sourceDeviceIp) throw new CageMoveRegisterError("原设备 IP 不能为空")
    const siteRegion = await query<{ region_code: string | null }>(
      `SELECT region_code FROM sync_sites WHERE site_code = $1 LIMIT 1`,
      [sourceSiteCode],
    )
    const region = siteRegion.rows[0]?.region_code?.trim()?.toUpperCase()
    if (!region) {
      throw new CageMoveRegisterError(
        "源站点未挂靠站点区域，请先在站点管理中维护所属区域",
      )
    }
    if (region !== sourceRegionCode) {
      throw new CageMoveRegisterError("原站点不属于所选原区域")
    }
    // 未迁笼不得已是迁出态
    const current = await listCurrentMagazineRelocations()
    const loc = current.find((r) => r.magazine_rfid.trim() === magazineRfid)
    if (loc) {
      throw new CageMoveRegisterError(
        "该盘笼已有有效移位登记，请按迁入区域选择（标记「迁移」）后再登记",
      )
    }
  }

  const ins = await query<CageMoveRegisterRow>(
    `INSERT INTO unified_cage_move_register (
       cage_id, magazine_rfid,
       source_region_code,
       source_site_code, source_device_ip, source_device_port,
       target_region_code, target_site_code, target_device_ip, target_device_port,
       registrar_name, operator_account_id, remark, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,NULL,$8,$9,$10,'registered')
     RETURNING id, cage_id, magazine_rfid,
               source_region_code,
               source_site_code, source_device_ip, source_device_port,
               target_region_code, target_site_code, target_device_ip, target_device_port,
               registrar_name, operator_account_id::text AS operator_account_id,
               remark, status, created_at::text`,
    [
      trimOrNull(input.cageId),
      magazineRfid,
      sourceRegionCode,
      relocated ? null : sourceSiteCode,
      relocated ? null : sourceDeviceIp,
      relocated ? null : sourceDevicePort,
      targetRegionCode,
      registrarName,
      operatorAccountId,
      trimOrNull(input.remark),
    ],
  )
  const row = ins.rows[0]
  if (!row) throw new CageMoveRegisterError("登记写入失败", 500)

  await writeAudit({
    action: "cage_move_registered",
    targetTable: "unified_cage_move_register",
    targetId: row.id,
    after: {
      magazineRfid,
      sourceRegionCode,
      targetRegionCode,
      sourceSiteCode: row.source_site_code,
      sourceDeviceIp: row.source_device_ip,
      relocated,
      status: "registered",
    },
    actor: input.actor ?? operatorAccountId,
    actorIp: input.actorIp,
    siteCode: row.source_site_code ?? undefined,
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
            source_region_code,
            source_site_code, source_device_ip, source_device_port,
            target_region_code, target_site_code, target_device_ip, target_device_port,
            registrar_name, operator_account_id::text AS operator_account_id,
            remark, status, created_at::text
     FROM unified_cage_move_register
     WHERE id = $1::uuid
     LIMIT 1`,
    [id],
  )
  const row = found.rows[0]
  if (!row) throw new CageMoveRegisterError("登记不存在", 404)
  if (row.status !== "registered") {
    throw new CageMoveRegisterError("该登记已不在映射中", 409)
  }

  const latest = await query<{ id: string }>(
    `SELECT id::text AS id
     FROM unified_cage_move_register
     WHERE magazine_rfid = $1 AND status = 'registered'
     ORDER BY created_at DESC
     LIMIT 1`,
    [row.magazine_rfid],
  )
  if (latest.rows[0]?.id !== row.id) {
    throw new CageMoveRegisterError(
      "仅可撤销该盘笼最近一次移位登记",
      409,
    )
  }

  const upd = await query<CageMoveRegisterRow>(
    `UPDATE unified_cage_move_register
     SET status = 'cancelled'
     WHERE id = $1::uuid AND status = 'registered'
     RETURNING id, cage_id, magazine_rfid,
               source_region_code,
               source_site_code, source_device_ip, source_device_port,
               target_region_code, target_site_code, target_device_ip, target_device_port,
               registrar_name, operator_account_id::text AS operator_account_id,
               remark, status, created_at::text`,
    [id],
  )
  const cancelled = upd.rows[0]
  if (!cancelled) throw new CageMoveRegisterError("该登记已不在映射中", 409)

  await writeAudit({
    action: "cage_move_cancelled",
    targetTable: "unified_cage_move_register",
    targetId: cancelled.id,
    before: {
      magazineRfid: row.magazine_rfid,
      sourceRegionCode: row.source_region_code,
      targetRegionCode: row.target_region_code,
      sourceSiteCode: row.source_site_code,
      status: row.status,
    },
    after: {
      magazineRfid: cancelled.magazine_rfid,
      status: "cancelled",
    },
    actor: input.actor ?? operatorAccountId,
    actorIp: input.actorIp,
    siteCode: row.source_site_code ?? undefined,
    result: "success",
  })

  return cancelled
}

export async function listCageMoveRegisters(opts?: {
  limit?: number
  offset?: number
  /** 按已登记过的 RFID 过滤（含历史 cancelled） */
  magazineRfid?: string | null
}): Promise<{ items: CageMoveRegisterListItem[]; total: number }> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
  const offset = Math.max(opts?.offset ?? 0, 0)
  const rfid = trimOrNull(opts?.magazineRfid)

  // 有 RFID 筛选：展示该笼完整迁移链（registered + cancelled）
  // 无筛选：展示全部 registered（含非最新，撤销按钮由 is_latest 控制）
  const whereSql = rfid
    ? `r.magazine_rfid = $1`
    : `r.status = 'registered'`
  const countParams: unknown[] = rfid ? [rfid] : []
  const dataParams: unknown[] = rfid ? [rfid, limit, offset] : [limit, offset]
  const limitIdx = rfid ? 2 : 1
  const offsetIdx = rfid ? 3 : 2

  try {
    const [countRes, dataRes] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM unified_cage_move_register r
         WHERE ${whereSql}`,
        countParams,
      ),
      query<CageMoveRegisterListItem>(
        `${LIST_SELECT}
         WHERE ${whereSql}
         ORDER BY r.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        dataParams,
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

/** 登记记录筛选项：出现过的 RFID */
export async function listRegisteredMagazineRfids(): Promise<string[]> {
  try {
    const r = await query<{ magazine_rfid: string }>(
      `SELECT DISTINCT magazine_rfid
       FROM unified_cage_move_register
       WHERE magazine_rfid IS NOT NULL AND TRIM(magazine_rfid) <> ''
       ORDER BY magazine_rfid`,
    )
    return r.rows.map((row) => row.magazine_rfid.trim()).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 按原区域列出可登记盘笼：
 * - 未迁：区域内各站设备 magazines，且无有效迁出登记
 * - 迁入：最新 registered 的 target_region = 本区域（标记 relocated）
 */
export async function listRegionCageCandidates(
  regionCodeRaw: string,
): Promise<RegionCageCandidate[]> {
  const regionCode = requireText(regionCodeRaw, "原区域").toUpperCase()
  await assertRegionActive(regionCode, "原区域")

  const relocations = await listCurrentMagazineRelocations()
  const sitesInRegion = await query<{ site_code: string }>(
    `SELECT site_code FROM sync_sites WHERE region_code = $1`,
    [regionCode],
  )
  const siteSet = new Set(sitesInRegion.rows.map((s) => s.site_code))
  const outbound = new Set<string>()
  const inbound = new Map<string, MagazineRelocation>()
  for (const loc of relocations) {
    const rfid = loc.magazine_rfid?.trim()
    if (!rfid) continue
    if (loc.target_region_code === regionCode) {
      inbound.set(rfid, loc)
      continue
    }
    if (
      loc.source_region_code === regionCode ||
      (loc.source_site_code != null && siteSet.has(loc.source_site_code))
    ) {
      outbound.add(rfid)
    }
  }

  type MagJoinRow = {
    magazine_id: string | null
    rfid: string
    position: string | null
    site_code: string
    site_name: string | null
    device_id: string | null
    device_name: string | null
    device_ip: string | null
    device_port: string | null
  }

  const magRes = await query<MagJoinRow>(
    `SELECT m.magazine_id::text AS magazine_id,
            TRIM(m.rfid) AS rfid,
            m.position::text AS position,
            m.source_site_id AS site_code,
            NULLIF(TRIM(ss.site_name), '') AS site_name,
            COALESCE(d.device_id::text, m.device_id::text) AS device_id,
            NULLIF(TRIM(d.device_name), '') AS device_name,
            NULLIF(TRIM(COALESCE(d.ip_address, d.raw_data->>'ip', d.raw_data->>'IP')), '') AS device_ip,
            NULLIF(TRIM(COALESCE(d.raw_data->>'port', d.raw_data->>'Port', d.raw_data->>'lib_port')), '') AS device_port
     FROM unified_magazines m
     INNER JOIN sync_sites ss
       ON ss.site_code = m.source_site_id
      AND ss.region_code = $1
     LEFT JOIN unified_devices d
       ON d.source_site_id = m.source_site_id
      AND (
        d.device_id::text = m.device_id::text
        OR d.source_id = m.device_id::text
        OR d.source_record_id = m.device_id::text
        OR COALESCE(d.raw_data->>'lib_id', '') = m.device_id::text
      )
     WHERE m.rfid IS NOT NULL
       AND TRIM(m.rfid) <> ''
     ORDER BY m.rfid, m.magazine_id NULLS LAST`,
    [regionCode],
  )

  const byRfid = new Map<string, RegionCageCandidate>()

  for (const row of magRes.rows) {
    const rfid = row.rfid.trim()
    if (!rfid || outbound.has(rfid) || inbound.has(rfid)) continue
    if (byRfid.has(rfid)) continue
    // 首次迁移需要设备 IP；无 IP 仍列出但提交会被拒
    byRfid.set(rfid, {
      rfid,
      label: formatCageLabel(rfid, row.position),
      magazineId: row.magazine_id,
      relocated: false,
      siteCode: row.site_code,
      siteName: row.site_name,
      deviceId: row.device_id,
      deviceName: row.device_name,
      deviceIp: row.device_ip,
      devicePort: row.device_port,
    })
  }

  for (const [rfid] of inbound) {
    byRfid.set(rfid, {
      rfid,
      label: `${rfid}（迁移）`,
      magazineId: null,
      relocated: true,
      siteCode: null,
      siteName: null,
      deviceId: null,
      deviceName: null,
      deviceIp: null,
      devicePort: null,
    })
  }

  return [...byRfid.values()].sort((a, b) => {
    if (a.relocated !== b.relocated) return a.relocated ? 1 : -1
    return a.rfid.localeCompare(b.rfid)
  })
}

export async function listCurrentMagazineLocations(): Promise<MagazineCurrentLocation[]> {
  const rows = await listCurrentMagazineRelocations()
  return rows.map((row) => ({
    magazine_rfid: row.magazine_rfid,
    source_region_code: row.source_region_code,
    target_region_code: row.target_region_code,
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
              source_region_code,
              source_site_code, source_device_ip, source_device_port,
              target_region_code,
              target_site_code, target_device_ip, target_device_port
       FROM unified_cage_move_register
       WHERE status = 'registered'
       ORDER BY magazine_rfid, created_at DESC`,
    )
    return r.rows
  } catch {
    return []
  }
}

/** @deprecated 站点筛选已废弃；请使用 loadRegionRfidRelocationFilter */
export async function loadSiteRfidRelocationFilter(siteCodes: string[]): Promise<{
  inboundRfids: string[]
  outboundRfids: string[]
}> {
  const locations = await listCurrentMagazineLocations()
  const { relocationFilterFromLocations } = await import("@/lib/search/hit-enrichment")
  return relocationFilterFromLocations(locations, siteCodes)
}

export async function loadRegionRfidRelocationFilter(
  regionCode: string,
  sitesInRegion: string[],
): Promise<{ inboundRfids: string[]; outboundRfids: string[] }> {
  const relocations = await listCurrentMagazineRelocations()
  const { relocationFilterFromRegion } = await import("@/lib/search/hit-enrichment")
  return relocationFilterFromRegion(relocations, regionCode, sitesInRegion)
}
