/**
 * 总控直调站点业务 HTTP：写入 tbl_restore_file（仅落库，不执行回迁）
 *
 * - 未迁入：打归档单站（站点按 RFID 认领在线设备）
 * - 迁入区域：对该区域下全部可访问站点并行扇出；任一成功即整体成功
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
import {
  formatPhysicalIncompleteMessage,
  formatRestoreUserMessage,
} from "@/lib/control/restore-user-message"
import { hasAllSitesAccess } from "@/lib/auth/site-scope"

interface SyncSiteRow {
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
  region_code: string | null
}

export type RestoreSiteAttempt = {
  siteCode: string
  siteName: string
  ok: boolean
  message: string
  reasonCode: string | null
  httpStatus: number
  restoreFileId: string | number | null
  taskId: string | number | null
  libIp: string | null
  libPort: string | null
  deviceName: string | null
  url: string | null
}

export type DispatchSiteRestoreFileInput = {
  /** 单站模式：目标站；扇出模式可空 */
  targetSiteCode?: string | null
  /** 扇出模式：逻辑区域编码 */
  regionCode?: string | null
  /** true=区域并行扇出；false/缺省=单站 */
  fanoutByRegion?: boolean
  /** 会话可见站点；null=全部（group_admin） */
  accessibleSites?: string[] | null
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
  /** 成功跳转站（扇出时取 site_code 排序后第一个成功站） */
  winnerSiteCode: string | null
  winnerSiteName: string | null
  winnerDeviceLabel: string | null
  attempts: RestoreSiteAttempt[]
  mode: "single" | "region_fanout"
}

function resolveBaseUrl(site: SyncSiteRow): string {
  const siteCode = site.site_code.trim().toUpperCase()
  const envOverride =
    process.env[`SITE_RESTORE_FILE_BASE_URL_${siteCode}`]?.trim() ||
    process.env.SITE_RESTORE_FILE_BASE_URL?.trim() ||
    process.env[`SITE_TASK_CONTROL_BASE_URL_${siteCode}`]?.trim() ||
    process.env.SITE_TASK_CONTROL_BASE_URL?.trim() ||
    ""
  if (envOverride) return envOverride.replace(/\/+$/, "")
  return `http://${site.db_host.trim()}:${site.db_port}`
}

function deviceLabelOf(a: {
  deviceName: string | null
  libIp: string | null
  libPort: string | null
}): string | null {
  if (a.deviceName) {
    if (a.libIp && a.libPort) return `${a.deviceName}（${a.libIp}:${a.libPort}）`
    return a.deviceName
  }
  if (a.libIp && a.libPort) return `${a.libIp}:${a.libPort}`
  if (a.libIp) return a.libIp
  return null
}

function filterByAccess(
  sites: SyncSiteRow[],
  accessibleSites: string[] | null | undefined,
): SyncSiteRow[] {
  if (accessibleSites == null || hasAllSitesAccess(accessibleSites)) return sites
  const allowed = new Set(accessibleSites.map((s) => s.trim().toUpperCase()))
  return sites.filter((s) => allowed.has(s.site_code.trim().toUpperCase()))
}

async function callOneSite(opts: {
  site: SyncSiteRow
  secret: string
  basePayload: PhysicalRestorePayload
  requestId: string
  requestedBy?: string | null
}): Promise<RestoreSiteAttempt> {
  const siteCode = opts.site.site_code.trim().toUpperCase()
  const siteName = opts.site.site_name?.trim() || siteCode
  if (!opts.site.enabled) {
    return {
      siteCode,
      siteName,
      ok: false,
      message: "站点已在总控禁用",
      reasonCode: "SITE_DISABLED",
      httpStatus: 403,
      restoreFileId: null,
      taskId: null,
      libIp: null,
      libPort: null,
      deviceName: null,
      url: null,
    }
  }
  if (!isProbeableEndpoint(opts.site.db_host, opts.site.db_port)) {
    return {
      siteCode,
      siteName,
      ok: false,
      message: "站点未登记真实业务地址（db_host:db_port）",
      reasonCode: "SITE_ENDPOINT_MISSING",
      httpStatus: 422,
      restoreFileId: null,
      taskId: null,
      libIp: null,
      libPort: null,
      deviceName: null,
      url: null,
    }
  }

  const baseUrl = resolveBaseUrl(opts.site)
  const url = `${baseUrl}${siteRestoreFilePath()}`
  const payload: PhysicalRestorePayload = {
    ...opts.basePayload,
    request_id: opts.requestId,
    site_code: siteCode,
    requested_by: opts.requestedBy ?? null,
    source: "central-control",
  }

  const siteResult = await callSiteRestoreFile({
    baseUrl,
    secret: opts.secret,
    payload,
    siteCode,
  })

  return {
    siteCode,
    siteName,
    ok: siteResult.ok,
    message: formatRestoreUserMessage(siteResult.message, siteResult.reasonCode),
    reasonCode: siteResult.reasonCode,
    httpStatus: siteResult.httpStatus,
    restoreFileId: siteResult.restoreFileId,
    taskId: siteResult.taskId,
    libIp: siteResult.libIp,
    libPort: siteResult.libPort,
    deviceName: siteResult.deviceName,
    url,
  }
}

