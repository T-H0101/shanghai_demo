/**
 * POST /api/sync/push/commit
 * 结束推送会话：聚合表级结果，标记 success / partial / failed，之后拒绝再收表。
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  authenticatePushRequest,
  authErrorResponse,
  parseJsonBody,
  readRawBody,
} from '@/lib/sync/push-auth'
import {
  findPackageByBatch,
  listTableLogsByBatch,
  markPackageFailed,
  markPackagePartial,
  markPackageSuccess,
  refreshPackageCountsFromTables,
} from '@/lib/sync/package-log'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
  if (!siteCode || !batchId) {
    return NextResponse.json(
      { code: 400, message: 'siteCode and batchId required' },
      { status: 400 },
    )
  }

  const pkg = await findPackageByBatch(siteCode, batchId)
  if (!pkg) {
    return NextResponse.json({ code: 404, message: 'batch not found' }, { status: 404 })
  }

  if (pkg.status === 'success' || pkg.status === 'partial' || pkg.status === 'failed') {
    return NextResponse.json({
      code: 0,
      message: 'batch already finalized',
      siteCode,
      batchId,
      status: pkg.status,
      duplicated: true,
      summary: {
        tableCount: pkg.table_count,
        totalRecordCount: pkg.total_record_count,
        successTableCount: pkg.success_table_count,
        failedTableCount: pkg.failed_table_count,
      },
    })
  }

  if (pkg.status !== 'receiving' && pkg.status !== 'running' && pkg.status !== 'pending') {
    return NextResponse.json(
      {
        code: 409,
        message: `cannot commit batch in status=${pkg.status}`,
        siteCode,
        batchId,
        status: pkg.status,
      },
      { status: 409 },
    )
  }

  const tables = await listTableLogsByBatch(siteCode, batchId)
  await refreshPackageCountsFromTables(pkg.id)

  const successLike = tables.filter((t) =>
    ['success', 'partial', 'skipped'].includes(t.status),
  ).length
  const failed = tables.filter((t) => t.status === 'failed').length
  const totalRecords = tables.reduce((sum, t) => sum + (t.processed_record_count || 0), 0)

  let finalStatus: 'success' | 'partial' | 'failed'
  if (tables.length === 0) {
    finalStatus = 'failed'
    await markPackageFailed(pkg.id, {
      errorMessage: 'commit with zero tables',
      tableCount: 0,
      totalRecordCount: 0,
      successTableCount: 0,
      failedTableCount: 0,
    })
  } else if (failed === 0) {
    finalStatus = 'success'
    await markPackageSuccess(pkg.id, {
      tableCount: tables.length,
      totalRecordCount: totalRecords,
      successTableCount: successLike,
      failedTableCount: 0,
    })
  } else if (successLike === 0) {
    finalStatus = 'failed'
    await markPackageFailed(pkg.id, {
      errorMessage: `${failed} table(s) failed`,
      tableCount: tables.length,
      totalRecordCount: totalRecords,
      successTableCount: 0,
      failedTableCount: failed,
    })
  } else {
    finalStatus = 'partial'
    await markPackagePartial(pkg.id, {
      tableCount: tables.length,
      totalRecordCount: totalRecords,
      successTableCount: successLike,
      failedTableCount: failed,
    })
  }

  await query(
    `UPDATE sync_package_log
     SET raw_metadata = COALESCE(raw_metadata, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [
      pkg.id,
      JSON.stringify({
        phase: 'commit',
        committedAt: new Date().toISOString(),
        tableNames: tables.map((t) => t.table_name),
      }),
    ],
  )

  const headersOut: Record<string, string> = {}
  if (auth.warning) headersOut['x-auth-warning'] = auth.warning

  return NextResponse.json(
    {
      code: 0,
      message: 'push session committed',
      siteCode,
      batchId,
      packageId: pkg.id,
      status: finalStatus,
      duplicated: false,
      summary: {
        tableCount: tables.length,
        totalRecordCount: totalRecords,
        successTableCount: successLike,
        failedTableCount: failed,
      },
      tables: tables.map((t) => ({
        tableName: t.table_name,
        status: t.status,
        processedRecordCount: t.processed_record_count,
        insertedCount: t.inserted_count,
        updatedCount: t.updated_count,
        failedCount: t.failed_count,
        errorMessage: t.error_message,
      })),
    },
    { headers: Object.keys(headersOut).length ? headersOut : undefined },
  )
}
