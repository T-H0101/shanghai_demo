/**
 * User/Site/Platform UPSERT
 * Sprint 2E.2
 *
 * 三张表都使用 ON CONFLICT DO UPDATE
 * 幂等策略: (source_site_id, source_table, source_id)
 */

import type { PoolClient } from 'pg'
import { transaction } from '@/lib/db'
import type { UnifiedUserRecord, UnifiedSiteRecord, UnifiedPlatformRecord } from './types'

export interface UpsertResult {
  insertedCount: number
  updatedCount: number
  skippedCount: number
}

// ============================================================
// Users
// ============================================================
export async function upsertUsersInTransaction(
  records: UnifiedUserRecord[],
  client?: PoolClient
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
  }

  const sql = `
    INSERT INTO unified_users (
      source_site_id, source_table, source_id,
      user_id, username, display_name, status, role,
      department, phone, email,
      raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      status = EXCLUDED.status,
      role = EXCLUDED.role,
      department = EXCLUDED.department,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      raw_data = EXCLUDED.raw_data,
      synced_at = NOW(),
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `

  const execute = async (c: PoolClient) => {
    let inserted = 0
    let updated = 0
    for (const r of records) {
      const result = await c.query(sql, [
        r.source_site_id,
        r.source_table,
        r.source_id,
        r.user_id,
        r.username,
        r.display_name,
        r.status,
        r.role,
        r.department,
        r.phone,
        r.email,
        JSON.stringify(r.raw_data),
      ])
      if (result.rows[0]?.inserted) inserted++
      else updated++
    }
    return { insertedCount: inserted, updatedCount: updated, skippedCount: 0 }
  }

  if (client) return execute(client)
  return transaction(execute)
}

// ============================================================
// Sites
// ============================================================
export async function upsertSitesInTransaction(
  records: UnifiedSiteRecord[],
  client?: PoolClient
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
  }

  const sql = `
    INSERT INTO unified_sites (
      source_site_id, source_table, source_id,
      site_code, site_name, status, location, endpoint_url, description,
      raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      site_code = EXCLUDED.site_code,
      site_name = EXCLUDED.site_name,
      status = EXCLUDED.status,
      location = EXCLUDED.location,
      endpoint_url = EXCLUDED.endpoint_url,
      description = EXCLUDED.description,
      raw_data = EXCLUDED.raw_data,
      synced_at = NOW(),
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `

  const execute = async (c: PoolClient) => {
    let inserted = 0
    let updated = 0
    for (const r of records) {
      const result = await c.query(sql, [
        r.source_site_id,
        r.source_table,
        r.source_id,
        r.site_code,
        r.site_name,
        r.status,
        r.location,
        r.endpoint_url,
        r.description,
        JSON.stringify(r.raw_data),
      ])
      if (result.rows[0]?.inserted) inserted++
      else updated++
    }
    return { insertedCount: inserted, updatedCount: updated, skippedCount: 0 }
  }

  if (client) return execute(client)
  return transaction(execute)
}

// ============================================================
// Platforms
// ============================================================
export async function upsertPlatformsInTransaction(
  records: UnifiedPlatformRecord[],
  client?: PoolClient
): Promise<UpsertResult> {
  if (records.length === 0) {
    return { insertedCount: 0, updatedCount: 0, skippedCount: 0 }
  }

  const sql = `
    INSERT INTO unified_platforms (
      source_site_id, source_table, source_id,
      platform_id, platform_name, platform_type, status, version, endpoint_url,
      raw_data
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
    )
    ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
      platform_id = EXCLUDED.platform_id,
      platform_name = EXCLUDED.platform_name,
      platform_type = EXCLUDED.platform_type,
      status = EXCLUDED.status,
      version = EXCLUDED.version,
      endpoint_url = EXCLUDED.endpoint_url,
      raw_data = EXCLUDED.raw_data,
      synced_at = NOW(),
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `

  const execute = async (c: PoolClient) => {
    let inserted = 0
    let updated = 0
    for (const r of records) {
      const result = await c.query(sql, [
        r.source_site_id,
        r.source_table,
        r.source_id,
        r.platform_id,
        r.platform_name,
        r.platform_type,
        r.status,
        r.version,
        r.endpoint_url,
        JSON.stringify(r.raw_data),
      ])
      if (result.rows[0]?.inserted) inserted++
      else updated++
    }
    return { insertedCount: inserted, updatedCount: updated, skippedCount: 0 }
  }

  if (client) return execute(client)
  return transaction(execute)
}