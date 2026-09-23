/**
 * POST /api/sync/package
 * Sprint 2D.2 - 站点数据包接收接口
 * Sprint 2G.1 - 增加 HMAC 鉴权
 *
 * 严格白名单：仅 ALLOWED_PACKAGE_TABLES 中的表
 * 严禁：tbl_file / tbl_folder
 *
 * 流程:
 * 0. 读取 rawBody (用于签名校验)
 * 1. 鉴权 (HMAC SHA-256, 头: x-site-code/timestamp/nonce/signature)
 * 2. JSON 解析
 * 3. 校验 payload
 * 4. 幂等检查 (findPackageByBatch)
 * 5. 创建 package log
 * 6. 派发到各表 importer
 * 7. 更新 table log
 * 8. 更新 package log
 * 9. 返回 JSON
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  validatePackagePayload,
  type SyncPackagePayload,
  parsePackageRegistryFields,
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
import {
  extractAuthHeaders,
  verifySyncPackageRequest,
} from '@/lib/sync/package-auth'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface TableSummary {
  tableName: string
  status: string
  received: number
  upserted: number
  inserted: number      // Sprint 2H.6: 真实 inserted 行数 (来自 RETURNING xmax = 0)
  updated: number       // Sprint 2H.6: 真实 updated 行数
  deleted: number       // syncMode=full 快照替换时删除的行数
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

interface AuthErrorResponse {
  code: 401
  message: string
  errorCode: string
  warning?: string
}

/** Sprint 2G.1: 返回 401 统一响应 */
function authErrorResponse(message: string, errorCode: string, warning?: string): NextResponse<AuthErrorResponse> {
  return NextResponse.json<AuthErrorResponse>(
    { code: 401, message, errorCode, warning },
    { status: 401 }
  )
}

async function ensureSyncSite(
  siteCode: string,
  registry?: {
    siteName?: string | null
    db_host?: string | null
    db_port?: number | null
  },
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
     VALUES ($1, $2, 'site-agent', COALESCE($3, 'site-agent'), COALESCE($4, 0), 'site_database', 'site_agent',
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

export async function POST(request: NextRequest) {
  // 0. 读取 rawBody (签名基于原始字节)
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json(
      { code: 400, message: 'failed to read request body' },
      { status: 400 }
    )
  }

  // 1. 鉴权 - 用 rawBody 计算签名
  const headers = extractAuthHeaders(request.headers)

  // 解析 body 以提取 siteCode (仅用于 siteCode-mismatch 检查)
  // 即便 parse 失败, 我们也要先鉴权防止明文 body 被处理
  let payloadSiteCode: string | null = null
  try {
    const parsed = JSON.parse(rawBody)
    if (parsed && typeof parsed === 'object' && 'siteCode' in parsed) {
      payloadSiteCode = typeof parsed.siteCode === 'string' ? parsed.siteCode : null
    }
  } catch {
    // body 不是 JSON - 鉴权仍按 rawBody 走, 但 siteCode 留 null
  }

  const auth = verifySyncPackageRequest({
    siteCode: headers.siteCode,
    timestamp: headers.timestamp,
    nonce: headers.nonce,
    signature: headers.signature,
    rawBody,
    payloadSiteCode,
  })

  if (!auth.ok) {
    console.warn(`[sync/package] auth failed: ${auth.code} ${auth.message}`)
    return authErrorResponse(auth.message, auth.code)
  }

  const devWarning = auth.warning

  try {
    return await handleSyncPackage({
      rawBody,
      headers,
      devWarning,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : '未知异常'
    console.error(`[sync/package] unhandled: ${errorMessage}`, err)
    return NextResponse.json(
      { code: 500, message: errorMessage },
      { status: 500 }
    )
  }
}

async function handleSyncPackage(input: {
  rawBody: string
  headers: ReturnType<typeof extractAuthHeaders>
  devWarning?: string
}): Promise<NextResponse> {
  const { rawBody, headers, devWarning } = input

  // 2. JSON 解析 (已鉴权, 业务层解析)
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { code: 400, message: 'invalid JSON' },
      { status: 400 }
    )
  }

  // 3. 校验
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
  if (!p.siteCode || p.siteCode.length === 0) {
    return NextResponse.json(
      { code: 400, message: 'siteCode required' },
      { status: 400 }
    )
  }

  const registry = parsePackageRegistryFields(p as unknown as Record<string, unknown>)
  await ensureSyncSite(p.siteCode, registry)

  // 4. 幂等检查
  const existing = await findPackageByBatch(p.siteCode, p.batchId)
  if (existing) {
    if (existing.status === 'success') {
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
      const headers2: Record<string, string> = {}
      if (devWarning) headers2['x-auth-warning'] = devWarning
      return NextResponse.json(response, { headers: Object.keys(headers2).length > 0 ? headers2 : undefined })
    }
    // running/failed 状态允许重试: 复用现有 log
  }

  // 5. 创建 package log
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
      authMode: headers.signature ? 'signed' : 'dev-bypass',
    },
  })

  await markPackageRunning(packageLog.id)

  // 6. 派发到各表
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
      syncMode: table.syncMode,
    })

    totalRecords += result.upserted

    if (result.status === 'success' || result.status === 'partial') {
      successCount++
      await markTableSuccess(tableLog.id, {
        // Sprint 2H.2: 真实处理数 (upserted), 不是 recordCount 假数
        processedRecordCount: result.upserted,
        insertedCount: result.inserted,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        failedCount: result.failed,
      })
    } else {
      // status: 'failed' | 'skipped'
      failedCount++
      await markTableFailed(tableLog.id, {
        errorMessage: result.errorMessage ?? result.status,
        processedRecordCount: result.upserted,
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
      inserted: result.inserted,
      updated: result.updated,
      deleted: result.deleted,
      failed: result.failed,
      errorMessage: result.errorMessage,
    })
  }

  // 7. 更新 package log
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

  const responseHeaders: Record<string, string> = {}
  if (devWarning) responseHeaders['x-auth-warning'] = devWarning
  return NextResponse.json(response, {
    status: failedCount === 0 ? 200 : 207,
    headers: Object.keys(responseHeaders).length > 0 ? responseHeaders : undefined,
  })
}
