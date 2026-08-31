/**
 * GET /api/sites/[id]/sso
 * 近期方案：总控已登录用户签发跳转 ticket，打开站点 MultimediumNw /unified-sso/consume
 *
 * REQ-2.1.2 站点切换 — 阶段一（legacy_jump_ticket）
 * 站点必须配置相同 SITE_SSO_SECRET / unifiedDiscSso.secretKey 并实现 consume。
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { writeAudit } from "@/lib/control/audit"
import { isProbeableEndpoint } from "@/lib/site/probe-tcp"
import {
  buildSiteJumpUrl,
  encryptSiteSsoTicket,
  isSiteSsoSecretConfigured,
  normalizeSiteSsoRedirect,
  resolveCentralPortalSitesUrl,
} from "@/lib/site/sso-ticket"
import { resolveSiteLocalUsername } from "@/lib/auth/account-mapping"
import { ensureAuthSchema } from "@/lib/auth/server"

interface SyncSiteRow {
  id: string
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session
  try {
    session = await requireSession(req)
    requirePermission(session, "sites:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const { id } = await params

  if (!isSiteSsoSecretConfigured()) {
    return NextResponse.json(
      {
        code: 0,
        status: "blocked_by_config",
        blocker: "SITE_SSO_SECRET_not_configured",
        message:
          "未配置 SITE_SSO_SECRET（64 位 hex）。需与站点 MultimediumNw unifiedDiscSso.secretKey 一致",
      },
      { status: 200 },
    )
  }

  let site: SyncSiteRow | null = null
  try {
    const result = await query<SyncSiteRow>(
      `SELECT id::text, site_code, site_name, db_host, db_port, enabled
       FROM sync_sites
       WHERE id::text = $1 OR site_code = $1
       LIMIT 1`,
      [id],
    )
    site = result.rows[0] ?? null
  } catch (e) {
    return NextResponse.json(
      {
        code: 500,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    )
  }

  if (!site) {
    return NextResponse.json({ code: 404, message: "站点未注册" }, { status: 404 })
  }

  if (!site.enabled) {
    return NextResponse.json(
      {
        code: 0,
        status: "blocked",
        blocker: "site_disabled",
        message: "站点已在总控禁用，不能 SSO 跳转",
      },
      { status: 200 },
    )
  }

  if (!isProbeableEndpoint(site.db_host, site.db_port)) {
    return NextResponse.json(
      {
        code: 0,
        status: "blocked",
        blocker: "site_address_missing",
        message: "站点未登记真实 db_host:db_port，无法拼跳转地址",
        siteCode: site.site_code,
      },
      { status: 200 },
    )
  }

  const accessible = session.accessibleSites ?? []
  if (
    accessible.length > 0 &&
    !accessible.includes("*") &&
    !accessible.includes(site.site_code)
  ) {
    return NextResponse.json(
      { code: 403, message: `无权跳转到站点 ${site.site_code}` },
      { status: 403 },
    )
  }

  const returnUrl = resolveCentralPortalSitesUrl(req)
  const redirect = normalizeSiteSsoRedirect(req.nextUrl.searchParams.get("redirect"))
  await ensureAuthSchema()
  const username = await resolveSiteLocalUsername({
    accountId: session.id,
    employeeId: session.employeeId,
    email: session.email,
    fallbackUsername: session.username,
    siteCode: site.site_code,
  })
  let ticket: string
  try {
    ticket = encryptSiteSsoTicket({
      username,
      siteCode: site.site_code,
      returnUrl,
      ...(redirect ? { redirect } : {}),
    })
  } catch (e) {
    return NextResponse.json(
      {
        code: 0,
        status: "blocked_by_config",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 200 },
    )
  }

  const useHttps = process.env.SITE_SSO_HTTPS === "true"
  const jumpUrl = buildSiteJumpUrl({
    host: site.db_host.trim(),
    port: Number(site.db_port),
    ticket,
    https: useHttps,
  })

  await writeAudit({
    action: "site_sso_jump",
    targetTable: "sync_sites",
    targetId: site.site_code,
    before: null,
    after: {
      siteCode: site.site_code,
      username,
      jumpHost: site.db_host,
      jumpPort: site.db_port,
      returnUrl,
      redirect: redirect ?? null,
    },
    actor: username,
    result: "success",
  })

  return NextResponse.json({
    code: 0,
    status: "ready",
    siteCode: site.site_code,
    siteName: site.site_name,
    siteLocalUsername: username,
    jumpUrl,
    returnUrl,
    redirect: redirect ?? null,
    expiresInSeconds: 120,
    message: "跳转票据已签发；请打开 jumpUrl。站点须实现 /unified-sso/consume",
  })
}
