/**
 * User/Site/Platform Importer
 * Sprint 2E.2
 *
 * 读 source_restore -> 映射 -> 写 unified_*
 * 使用 sourceQuery() 读源, query()/transaction() 写中心
 */

import { sourceQuery } from '@/lib/db/source-pool'
import { upsertUsersInTransaction, upsertSitesInTransaction, upsertPlatformsInTransaction } from './upsert'
import { mapUser, mapSite, mapPlatform } from './mapper'
import type { ImportTarget } from './types'

export interface ImportResult {
  target: ImportTarget
  readCount: number
  upserted: number
  durationMs: number
}

/**
 * 导入 users
 */
export async function importUsers(siteCode: string): Promise<ImportResult> {
  const start = Date.now()
  console.log(`[ImportUsers] site=${siteCode} reading...`)

  try {
    const { rows } = await sourceQuery<Record<string, unknown>>(
      'SELECT * FROM tbl_user ORDER BY user_id'
    )
    console.log(`[ImportUsers] Read ${rows.length} users`)

    if (rows.length === 0) {
      return { target: 'users', readCount: 0, upserted: 0, durationMs: Date.now() - start }
    }

    const records = rows.map((r) => mapUser(r, siteCode))
    const result = await upsertUsersInTransaction(records)

    const duration = Date.now() - start
    console.log(
      `[ImportUsers] Done: ${result.insertedCount} inserted, ${result.updatedCount} updated, ${duration}ms`
    )
    return {
      target: 'users',
      readCount: rows.length,
      upserted: result.insertedCount + result.updatedCount,
      durationMs: duration,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ImportUsers] Error: ${msg}`)
    throw err
  }
}

/**
 * 导入 sites
 */
export async function importSites(siteCode: string): Promise<ImportResult> {
  const start = Date.now()
  console.log(`[ImportSites] site=${siteCode} reading...`)

  try {
    const { rows } = await sourceQuery<Record<string, unknown>>(
      'SELECT * FROM tbl_site ORDER BY site_id'
    )
    console.log(`[ImportSites] Read ${rows.length} sites`)

    if (rows.length === 0) {
      return { target: 'sites', readCount: 0, upserted: 0, durationMs: Date.now() - start }
    }

    const records = rows.map((r) => mapSite(r, siteCode))
    const result = await upsertSitesInTransaction(records)

    const duration = Date.now() - start
    console.log(
      `[ImportSites] Done: ${result.insertedCount} inserted, ${result.updatedCount} updated, ${duration}ms`
    )
    return {
      target: 'sites',
      readCount: rows.length,
      upserted: result.insertedCount + result.updatedCount,
      durationMs: duration,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ImportSites] Error: ${msg}`)
    throw err
  }
}

/**
 * 导入 platforms
 */
export async function importPlatforms(siteCode: string): Promise<ImportResult> {
  const start = Date.now()
  console.log(`[ImportPlatforms] site=${siteCode} reading...`)

  try {
    const { rows } = await sourceQuery<Record<string, unknown>>(
      'SELECT * FROM tbl_platform ORDER BY plat_id'
    )
    console.log(`[ImportPlatforms] Read ${rows.length} platforms`)

    if (rows.length === 0) {
      return { target: 'platforms', readCount: 0, upserted: 0, durationMs: Date.now() - start }
    }

    const records = rows.map((r) => mapPlatform(r, siteCode))
    const result = await upsertPlatformsInTransaction(records)

    const duration = Date.now() - start
    console.log(
      `[ImportPlatforms] Done: ${result.insertedCount} inserted, ${result.updatedCount} updated, ${duration}ms`
    )
    return {
      target: 'platforms',
      readCount: rows.length,
      upserted: result.insertedCount + result.updatedCount,
      durationMs: duration,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[ImportPlatforms] Error: ${msg}`)
    throw err
  }
}

/**
 * 一次性导入 users + sites + platforms
 */
export async function importUserSitePlatforms(siteCode: string): Promise<ImportResult[]> {
  console.log(`[ImportUserSitePlatforms] site=${siteCode} starting...`)
  const results: ImportResult[] = []

  try {
    results.push(await importUsers(siteCode))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[ImportUserSitePlatforms] users skipped: ${msg}`)
    results.push({ target: 'users', readCount: 0, upserted: 0, durationMs: 0 })
  }

  try {
    results.push(await importSites(siteCode))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[ImportUserSitePlatforms] sites skipped: ${msg}`)
    results.push({ target: 'sites', readCount: 0, upserted: 0, durationMs: 0 })
  }

  try {
    results.push(await importPlatforms(siteCode))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[ImportUserSitePlatforms] platforms skipped: ${msg}`)
    results.push({ target: 'platforms', readCount: 0, upserted: 0, durationMs: 0 })
  }

  console.log(`[ImportUserSitePlatforms] Summary:`, results)
  return results
}