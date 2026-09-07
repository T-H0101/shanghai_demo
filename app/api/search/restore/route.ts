/**
 * POST /api/search/restore
 * 从检索结果按物理位置发起待回迁登记（调站点 /unified-restore-file 仅 INSERT）
 *
 * - 迁入区域（relocated / fanout）：对该区域全部可访问站点并行扇出
 * - 未迁入：打归档单站；站点按 RFID 认领在线设备
 * 口径：只宣称「待回迁记录已提交」，不宣称回迁执行成功。
 */

import { NextRequest, NextResponse } from "next/server"
import {
  requireSession,
  requirePermission,
  requireSiteAccess,
  getVisibleSites,
} from "@/lib/auth/middleware"
import { dispatchSiteRestoreFile } from "@/lib/control/dispatch-site-restore-file"

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "control:submit")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const targetSiteCode =
    typeof body.targetSiteCode === "string"
      ? body.targetSiteCode
      : typeof body.siteCode === "string"
        ? body.siteCode
        : ""

  const regionCode =
    typeof body.regionCode === "string"
      ? body.regionCode
      : typeof body.region_code === "string"
        ? body.region_code
        : typeof body.logicalRegionCode === "string"
          ? body.logicalRegionCode
          : ""

  const relocated =
    body.relocated === true ||
    body.fanoutByRegion === true ||
    body.fanout === true

  const fanoutByRegion = Boolean(relocated || (regionCode && !targetSiteCode))

  if (!fanoutByRegion && targetSiteCode) {
    try {
      requireSiteAccess(session, targetSiteCode)
    } catch (e) {
      if (e instanceof NextResponse) return e
    }
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"

  const slotOrderRaw = body.slotOrder ?? body.slot_order
  const slotOrder =
    typeof slotOrderRaw === "number"
      ? slotOrderRaw
      : typeof slotOrderRaw === "string" && slotOrderRaw.trim() !== ""
        ? Number(slotOrderRaw)
        : null

  const accessibleSites = getVisibleSites(session)

  const result = await dispatchSiteRestoreFile({
    targetSiteCode: fanoutByRegion ? null : targetSiteCode,
    regionCode: fanoutByRegion ? regionCode : null,
    fanoutByRegion,
    accessibleSites,
    physical: {
      deviceIp:
        (body.deviceIp as string | undefined) ??
        (body.device_ip as string | undefined) ??
        null,
      devicePort:
        (body.devicePort as string | undefined) ??
        (body.device_port as string | undefined) ??
        null,
      magazineRfid:
        (body.magazineRfid as string | undefined) ??
        (body.magazine_rfid as string | undefined) ??
        null,
      slotOrder: Number.isFinite(slotOrder as number) ? (slotOrder as number) : null,
      discSide: (() => {
        const raw = body.discSide ?? body.disc_side
        if (typeof raw === "number" && Number.isFinite(raw)) return raw
        if (typeof raw === "string" && raw.trim() !== "") {
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        }
        return null
      })(),
      filePath:
        (body.filePath as string | undefined) ??
        (body.file_path as string | undefined) ??
        null,
      folderPath:
        (body.folderPath as string | undefined) ??
        (body.folder_path as string | undefined) ??
        null,
      fileName:
        (body.fileName as string | undefined) ??
        (body.file_name as string | undefined) ??
        null,
      fileHash:
        (body.fileHash as string | undefined) ??
        (body.file_hash as string | undefined) ??
        (body.checksum as string | undefined) ??
        null,
      fileSize: (() => {
        const raw = body.fileSize ?? body.file_size ?? body.size
        if (typeof raw === "number" && Number.isFinite(raw)) return raw
        if (typeof raw === "string" && raw.trim() !== "") {
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        }
        return null
      })(),
      docType: (body.docType as string | undefined) ?? "file",
    },
    requestedBy:
      session && typeof session.username === "string" ? session.username : null,
    requestedIp: ip,
    requestId:
      typeof body.requestId === "string"
        ? body.requestId
        : typeof body.request_id === "string"
          ? body.request_id
          : null,
  })

  const status = result.ok ? 200 : result.httpStatus >= 400 ? result.httpStatus : 502
  return NextResponse.json(
    {
      code: result.ok ? 0 : -1,
      message: result.message,
      data: {
        accepted: result.ok,
        restoreFileId: result.restoreFileId,
        targetSiteCode: result.winnerSiteCode,
        winnerSiteCode: result.winnerSiteCode,
        winnerSiteName: result.winnerSiteName,
        winnerDeviceLabel: result.winnerDeviceLabel,
        mode: result.mode,
        attempts: result.attempts.map((a) => ({
          siteCode: a.siteCode,
          siteName: a.siteName,
          ok: a.ok,
          message: a.message,
          reasonCode: a.reasonCode,
          libIp: a.libIp,
          libPort: a.libPort,
          deviceName: a.deviceName,
        })),
        url: result.url,
        missing: result.missing,
        payload: result.payload,
        siteReasonCode: result.site?.reasonCode ?? null,
        /** 明确：本接口只完成站点待回迁表写入，不表示物理回迁已执行 */
        execution: "register_only",
      },
    },
    { status },
  )
}
