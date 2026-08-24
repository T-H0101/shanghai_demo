/**
 * 总控直调站点业务 HTTP：写入 tbl_restore_file（仅落库，不执行回迁）
 *
 * 部署前提与任务控制一致：sync_sites.db_host:db_port → MultimediumNw
 */

import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { writeAudit } from "@/lib/control/audit"
import { isProbeableEndpoint } from "@/lib/site/probe-tcp"
import {
  validatePhysicalRestoreInput,
  type PhysicalRestoreInput,
  type PhysicalRestorePayload,
} from "@/lib/search/restore-physical"
import {
  callSiteRestoreFile,
  resolveSiteRestoreFileSecret,
  siteRestoreFilePath,
  type SiteRestoreFileResult,
} from "@/lib/control/site-restore-file-client"

interface SyncSiteRow {
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
}

export type DispatchSiteRestoreFileInput = {
  /** 当前物理所在站（移位覆盖后的 displaySiteCode） */
  targetSiteCode: string
  physical: PhysicalRestoreInput
  requestedBy?: string | null
  requestedIp?: string | null
  requestId?: string | null
}

export type DispatchSiteRestoreFileResult = {
  ok: boolean
  httpStatus: number
  message: string
  url: string | null
  missing: string[]
  payload: PhysicalRestorePayload | null
  site: SiteRestoreFileResult | null
  restoreFileId: string | number | null
}

export async function dispatchSiteRestoreFile(
  input: DispatchSiteRestoreFileInput,
): Promise<DispatchSiteRestoreFileResult> {
  const validated = validatePhysicalRestoreInput(input.physical)
  if (!validated.ok) {
    return {
      ok: false,
      httpStatus: 400,
      message: `物理位置不齐全，缺少: ${validated.missing.join(", ")}`,
      url: null,
      missing: validated.missing,
      payload: null,
      site: null,
      restoreFileId: null,
    }
  }

  const siteCode = input.targetSiteCode.trim().toUpperCase()
  if (!siteCode) {
    return {
      ok: false,
      httpStatus: 400,
      message: "缺少目标站点",
      url: null,
      missing: ["target_site_code"],
      payload: validated.payload,
      site: null,
      restoreFileId: null,
    }
  }

  const secret = resolveSiteRestoreFileSecret()
  if (!secret || secret.length < 16) {
    return {
      ok: false,
      httpStatus: 503,
      message:
        "未配置 SITE_SSO_SECRET / SITE_SYNC_TRIGGER_SECRET，无法调用站点待回迁接口",
      url: null,
      missing: [],
      payload: validated.payload,
      site: null,
      restoreFileId: null,
    }
  }

  const siteRes = await query<SyncSiteRow>(
    `SELECT site_code, site_name, db_host, db_port, enabled
     FROM sync_sites
     WHERE site_code = $1
     LIMIT 1`,
    [siteCode],
  )
  const site = siteRes.rows[0]
  if (!site) {
    return {
      ok: false,
      httpStatus: 404,
      message: `站点未注册: ${siteCode}`,
      url: null,
      missing: [],
      payload: validated.payload,
      site: null,
      restoreFileId: null,
    }
  }
  if (!site.enabled) {
    return {
      ok: false,
      httpStatus: 403,
      message: `站点已在总控禁用: ${siteCode}`,
      url: null,
      missing: [],
      payload: validated.payload,
      site: null,
      restoreFileId: null,
    }
  }
  if (!isProbeableEndpoint(site.db_host, site.db_port)) {
    return {
      ok: false,
      httpStatus: 422,
      message: `站点未登记真实业务地址（db_host:db_port）: ${siteCode}`,
      url: null,
      missing: [],
      payload: validated.payload,
      site: null,
      restoreFileId: null,
    }
  }

  const envOverride =
    process.env[`SITE_RESTORE_FILE_BASE_URL_${siteCode}`]?.trim() ||
    process.env.SITE_RESTORE_FILE_BASE_URL?.trim() ||
    process.env[`SITE_TASK_CONTROL_BASE_URL_${siteCode}`]?.trim() ||
    process.env.SITE_TASK_CONTROL_BASE_URL?.trim() ||
    ""
  const baseUrl = envOverride
    ? envOverride.replace(/\/+$/, "")
    : `http://${site.db_host.trim()}:${site.db_port}`
  const url = `${baseUrl}${siteRestoreFilePath()}`

  const requestId = (input.requestId?.trim() || randomUUID()).slice(0, 64)
  const payload: PhysicalRestorePayload = {
    ...validated.payload,
    request_id: requestId,
    site_code: siteCode,
    requested_by: input.requestedBy ?? null,
    source: "central-control",
  }

  const siteResult = await callSiteRestoreFile({
    baseUrl,
    secret,
    payload,
    siteCode,
  })

  await writeAudit({
    commandNo: `RESTORE-FILE-${requestId}`,
    action: "restore_file_register",
    targetTable: "tbl_restore_file",
    targetId: String(siteResult.restoreFileId ?? requestId).slice(0, 64),
    before: null,
    after: {
      url,
      payload,
      siteHttpStatus: siteResult.httpStatus,
      siteCode: siteResult.code,
      reasonCode: siteResult.reasonCode,
      restoreFileId: siteResult.restoreFileId,
    },
    actor: input.requestedBy ?? null,
    actorIp: input.requestedIp ?? null,
    siteCode,
    dryRun: false,
    result: siteResult.ok ? "success" : "failed",
    errorMessage: siteResult.ok
      ? null
      : siteResult.message || siteResult.reasonCode || "站点待回迁写入失败",
  })

  return {
    ok: siteResult.ok,
    httpStatus: siteResult.httpStatus || (siteResult.ok ? 200 : 502),
    message: siteResult.ok
      ? "回迁记录已提交到站点待回迁表，等待站点处理"
      : siteResult.message || "站点待回迁写入失败",
    url,
    missing: [],
    payload,
    site: siteResult,
    restoreFileId: siteResult.restoreFileId,
  }
}
