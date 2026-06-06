/**
 * GET /api/sync/packages/[id]/tables
 * Sprint 2D.4 - 表明细
 *
 * 只读 sync_table_log
 */

import { NextRequest, NextResponse } from 'next/server'
import { listTableLogs } from '@/lib/sync/package-log'

export const dynamic = 'force-dynamic'

interface TableItem {
  id: string
  packageLogId: string | null
  siteCode: string
  batchId: string
  tableName: string
  syncMode: string
  status: string
  expectedRecordCount: number | null
  processedRecordCount: number
  insertedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

interface ApiResponse {
  code: number
  message: string
  source: 'database'
  data: TableItem[]
}

function toItem(row: import('@/lib/sync/package-log').SyncTableLog): TableItem {
  return {
    id: row.id,
    packageLogId: row.package_log_id,
    siteCode: row.site_code,
    batchId: row.batch_id,
    tableName: row.table_name,
    syncMode: row.sync_mode,
    status: row.status,
    expectedRecordCount: row.expected_record_count,
    processedRecordCount: row.processed_record_count,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    failedCount: row.failed_count,
    errorMessage: row.error_message,
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params

  if (!packageId) {
    return NextResponse.json(
      { code: 400, message: 'package id required', source: 'database', data: [] },
      { status: 400 }
    )
  }

  try {
    const rows = await listTableLogs(packageId)
    const response: ApiResponse = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: rows.map(toItem),
    }
    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[API/sync/packages/tables] Error: ${errorMessage}`)
    return NextResponse.json(
      {
        code: 500,
        message: 'Internal server error',
        source: 'database',
        data: [],
      },
      { status: 500 }
    )
  }
}