/**
 * Generic List API Helper
 * 通用列表查询 + 分页 + keyword + status 过滤
 * Sprint 2E.2
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import type { QueryResultRow } from 'pg'

export interface ListApiOptions {
  sourceTable: string // 中心表名
  sourceSiteIdColumn: string // 通常 source_site_id
  selectColumns: string // SELECT 子句
  keywordColumn?: string // 用于 ILIKE 搜索的列
  statusColumn?: string // 状态列名
}

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export interface ApiListResponse<T> {
  code: number
  message: string
  source: 'database'
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
  }
}

export function parseListParams(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(sp.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const keyword = sp.get('keyword') ?? ''
  const status = sp.get('status') ?? ''
  const siteCode = sp.get('siteCode') ?? ''
  return { page, pageSize, keyword, status, siteCode }
}

export function buildWhereClause(
  siteCode: string,
  status: string,
  keyword: string,
  keywordColumn: string | undefined,
  statusColumn: string | undefined
): { sql: string; params: unknown[] } {
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (siteCode) {
    conditions.push(`source_site_id = $${i++}`)
    params.push(siteCode)
  }
  if (status && statusColumn) {
    conditions.push(`${statusColumn} = $${i++}`)
    params.push(status)
  }
  if (keyword && keywordColumn) {
    conditions.push(`${keywordColumn} ILIKE $${i++}`)
    params.push(`%${keyword}%`)
  }
  const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { sql, params }
}

export async function listFromTable<T extends QueryResultRow>(
  options: ListApiOptions,
  request: NextRequest
): Promise<NextResponse> {
  const { page, pageSize, keyword, status, siteCode } = parseListParams(request)
  const { sql: whereSql, params: whereParams } = buildWhereClause(
    siteCode,
    status,
    keyword,
    options.keywordColumn,
    options.statusColumn
  )

  try {
    const countSql = `SELECT COUNT(*)::text AS count FROM ${options.sourceTable} ${whereSql}`
    const countResult = await query<{ count: string }>(countSql, whereParams)
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

    const offset = (page - 1) * pageSize
    const listSql = `
      SELECT ${options.selectColumns}
      FROM ${options.sourceTable}
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
    `
    const rows = await query<T>(listSql, [...whereParams, pageSize, offset])

    const response: ApiListResponse<T> = {
      code: 0,
      message: 'ok',
      source: 'database',
      data: { items: rows.rows, total, page, pageSize },
    }
    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[API/list] ${options.sourceTable} Error: ${errorMessage}`)
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