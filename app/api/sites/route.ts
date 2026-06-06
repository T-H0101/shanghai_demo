/**
 * GET /api/sites
 * Sprint 2E.2 - 站点中心表列表 (优先真实, fallback mock)
 */

import { NextRequest, NextResponse } from "next/server"
import { sites as mockSites } from "@/lib/mock/sites"
import { adaptSiteList } from "@/lib/api/adapters"
import { listFromTable } from "@/lib/api/list-helper"
import type { ApiResponse, SiteDTO } from "@/lib/api/dto"

interface SiteItem {
  id: string
  sourceSiteId: string
  sourceTable: string
  sourceId: string
  siteCode: string | null
  siteName: string | null
  status: string | null
  location: string | null
  endpointUrl: string | null
  description: string | null
  createdAt: string
}

export async function GET(request: NextRequest) {
  let dbResponse: Response | null = null
  try {
    dbResponse = await listFromTable<SiteItem>(
      {
        sourceTable: 'unified_sites',
        sourceSiteIdColumn: 'source_site_id',
        selectColumns: `
          id::text,
          source_site_id AS "sourceSiteId",
          source_table AS "sourceTable",
          source_id AS "sourceId",
          site_code AS "siteCode",
          site_name AS "siteName",
          status,
          location,
          endpoint_url AS "endpointUrl",
          description,
          created_at::text AS "createdAt"
        `,
        keywordColumn: 'site_name',
        statusColumn: 'status',
      },
      request
    )
  } catch (err) {
    console.warn('[API/sites] center DB query failed, fallback to mock:', err)
  }

  if (dbResponse && dbResponse.ok) {
    const body = await dbResponse.clone().json()
    if (body?.data?.items?.length > 0) {
      return dbResponse
    }
  }

  // Fallback: mock
  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get("status")

  let filteredSites = [...mockSites]
  if (status) {
    filteredSites = filteredSites.filter(s => s.status === status)
  }

  const adaptedSites = adaptSiteList(filteredSites)
  const response: ApiResponse<SiteDTO[]> = {
    code: 0,
    message: "ok",
    data: adaptedSites,
    traceId: `api-${Date.now()}`,
  }
  return NextResponse.json(response)
}