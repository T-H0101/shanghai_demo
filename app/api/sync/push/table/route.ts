/**
 * POST /api/sync/push/table
 * 业务系统向已开包（receiving）追加一张表的全量/增量数据。
 * 可选分片字段 partIndex/partTotal（预留；当前表级唯一键仍为 site+batch+tableName，
 * 同表重推会覆盖表级日志并重新 dispatch）。
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authenticatePushRequest,
  authErrorResponse,
  parseJsonBody,
  readRawBody,
} from '@/lib/sync/push-auth'
import {
  ALLOWED_PACKAGE_TABLES,
  type AllowedPackageTable,
  type TableSyncMode,
} from '@/lib/sync/package-schema'
import {
  createTableLog,
  findPackageByBatch,
  markTableFailed,
  markTableSuccess,
  refreshPackageCountsFromTables,
} from '@/lib/sync/package-log'
import { dispatchTable } from '@/lib/sync/package-dispatcher'

export const dynamic = 'force-dynamic'

const FORBIDDEN = new Set(['tbl_file', 'tbl_folder'])

export async function POST(request: NextRequest) {
  const rawOrErr = await readRawBody(request)
  if (typeof rawOrErr !== 'string') return rawOrErr
  const rawBody = rawOrErr

  const { auth } = await authenticatePushRequest(rawBody, request)
  if (!auth.ok) {
    return authErrorResponse(auth.message, auth.code)
  }

  const parsed = parseJsonBody(rawBody)
  if (!parsed.ok) return parsed.response
  const body = parsed.value as Record<string, unknown>

  const siteCode = typeof body.siteCode === 'string' ? body.siteCode.trim() : ''
  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : ''
  const tableName = typeof body.tableName === 'string' ? body.tableName.trim() : ''
  const syncModeRaw = typeof body.syncMode === 'string' ? body.syncMode : 'full'
  const syncMode: TableSyncMode =
    syncModeRaw === 'incremental' || syncModeRaw === 'aggregate' ? syncModeRaw : 'full'
  const records = Array.isArray(body.records) ? (body.records as Record<string, unknown>[]) : null

  if (!siteCode || !batchId || !tableName) {
    return NextResponse.json(
      { code: 400, message: 'siteCode, batchId, tableName required' },
      { status: 400 },
    )
  }
  if (!records) {
    return NextResponse.json({ code: 400, message: 'records must be an array' }, { status: 400 })
  }
  if (FORBIDDEN.has(tableName)) {
    return NextResponse.json(
      { code: 400, message: `table forbidden: ${tableName}` },
      { status: 400 },
    )
  }
  if (!(ALLOWED_PACKAGE_TABLES as readonly string[]).includes(tableName)) {
    return NextResponse.json(
      { code: 400, message: `table not in whitelist: ${tableName}` },
      { status: 400 },
    )
  }

  const pkg = await findPackageByBatch(siteCode, batchId)
  if (!pkg) {
    return NextResponse.json(
      { code: 404, message: 'batch not found; call POST /api/sync/push/begin first' },
      { status: 404 },
    )
  }
  if (pkg.status !== 'receiving') {
    return NextResponse.json(
      {
        code: 409,
        message: `batch is not receiving (status=${pkg.status}); refuse table append`,
        siteCode,
        batchId,
        status: pkg.status,
      },
      { status: 409 },
    )
  }

  const partIndex =
    typeof body.partIndex === 'number' && Number.isInteger(body.partIndex)
      ? body.partIndex
      : null
  const partTotal =
    typeof body.partTotal === 'number' && Number.isInteger(body.partTotal)
      ? body.partTotal
      : null

  const tableLog = await createTableLog({
    packageLogId: pkg.id,
    siteCode,
    batchId,
    tableName,
    syncMode,
    expectedRecordCount: records.length,
    status: 'running',
  })

  const result = await dispatchTable({
    tableName: tableName as AllowedPackageTable,
    siteCode,
    records,
    syncMode,
  })

  if (result.status === 'success' || result.status === 'partial' || result.status === 'skipped') {
    await markTableSuccess(tableLog.id, {
      processedRecordCount: result.upserted,
      insertedCount: result.inserted,
      updatedCount: result.updated,
      skippedCount: result.skipped,
      failedCount: result.failed,
    })
  } else {
    await markTableFailed(tableLog.id, {
      errorMessage: result.errorMessage ?? result.status,
      processedRecordCount: result.upserted,
      insertedCount: result.inserted,
      updatedCount: result.updated,
      skippedCount: result.skipped,
      failedCount: result.failed,
    })
  }

  await refreshPackageCountsFromTables(pkg.id)

  const headersOut: Record<string, string> = {}
  if (auth.warning) headersOut['x-auth-warning'] = auth.warning

  return NextResponse.json(
    {
      code: 0,
      message: 'table accepted',
      siteCode,
      batchId,
      packageId: pkg.id,
      packageStatus: 'receiving',
      table: {
        tableName,
        status: result.status,
        received: result.received,
        upserted: result.upserted,
        inserted: result.inserted,
        updated: result.updated,
        deleted: result.deleted,
        failed: result.failed,
        errorMessage: result.errorMessage,
        partIndex,
        partTotal,
      },
      next: 'continue POST /api/sync/push/table or POST /api/sync/push/commit',
    },
    { headers: Object.keys(headersOut).length ? headersOut : undefined },
  )
}
