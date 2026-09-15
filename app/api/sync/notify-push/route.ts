/**
 * POST /api/sync/notify-push
 *
 * 通知指定站点业务系统（MultimediumNw）立即执行一次推送。
 * - 使用顶部所属站点 siteCode（不做多选）
 * - 写 sync_scheduler_log 一条（通知结果，非推送完成）
 * - 不宣称「同步成功」
 */

import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { query } from "@/lib/db"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"
import { isProbeableEndpoint } from "@/lib/site/probe-tcp"
import { formatBeijingTime } from "@/lib/time/beijing"

export const dynamic = "force-dynamic"

interface SyncSiteRow {
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
}

function compactStamp(): string {
  return formatBeijingTime(new Date()).replace(/\D/g, "")
}

function triggerSecret(): string {
  return (
    process.env.SITE_SYNC_TRIGGER_SECRET?.trim() ||
    process.env.SITE_SSO_SECRET?.trim() ||
    ""
  )
}

function triggerPath(): string {
  const p = (process.env.SITE_SYNC_TRIGGER_PATH ?? "/unified-sync/trigger").trim()
  return p.startsWith("/") ? p : `/${p}`
}

async function insertSchedulerLog(input: {
  siteCode: string
  runId: string
  status: string
  pushStatus: string
  errorMessage: string | null
  resultJson: Record<string, unknown>
}) {
  await query(
    `INSERT INTO sync_scheduler_log
      (site_code, run_id, started_at, finished_at, status,
       export_status, push_status, consistency_status,
       package_batch_id, error_message, result_json)
     VALUES ($1, $2, NOW(), NOW(), $3, NULL, $4, NULL, NULL, $5, $6::jsonb)`,
    [
      input.siteCode,
      input.runId,
      input.status,
      input.pushStatus,
      input.errorMessage,
      JSON.stringify(input.resultJson),
    ],
  )
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "sync:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  let body: { siteCode?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ code: 400, message: "invalid json" }, { status: 400 })
  }

  const siteCode = typeof body.siteCode === "string" ? body.siteCode.trim() : ""
  if (!siteCode) {
    return NextResponse.json(
      {
        code: 400,
        message: "请先选择具体所属站点（不能为「全部站点」）",
      },
      { status: 400 },
    )
  }

  const accessible = session.accessibleSites ?? []
  if (
    accessible.length > 0 &&
    !accessible.includes("*") &&
    !accessible.includes(siteCode)
  ) {
    return NextResponse.json(
      { code: 403, message: `无权操作站点 ${siteCode}` },
      { status: 403 },
    )
  }

  const secret = triggerSecret()
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      {
        code: 503,
        message:
          "未配置 SITE_SYNC_TRIGGER_SECRET / SITE_SSO_SECRET，无法通知站点（须与 NW unifiedDiscSso.secretKey 一致）",
      },
      { status: 503 },
    )
  }

  let site: SyncSiteRow | null = null
  try {
    const result = await query<SyncSiteRow>(
      `SELECT site_code, site_name, db_host, db_port, enabled
       FROM sync_sites
       WHERE site_code = $1
       LIMIT 1`,
      [siteCode],
    )
    site = result.rows[0] ?? null
  } catch (e) {
    return NextResponse.json(
      { code: 500, message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }

  if (!site) {
    return NextResponse.json({ code: 404, message: `站点未注册: ${siteCode}` }, { status: 404 })
  }
  if (!site.enabled) {
    return NextResponse.json({ code: 400, message: "站点已在总控禁用" }, { status: 400 })
  }
  if (!isProbeableEndpoint(site.db_host, site.db_port)) {
    return NextResponse.json(
      {
        code: 400,
        message: "站点未登记真实业务地址（db_host:db_port），无法通知",
      },
      { status: 400 },
    )
  }

  const runId = `notify-${siteCode}-${compactStamp()}-${randomUUID().slice(0, 8)}`
  const path = triggerPath()
  const url = `http://${site.db_host}:${site.db_port}${path}`
  const timeoutMs = Number(process.env.SITE_SYNC_TRIGGER_TIMEOUT_MS ?? 15000)

  let httpStatus = 0
  let accepted = false
  let siteMessage = ""
  let notifyOk = false

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-site-code": siteCode,
          "x-unified-sync-secret": secret,
        },
        body: JSON.stringify({
          siteCode,
          action: "push_now",
          runId,
          requestedBy: session.username,
        }),
        signal: controller.signal,
      })
      httpStatus = res.status
      const text = await res.text()
      let parsed: { message?: string; accepted?: boolean; code?: number } | null = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = null
      }
      siteMessage =
        (parsed && typeof parsed.message === "string" && parsed.message) ||
        text.slice(0, 200) ||
        `HTTP ${res.status}`
      accepted = res.status === 202 || res.status === 200 || parsed?.accepted === true
      notifyOk = accepted && res.status < 400
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    siteMessage = e instanceof Error ? e.message : String(e)
    notifyOk = false
  }

  const status = notifyOk ? "success" : "failed"
  const pushStatus = notifyOk ? "accepted" : "failed"

  try {
    await insertSchedulerLog({
      siteCode,
      runId,
      status,
      pushStatus,
      errorMessage: notifyOk ? null : siteMessage,
      resultJson: {
        protocol: "notify-push",
        url,
        httpStatus,
        accepted: notifyOk,
        siteMessage,
        requestedBy: session.username,
      },
    })
  } catch (e) {
    console.error("[notify-push] write sync_scheduler_log failed:", e)
  }

  await writeAudit({
    action: "notify_site_push",
    targetTable: "sync_scheduler_log",
    targetId: runId,
    after: {
      siteCode,
      runId,
      notifyOk,
      httpStatus,
      url,
    },
    actor: session.username,
    result: notifyOk ? "success" : "failed",
  })

  if (!notifyOk) {
    return NextResponse.json(
      {
        code: 502,
        message: `通知站点失败: ${siteMessage}`,
        runId,
        siteCode,
        httpStatus: httpStatus || null,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    code: 0,
    ok: true,
    message: `已通知站点 ${siteCode} 执行推送，等待站点上报同步包`,
    runId,
    siteCode,
    httpStatus,
  })
}
