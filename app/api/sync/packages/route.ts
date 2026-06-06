/**
 * GET /api/sync/packages
 * Sprint 2D.4 - 同步批次列表
 *
 * Query params:
 *   page (default 1)
 *   pageSize (default 20, max 100)
 *   siteCode (optional)
 *   status (optional)
 *   batchId (optional, ILIKE)
 *   dateFrom (optional, ISO)
 *   dateTo (optional, ISO)
 *
 * 只读 sync_package_log，不回退 mock
 */

import { NextRequest, NextResponse } from 'next/server'
import { listPackageLogs, countPackageLogs, type PackageLogStatus } from '@/lib/sync/package-log'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

interface PackageListItem {
  id: string
  siteCode: string
  batchId: string
  mode: string
  version: string | null
  status: string
  tableCount: number
  totalRecordCount: number
  successTableCount: number
  failedTableCount: number
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

interface ApiResponse {
  code: number
  message: string
  source: 'database'
  data: {
    items: PackageListItem[]
    total: number
    page: number
    pageSize: number
  }
}

function toItem(row: import('@/lib/sync/package-log').SyncPackageLog): PackageListItem {
  return {
    id: row.id,
    siteCode: row.site_code,
    batchId: row.batch_id,
    mode: row.mode,
    version: row.version,
    status: row.status,
    tableCount: row.table_count,
    totalRecordCount: row.total_record_count,
    successTableCount: row.success_table_count,
    failedTableCount: row.failed_table_count,
    errorMessage: row.error_message,
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(sp.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const siteCode = sp.get('siteCode') ?? undefined
  const status = sp.get('status') as PackageLogStatus | null
  const batchId = sp.get('batchId') ?? undefined
  const dateFrom = sp.get('dateFrom') ?? undefined
  const dateTo = sp.get('dateTo') ?? undefined

  const filters = {
    siteCode,
    status: status ?? undefined,
    batchId,
    dateFrom,
    dateTo,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }

  try {
    const [rows, total] = await Promise.all([
      listPackageLogs(filters),
      countPackageLogs(filters),
    ])

    const response: ApiResponse = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: {
        items: rows.map(toItem),
        total,
        page,
        pageSize,
      },
    }
    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[API/sync/packages] Error: ${errorMessage}`)
    return NextResponse.json(
      {
        code: 500,
        message: 'Internal server error',
        source: 'database',
        data: { items: [], total: 0, page, pageSize },
      },
      { status: 500 }
    )
  }
}