/**
 * 业务系统分阶段推送 — 共享鉴权 / 站点注册
 * POST /api/sync/push/{begin,table,commit}
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import {
  extractAuthHeaders,
  verifySyncPackageRequest,
} from '@/lib/sync/package-auth'
import {
  parsePackageRegistryFields,
  type PackageRegistryFields,
} from '@/lib/sync/package-schema'

export async function readRawBody(request: NextRequest): Promise<string | NextResponse> {
  try {
    return await request.text()
  } catch {
    return NextResponse.json({ code: 400, message: 'failed to read request body' }, { status: 400 })
  }
}

export function authErrorResponse(message: string, errorCode: string, warning?: string) {
  return NextResponse.json(
    { code: 401, message, errorCode, warning },
    { status: 401 },
  )
}

export async function authenticatePushRequest(rawBody: string, request: NextRequest) {
  const headers = extractAuthHeaders(request.headers)
  let payloadSiteCode: string | null = null
  try {
    const parsed = JSON.parse(rawBody)
    if (parsed && typeof parsed === 'object' && typeof parsed.siteCode === 'string') {
      payloadSiteCode = parsed.siteCode
    }
  } catch {
    /* ignore — auth still runs on rawBody */
  }

  const auth = verifySyncPackageRequest({
    siteCode: headers.siteCode,
    timestamp: headers.timestamp,
    nonce: headers.nonce,
    signature: headers.signature,
    rawBody,
    payloadSiteCode,
  })

  return { headers, auth, payloadSiteCode }
}

export async function ensureSyncSite(
  siteCode: string,
  registry?: PackageRegistryFields,
): Promise<void> {
  const trimmed = typeof registry?.siteName === 'string' ? registry.siteName.trim() : ''
  const resolvedSiteName = trimmed || `${siteCode} 站点`
  const credentialRef = `SITE_${siteCode}_DATABASE_URL`
  const dbHost =
    typeof registry?.db_host === 'string' && registry.db_host.trim()
      ? registry.db_host.trim()
      : null
  const dbPort =
    typeof registry?.db_port === 'number' &&
    Number.isInteger(registry.db_port) &&
    registry.db_port >= 1 &&
    registry.db_port <= 65535
      ? registry.db_port
      : null

  await query(
    `INSERT INTO sync_sites (
       site_code, site_name, source_type, db_host, db_port, db_name, db_user,
       credential_ref, enabled, sync_interval_seconds, last_connected_at, status
     )
     VALUES ($1, $2, 'site-push', COALESCE($3, 'site-push'), COALESCE($4, 0), 'site_database', 'site-push',
             $5, TRUE, 3600, NOW(), 'active')
     ON CONFLICT (site_code) DO UPDATE SET
       site_name = EXCLUDED.site_name,
       db_host = COALESCE($3, sync_sites.db_host),
       db_port = COALESCE($4, sync_sites.db_port),
       last_connected_at = NOW(),
       status = 'active',
       updated_at = NOW()`,
    [siteCode, resolvedSiteName, dbHost, dbPort, credentialRef],
  )
}

export function parseJsonBody(rawBody: string): { ok: true; value: unknown } | { ok: false; response: NextResponse } {
  try {
    return { ok: true, value: JSON.parse(rawBody) }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ code: 400, message: 'invalid JSON' }, { status: 400 }),
    }
  }
}

export { parsePackageRegistryFields }
