/**
 * File Index Importer
 * Sprint 2C.18B - 整合层：读文件 → 读目录 → 映射 → UPSERT
 *
 * 完整流程：
 * 1. 检查幂等 (batchId)
 * 2. 创建 package log
 * 3. 读取 tbl_file (taskId + watermark + limit)
 * 4. 读取 tbl_folder (关联 folder_id)
 * 5. 映射记录
 * 6. UPSERT in transaction
 * 7. 更新 package/table logs
 */

import { readFileIndexRecords } from './file-index-reader'
import { readFolderIndexRecords } from './folder-index-reader'
import { mapFileIndexRecords } from './file-index-mapper'
import { mapFolderIndexRecords } from './folder-index-mapper'
import { upsertFileIndexesInTransaction } from './file-index-upsert'
import { upsertFolderIndexesInTransaction } from './folder-index-upsert'
import {
  findPackageByBatch,
  createPackageLog,
  markPackageRunning,
  markPackageSuccess,
  markPackageFailed,
  createTableLog,
  markTableSuccess,
} from '@/lib/sync/package-log'
import { transaction } from '@/lib/db'
import type {
  FileIndexImportConfig,
  FileIndexImportResult,
  RawMetadata,
} from './types'

const MODE = 'file-index'
const FILE_TABLE = 'tbl_file'
const FOLDER_TABLE = 'tbl_folder'

/**
 * 导入任务级文件索引
 *
 * @param config 导入配置
 */
export async function importFileIndex(
  config: FileIndexImportConfig
): Promise<FileIndexImportResult> {
  const { siteCode, taskId, fromId, limit, batchId } = config
  const startTime = Date.now()

  console.log(
    `[FileIndexImporter] Starting: site=${siteCode}, task=${taskId}, batch=${batchId}`
  )
  console.log(`[FileIndexImporter] fromId=${fromId}, limit=${limit}`)

  // 1. 检查幂等：batchId 是否已执行过
  const existingPackage = await findPackageByBatch(siteCode, batchId)
  if (existingPackage) {
    if (existingPackage.status === 'success') {
      console.log(
        `[FileIndexImporter] Batch ${batchId} already completed, skipping.`
      )
      return {
        status: 'duplicated',
        batchId,
        fileCount: 0,
        folderCount: 0,
        errorMessage: 'Batch already completed',
      }
    }
    if (existingPackage.status === 'running') {
      console.log(`[FileIndexImporter] Batch ${batchId} is running, skipping.`)
      return {
        status: 'duplicated',
        batchId,
        fileCount: 0,
        folderCount: 0,
        errorMessage: 'Batch is currently running',
      }
    }
    if (existingPackage.status === 'failed') {
      // failed 状态允许重试：继续往下走，覆盖已有 failed 记录
      console.log(
        `[FileIndexImporter] Batch ${batchId} previously failed, retrying.`
      )
    }
  }

  // 2. 创建 package log
  const rawMetadata: RawMetadata = {
    batch_id: batchId,
    task_id: taskId,
    from_id: fromId,
    limit,
  }

  let packageLogId: string | null = null
  try {
    const packageLog = await createPackageLog({
      siteCode,
      batchId,
      mode: MODE,
      status: 'running',
      tableCount: 2,
      rawMetadata: rawMetadata as unknown as Record<string, unknown>,
    })
    packageLogId = packageLog.id
    // createPackageLog 的 ON CONFLICT 不会更新 status，显式重置为 running
    await markPackageRunning(packageLog.id)
  } catch (err) {
    console.error(`[FileIndexImporter] Failed to create package log: ${err}`)
    throw new Error('Cannot proceed without package log')
  }

  try {
    // 3. 读取文件记录
    console.log(`[FileIndexImporter] Reading file records from tbl_file...`)
    const { rows: fileRows, recordCount: fileReadCount } =
      await readFileIndexRecords(siteCode, taskId, fromId, limit)

    if (fileReadCount === 0) {
      console.log(`[FileIndexImporter] No file records found for task ${taskId}`)
      await markPackageSuccess(packageLogId, {
        tableCount: 2,
        totalRecordCount: 0,
        successTableCount: 2,
      })
      return { status: 'success', batchId, fileCount: 0, folderCount: 0 }
    }

    console.log(`[FileIndexImporter] Read ${fileReadCount} file records`)

    // 4. 读取目录记录（根据文件关联的 folder_id）
    const folderIds = [
      ...new Set(
        fileRows.filter((r) => r.folder_id).map((r) => r.folder_id as number)
      ),
    ]

    let folderRows: Awaited<
      ReturnType<typeof readFolderIndexRecords>
    >['rows'] = []
    let folderReadCount = 0

    if (folderIds.length > 0) {
      console.log(
        `[FileIndexImporter] Reading ${folderIds.length} folder records...`
      )
      const folderResult = await readFolderIndexRecords(siteCode, folderIds)
      folderRows = folderResult.rows
      folderReadCount = folderResult.recordCount
      console.log(`[FileIndexImporter] Read ${folderReadCount} folder records`)
    }

    // 5. 映射记录
    console.log(`[FileIndexImporter] Mapping records...`)
    const fileRecords = mapFileIndexRecords(
      fileRows,
      siteCode,
      batchId,
      taskId,
      fromId,
      limit
    )
    const folderRecords = mapFolderIndexRecords(folderRows, siteCode, batchId)

    // 6. 创建 table logs
    const fileTableLog = await createTableLog({
      packageLogId: packageLogId!,
      siteCode,
      batchId,
      tableName: FILE_TABLE,
      syncMode: MODE,
      expectedRecordCount: fileReadCount,
      status: 'running',
    })

    const folderTableLog = await createTableLog({
      packageLogId: packageLogId!,
      siteCode,
      batchId,
      tableName: FOLDER_TABLE,
      syncMode: MODE,
      expectedRecordCount: folderReadCount,
      status: 'running',
    })

    // 7. UPSERT in transaction
    console.log(`[FileIndexImporter] UPSERTing records...`)

    await transaction(async (client) => {
      await upsertFileIndexesInTransaction(fileRecords, client)
      await upsertFolderIndexesInTransaction(folderRecords, client)
    })

    // 8. 更新 table logs
    await markTableSuccess(fileTableLog.id, {
      processedRecordCount: fileReadCount,
      insertedCount: fileReadCount, // 简化，实际应从 upsert 返回
      updatedCount: 0,
    })

    await markTableSuccess(folderTableLog.id, {
      processedRecordCount: folderReadCount,
      insertedCount: folderReadCount,
      updatedCount: 0,
    })

    // 9. 更新 package log
    await markPackageSuccess(packageLogId, {
      tableCount: 2,
      totalRecordCount: fileReadCount + folderReadCount,
      successTableCount: 2,
    })

    const duration = Date.now() - startTime
    console.log(
      `[FileIndexImporter] Done: ${fileReadCount} files, ${folderReadCount} folders`
    )
    console.log(`[FileIndexImporter] Duration: ${duration}ms`)

    return {
      status: 'success',
      batchId,
      fileCount: fileReadCount,
      folderCount: folderReadCount,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[FileIndexImporter] Error: ${errorMessage}`)

    if (packageLogId) {
      await markPackageFailed(packageLogId, {
        errorMessage,
      })
    }

    return {
      status: 'failed',
      batchId,
      fileCount: 0,
      folderCount: 0,
      errorMessage,
    }
  }
}