function pickWinner(attempts: RestoreSiteAttempt[]): RestoreSiteAttempt | null {
  const okOnes = attempts
    .filter((a) => a.ok)
    .sort((a, b) => a.siteCode.localeCompare(b.siteCode, "en"))
  return okOnes[0] ?? null
}

function formatAllFailedMessage(attempts: RestoreSiteAttempt[]): string {
  if (!attempts.length) return "区域内无可用站点，无法发起回迁"
  return attempts
    .map(
      (a) =>
        `${a.siteName}（${a.siteCode}）：${formatRestoreUserMessage(a.message, a.reasonCode)}`,
    )
    .join("；")
}

export async function dispatchSiteRestoreFile(
  input: DispatchSiteRestoreFileInput,
): Promise<DispatchSiteRestoreFileResult> {
  const empty = (
    partial: Partial<DispatchSiteRestoreFileResult> &
      Pick<DispatchSiteRestoreFileResult, "ok" | "httpStatus" | "message">,
  ): DispatchSiteRestoreFileResult => ({
    url: null,
    missing: [],
    payload: null,
    site: null,
    restoreFileId: null,
    winnerSiteCode: null,
    winnerSiteName: null,
    winnerDeviceLabel: null,
    attempts: [],
    mode: input.fanoutByRegion ? "region_fanout" : "single",
    ...partial,
  })

  const validated = validatePhysicalRestoreInput(input.physical)
  if (!validated.ok) {
    return empty({
      ok: false,
      httpStatus: 400,
      message: formatPhysicalIncompleteMessage(validated.missing),
      missing: validated.missing,
    })
  }

  const secret = resolveSiteRestoreFileSecret()
  if (!secret || secret.length < 16) {
    return empty({
      ok: false,
      httpStatus: 503,
      message:
        "未配置 SITE_SSO_SECRET / SITE_SYNC_TRIGGER_SECRET，无法调用站点待回迁接口",
      payload: validated.payload,
    })
  }

  const requestId = (input.requestId?.trim() || randomUUID()).slice(0, 64)
  const fanout = Boolean(input.fanoutByRegion)
  let sites: SyncSiteRow[] = []

  if (fanout) {
    const region = (input.regionCode ?? "").trim().toUpperCase()
    if (!region) {
      return empty({
        ok: false,
        httpStatus: 400,
        message: "缺少目标区域，无法扇出回迁",
        missing: ["region_code"],
        payload: validated.payload,
        mode: "region_fanout",
      })
    }
    const res = await query<SyncSiteRow>(
      `SELECT site_code, site_name, db_host, db_port, enabled, region_code
       FROM sync_sites
       WHERE UPPER(TRIM(COALESCE(region_code, ''))) = $1
       ORDER BY site_code ASC`,
      [region],
    )
    sites = filterByAccess(res.rows, input.accessibleSites)
  } else {
    const siteCode = (input.targetSiteCode ?? "").trim().toUpperCase()
    if (!siteCode) {
      return empty({
        ok: false,
        httpStatus: 400,
        message: "缺少目标站点",
        missing: ["target_site_code"],
        payload: validated.payload,
        mode: "single",
      })
    }
    const res = await query<SyncSiteRow>(
      `SELECT site_code, site_name, db_host, db_port, enabled, region_code
       FROM sync_sites
       WHERE site_code = $1
       LIMIT 1`,
      [siteCode],
    )
    if (!res.rows[0]) {
      return empty({
        ok: false,
        httpStatus: 404,
        message: `站点未注册: ${siteCode}`,
        payload: validated.payload,
        mode: "single",
      })
    }
    sites = filterByAccess(res.rows, input.accessibleSites)
    if (!sites.length) {
      return empty({
        ok: false,
        httpStatus: 403,
        message: `无权访问站点: ${siteCode}`,
        payload: validated.payload,
        mode: "single",
      })
    }
  }

  if (!sites.length) {
    return empty({
      ok: false,
      httpStatus: 422,
      message: fanout
        ? "该区域下无可用站点（未注册、已禁用或无权访问）"
        : "无可用目标站点",
      payload: validated.payload,
      mode: fanout ? "region_fanout" : "single",
    })
  }

  const attempts = await Promise.all(
    sites.map((site) =>
      callOneSite({
        site,
        secret,
        basePayload: validated.payload,
        requestId,
        requestedBy: input.requestedBy,
      }),
    ),
  )

  const winner = pickWinner(attempts)
  const ok = Boolean(winner)

  await writeAudit({
    commandNo: `RESTORE-FILE-${requestId}`,
    action: fanout ? "restore_file_register_fanout" : "restore_file_register",
    targetTable: "tbl_restore_file",
    targetId: String(winner?.restoreFileId ?? requestId).slice(0, 64),
    before: null,
    after: {
      mode: fanout ? "region_fanout" : "single",
      regionCode: input.regionCode ?? null,
      requestId,
      payload: validated.payload,
      winnerSiteCode: winner?.siteCode ?? null,
      attempts: attempts.map((a) => ({
        siteCode: a.siteCode,
        ok: a.ok,
        reasonCode: a.reasonCode,
        message: a.message,
        restoreFileId: a.restoreFileId,
        libIp: a.libIp,
        libPort: a.libPort,
      })),
    },
    actor: input.requestedBy ?? null,
    actorIp: input.requestedIp ?? null,
    siteCode: winner?.siteCode ?? sites[0]?.site_code ?? null,
    dryRun: false,
    result: ok ? "success" : "failed",
    errorMessage: ok ? null : formatAllFailedMessage(attempts),
  })

  if (ok && winner) {
    const deviceLabel = deviceLabelOf(winner)
    const siteLabel =
      winner.siteName && winner.siteName !== winner.siteCode
        ? `${winner.siteName}（${winner.siteCode}）`
        : winner.siteCode
    return {
      ok: true,
      httpStatus: 200,
      message: deviceLabel
        ? `回迁记录已提交到站点 ${siteLabel}，设备 ${deviceLabel}，等待站点处理`
        : `回迁记录已提交到站点 ${siteLabel}，等待站点处理`,
      url: winner.url,
      missing: [],
      payload: {
        ...validated.payload,
        request_id: requestId,
        site_code: winner.siteCode,
        requested_by: input.requestedBy ?? null,
        source: "central-control",
        ...(winner.libIp ? { device_ip: winner.libIp } : {}),
        ...(winner.libPort ? { device_port: winner.libPort } : {}),
      },
      site: {
        ok: true,
        httpStatus: winner.httpStatus,
        code: 0,
        accepted: true,
        reasonCode: null,
        message: winner.message,
        restoreFileId: winner.restoreFileId,
        taskId: winner.taskId,
        libIp: winner.libIp,
        libPort: winner.libPort,
        deviceName: winner.deviceName,
        raw: null,
      },
      restoreFileId: winner.restoreFileId,
      winnerSiteCode: winner.siteCode,
      winnerSiteName: winner.siteName,
      winnerDeviceLabel: deviceLabel,
      attempts,
      mode: fanout ? "region_fanout" : "single",
    }
  }

  const inProgress = attempts.find((a) => a.reasonCode === "RESTORE_IN_PROGRESS")
  return {
    ok: false,
    httpStatus: inProgress ? 409 : 502,
    message: inProgress
      ? inProgress.message || "当前文件正在回迁中，请勿重复发起"
      : formatAllFailedMessage(attempts),
    url: null,
    missing: [],
    payload: validated.payload,
    site: null,
    restoreFileId: null,
    winnerSiteCode: null,
    winnerSiteName: null,
    winnerDeviceLabel: null,
    attempts,
    mode: fanout ? "region_fanout" : "single",
  }
}
