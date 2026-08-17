/**
 * POST /api/sync/push/begin
 * 业务系统开包：生成 batchId，包状态 receiving，后续可多次收表。
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  authenticatePushRequest,
  authErrorResponse,
  ensureSyncSite,
  parseJsonBody,
  parsePackageRegistryFields,
  readRawBody,
} from '@/lib/sync/push-auth'
import { createPackageLog } from '@/lib/sync/package-log'
import { formatBeijingTime } from '@/lib/time/beijing'

export const dynamic = 'force-dynamic'

/** 北京时间 yyyyMMddHHmmss，便于从 batchId 直接读出时刻 */
function compactBeijingStamp(d = new Date()): string {
  return formatBeijingTime(d).replace(/\D/g, '')
}

function newBatchId(siteCode: string): string {
  return `${siteCode}-push-${compactBeijingStamp()}-${randomUUID()}`
}

export async function POST(request: NextRequest) {
  const rawOrErr = await readRawBody(request)
  if (typeof rawOrErr !== 'string') return rawOrErr
  const rawBody = rawOrErr

  const { headers, auth } = await authenticatePushRequest(rawBody, request)
  if (!auth.ok) {
    return authErrorResponse(auth.message, auth.code)
  }

  const parsed = parseJsonBody(rawBody)
  if (!parsed.ok) return parsed.response
  const body = parsed.value as Record<string, unknown>

  const siteCode = typeof body.siteCode === 'string' ? body.siteCode.trim() : ''
  if (!siteCode) {
    return NextResponse.json({ code: 400, message: 'siteCode required' }, { status: 400 })
  }

  const mode =
    body.mode === 'incremental' || body.mode === 'mixed' || body.mode === 'full'
      ? body.mode
      : 'full'
  const version =
    typeof body.version === 'string' && body.version.trim()
      ? body.version.trim()
      : 'site-push/1.0'
  const clientRoundId =
    typeof body.roundId === 'string' && body.roundId.trim() ? body.roundId.trim() : null
  const batchId =
    typeof body.batchId === 'string' && body.batchId.trim()
      ? body.batchId.trim().slice(0, 100)
      : newBatchId(siteCode)

  if (batchId.length < 8 || batchId.length > 100) {
    return NextResponse.json(
      { code: 400, message: 'batchId length must be 8..100' },
      { status: 400 },
    )
  }

  const registry = parsePackageRegistryFields(body)
  await ensureSyncSite(siteCode, registry)

  const packageLog = await createPackageLog({
    siteCode,
    batchId,
    snapshotAt: new Date().toISOString(),
    mode,
    version,
    status: 'receiving',
    tableCount: 0,
    totalRecordCount: 0,
    rawMetadata: {
      protocol: 'push-session',
      phase: 'begin',
      clientRoundId,
      receivedAt: new Date().toISOString(),
      authMode: headers.signature ? 'signed' : 'dev-bypass',
      siteName: registry.siteName ?? null,
      site_host: registry.db_host ?? null,
      site_port: registry.db_port ?? null,
    },
  })

  // ON CONFLICT 只更新 updated_at，可能返回已收尾的旧行
  const finalized = new Set(['success', 'partial', 'failed', 'duplicated', 'abandoned', 'skipped'])
  if (finalized.has(packageLog.status)) {
    return NextResponse.json(
      {
        code: 409,
        message: `batch already exists with status=${packageLog.status}; use a new batchId`,
        siteCode,
        batchId,
        status: packageLog.status,
      },
      { status: 409 },
    )
  }

  // 确保状态为 receiving（冲突复用 pending/running 时强制）
  const { query } = await import('@/lib/db')
  await query(
    `UPDATE sync_package_log
     SET status = 'receiving',
         finished_at = NULL,
         error_message = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'receiving', 'running')`,
    [packageLog.id],
  )

  const headersOut: Record<string, string> = {}
  if (auth.warning) headersOut['x-auth-warning'] = auth.warning

  return NextResponse.json(
    {
      code: 0,
      message: 'push session opened',
      siteCode,
      batchId,
      packageId: packageLog.id,
      status: 'receiving',
      protocol: 'push-session',
      next: 'POST /api/sync/push/table then POST /api/sync/push/commit',
    },
    { headers: Object.keys(headersOut).length ? headersOut : undefined },
  )
}
