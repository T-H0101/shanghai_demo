/**
 * POST /api/sync/package
 * Sprint 2D.2 - 站点数据包接收接口
 *
 * 严格白名单：仅 tbl_task / tbl_disc_lib
 * 严禁：tbl_file / tbl_folder
 *
 * 流程:
 * 1. 解析 JSON
 * 2. 校验 payload
 * 3. 幂等检查 (findPackageByBatch)
 * 4. 创建 package log
 * 5. 派发到各表 importer
 * 6. 更新 table log
 * 7. 更新 package log
 * 8. 返回 JSON
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  validatePackagePayload,
  type SyncPackagePayload,
} from '@/lib/sync/package-schema'
import {
  findPackageByBatch,
  createPackageLog,
  markPackageRunning,
  markPackageSuccess,
  markPackageFailed,
  createTableLog,
  markTableSuccess,
  markTableFailed,
} from '@/lib/sync/package-log'
import { dispatchTable, type DispatchResult } from '@/lib/sync/package-dispatcher'

export const dynamic = 'force-dynamic'

interface TableSummary {
  tableName: string
  status: string
  received: number
  upserted: number
  failed: number
  errorMessage?: string
}

interface PackageResponse {
  code: number
  message: string
  source: 'package'
  siteCode: string
  batchId: string
  status: 'success' | 'failed' | 'partial' | 'duplicated'
  duplicated: boolean
  summary: {
    tableCount: number
    totalRecordCount: number
    successTableCount: number
    failedTableCount: number
  }
  tables: TableSummary[]
}

/**
 * TODO: 接入生产鉴权 (API key / mTLS)
 * 当前阶段只校验 siteCode 存在
 */
function checkSiteCode(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { code: 400, message: 'invalid JSON' },
      { status: 400 }
    )
  }

  // 1. 校验
  const validation = validatePackagePayload(payload)
  if (!validation.valid) {
    return NextResponse.json(
      {
        code: 400,
        message: 'validation failed',
        errors: validation.errors,
      },
      { status: 400 }
    )
  }

  const p = payload as SyncPackagePayload
  if (!checkSiteCode(p.siteCode)) {
    return NextResponse.json(
      { code: 400, message: 'siteCode required' },
      { status: 400 }
    )
  }

  // 2. 幂等检查
  const existing = await findPackageByBatch(p.siteCode, p.batchId)
  if (existing) {
    if (existing.status === 'success') {
      // TODO: 严格 checksum 比对 (目前无 SHA 实现)
      // 当前直接跳过
      const response: PackageResponse = {
        code: 0,
        message: 'batch already completed, skipped',
        source: 'package',
        siteCode: p.siteCode,
        batchId: p.batchId,
        status: 'duplicated',
        duplicated: true,
        summary: {
          tableCount: existing.table_count,
          totalRecordCount: existing.total_record_count,
          successTableCount: existing.success_table_count,
          failedTableCount: existing.failed_table_count,
        },
        tables: [],
      }
      return NextResponse.json(response)
    }
    // running/failed 状态允许重试: 复用现有 log
  }

  // 3. 创建 package log
  const packageLog = await createPackageLog({
    siteCode: p.siteCode,
    batchId: p.batchId,
    snapshotAt: p.snapshotAt,
    mode: p.mode,
    version: p.version,
    packageChecksum: p.checksum ?? null,
    status: 'running',
    tableCount: p.tables.length,
    totalRecordCount: p.tables.reduce((sum, t) => sum + t.recordCount, 0),
    rawMetadata: {
      receivedAt: new Date().toISOString(),
      source: 'package',
      tables: p.tables.map((t) => t.tableName),
    },
  })

  await markPackageRunning(packageLog.id)

  // 4. 派发到各表
  const tableResults: TableSummary[] = []
  let successCount = 0
  let failedCount = 0
  let totalRecords = 0

  for (const table of p.tables) {
    const tableLog = await createTableLog({
      packageLogId: packageLog.id,
      siteCode: p.siteCode,
      batchId: p.batchId,
      tableName: table.tableName,
      syncMode: table.syncMode,
      expectedRecordCount: table.recordCount,
      status: 'running',
    })

    const result: DispatchResult = await dispatchTable({
      tableName: table.tableName,
      siteCode: p.siteCode,
      records: table.records,
    })

    totalRecords += result.upserted

    if (result.status === 'success') {
      successCount++
      await markTableSuccess(tableLog.id, {
        processedRecordCount: result.received,
        insertedCount: result.inserted,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        failedCount: result.failed,
      })
    } else {
      failedCount++
      await markTableFailed(tableLog.id, {
        errorMessage: result.errorMessage ?? 'unknown',
        processedRecordCount: result.received,
        insertedCount: result.inserted,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        failedCount: result.failed,
      })
    }

    tableResults.push({
      tableName: result.tableName,
      status: result.status,
      received: result.received,
      upserted: result.upserted,
      failed: result.failed,
      errorMessage: result.errorMessage,
    })
  }

  // 5. 更新 package log
  if (failedCount === 0) {
    await markPackageSuccess(packageLog.id, {
      tableCount: p.tables.length,
      totalRecordCount: totalRecords,
      successTableCount: successCount,
    })
  } else {
    await markPackageFailed(packageLog.id, {
      errorMessage: failedCount > 0 ? `${failedCount} table(s) failed` : 'unknown',
      tableCount: p.tables.length,
      totalRecordCount: totalRecords,
      successTableCount: successCount,
      failedTableCount: failedCount,
    })
  }

  const response: PackageResponse = {
    code: failedCount === 0 ? 0 : 207,
    message: failedCount === 0 ? 'package accepted' : 'package partial',
    source: 'package',
    siteCode: p.siteCode,
    batchId: p.batchId,
    status: failedCount === 0 ? 'success' : 'partial',
    duplicated: false,
    summary: {
      tableCount: p.tables.length,
      totalRecordCount: totalRecords,
      successTableCount: successCount,
      failedTableCount: failedCount,
    },
    tables: tableResults,
  }

  return NextResponse.json(response, {
    status: failedCount === 0 ? 200 : 207,
  })
}