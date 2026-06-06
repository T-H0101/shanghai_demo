/**
 * GET /api/platforms
 * Sprint 2E.2 - 平台中心表列表
 */

import { NextRequest } from 'next/server'
import { listFromTable } from '@/lib/api/list-helper'

export const dynamic = 'force-dynamic'

interface PlatformItem {
  id: string
  sourceSiteId: string
  sourceTable: string
  sourceId: string
  platformId: string | null
  platformName: string | null
  platformType: string | null
  status: string | null
  version: string | null
  endpointUrl: string | null
  createdAt: string
}

export async function GET(request: NextRequest) {
  return listFromTable<PlatformItem>(
    {
      sourceTable: 'unified_platforms',
      sourceSiteIdColumn: 'source_site_id',
      selectColumns: `
        id::text,
        source_site_id AS "sourceSiteId",
        source_table AS "sourceTable",
        source_id AS "sourceId",
        platform_id AS "platformId",
        platform_name AS "platformName",
        platform_type AS "platformType",
        status,
        version,
        endpoint_url AS "endpointUrl",
        created_at::text AS "createdAt"
      `,
      keywordColumn: 'platform_name',
      statusColumn: 'status',
    },
    request
  )
}