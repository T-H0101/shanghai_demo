/**
 * Sprint 2C.17 - package log smoke test
 *
 * This script creates one package log and two table logs, marks one table
 * success and one failed, then verifies batch lookup and list queries.
 */

import {
  createPackageLog,
  createTableLog,
  findPackageByBatch,
  listPackageLogs,
  listTableLogs,
  markPackageFailed,
  markTableFailed,
  markTableSuccess,
} from '../lib/sync/package-log'
import { closePool, query } from '../lib/db'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

async function main() {
  const batchId = `TEST-PKG-${Date.now()}`
  const siteCode = 'TEST_LOG'

  const packageLog = await createPackageLog({
    siteCode,
    batchId,
    mode: 'full',
    version: '1.0',
    snapshotAt: new Date().toISOString(),
    packageChecksum: `sha256:${batchId}`,
    tableCount: 2,
    totalRecordCount: 3,
    rawMetadata: { source: 'test-package-log' },
  })

  const taskTable = await createTableLog({
    packageLogId: packageLog.id,
    siteCode,
    batchId,
    tableName: 'tbl_task',
    syncMode: 'full',
    tableChecksum: `sha256:${batchId}:tbl_task`,
    expectedRecordCount: 2,
  })

  const deviceTable = await createTableLog({
    packageLogId: packageLog.id,
    siteCode,
    batchId,
    tableName: 'tbl_disc_lib',
    syncMode: 'full',
    tableChecksum: `sha256:${batchId}:tbl_disc_lib`,
    expectedRecordCount: 1,
  })

  await markTableSuccess(taskTable.id, {
    processedRecordCount: 2,
    insertedCount: 1,
    updatedCount: 1,
  })

  await markTableFailed(deviceTable.id, {
    errorMessage: 'smoke test failure',
    processedRecordCount: 1,
    failedCount: 1,
  })

  await markPackageFailed(packageLog.id, {
    errorMessage: 'one table failed',
    successTableCount: 1,
    failedTableCount: 1,
  })

  const found = await findPackageByBatch(siteCode, batchId)
  if (!found || found.id !== packageLog.id) {
    throw new Error('findPackageByBatch did not return the created package')
  }

  const duplicatePackageLog = await createPackageLog({
    siteCode,
    batchId,
    mode: 'full',
    version: '1.0',
    snapshotAt: new Date().toISOString(),
    packageChecksum: `sha256:${batchId}`,
    tableCount: 2,
    totalRecordCount: 3,
    rawMetadata: { source: 'test-package-log-duplicate' },
  })
  if (duplicatePackageLog.id !== packageLog.id) {
    throw new Error('duplicate batch created a second package log')
  }

  const duplicateCount = await query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM sync_package_log WHERE site_code = $1 AND batch_id = $2',
    [siteCode, batchId]
  )
  if (duplicateCount.rows[0]?.count !== '1') {
    throw new Error(`expected duplicate count 1, got ${duplicateCount.rows[0]?.count}`)
  }

  const packages = await listPackageLogs({ siteCode, limit: 5 })
  if (!packages.some((item) => item.id === packageLog.id)) {
    throw new Error('listPackageLogs did not include the created package')
  }

  const tables = await listTableLogs(packageLog.id)
  if (tables.length !== 2) {
    throw new Error(`expected 2 table logs, got ${tables.length}`)
  }

  console.log(JSON.stringify({
    status: 'ok',
    packageLogId: packageLog.id,
    batchId,
    tableLogs: tables.map((table) => ({
      tableName: table.table_name,
      status: table.status,
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('[test-package-log] failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
