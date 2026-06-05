/**
 * GET /api/tasks/[id]/files
 * Sprint 2C.19 - 任务文件列表 API
 *
 * 只查 unified_file_index，不直连 source_restore
 * 不触发导入
 *
 * Query params:
 *   page (default: 1)
 *   pageSize (default: 50, max: 200)
 *   keyword (optional, file_name ILIKE search)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface FileIndexItem {
  id: string
  source_id: string
  file_name: string
  file_size: string | null
  content_type: string | null
  hash: string | null
  folder_source_id: string | null
  indexed_at: string
  batch_id: string
}

interface ApiResponse {
  code: number
  message: string
  source: 'database' | 'empty-index'
  indexStatus: 'ready' | 'missing'
  data: {
    items: FileIndexItem[]
    page: number
    pageSize: number
    total: number
  }
}

/**
 * GET /api/tasks/[id]/files
 * 查询任务的索引文件列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(
    1,
    parseInt(searchParams.get('page') ?? '1', 10) || 1
  )
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50)
  )
  const keyword = searchParams.get('keyword') ?? ''

  try {
    // 先从 unified_tasks 获取 site_code
    const taskResult = await query<{ source_site_id: string }>(
      `SELECT source_site_id FROM unified_tasks WHERE source_id = $1 LIMIT 1`,
      [taskId]
    )

    if (taskResult.rows.length === 0) {
      return NextResponse.json<ApiResponse>({
        code: 0,
        message: 'ok',
        source: 'empty-index',
        indexStatus: 'missing',
        data: {
          items: [],
          page,
          pageSize,
          total: 0,
        },
      })
    }

    const siteCode = taskResult.rows[0].source_site_id

    // 构建 WHERE 条件
    const conditions = ['task_source_id = $1']
    const params: (string | number)[] = [taskId]
    let paramIndex = 2

    if (keyword) {
      conditions.push(`file_name ILIKE $${paramIndex}`)
      params.push(`%${keyword}%`)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // 查询总数
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM unified_file_index WHERE ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    // 查询分页数据
    const dataResult = await query<FileIndexItem>(
      `SELECT
        id::text, source_id, file_name, file_size::text, content_type,
        hash, folder_source_id, indexed_at::text, batch_id
       FROM unified_file_index
       WHERE ${whereClause}
       ORDER BY source_id ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, (page - 1) * pageSize]
    )

    return NextResponse.json<ApiResponse>({
      code: 0,
      message: 'ok',
      source: total > 0 ? 'database' : 'empty-index',
      indexStatus: total > 0 ? 'ready' : 'missing',
      data: {
        items: dataResult.rows,
        page,
        pageSize,
        total,
      },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[API/tasks/files] Error: ${errorMessage}`)
    return NextResponse.json<ApiResponse>(
      {
        code: 500,
        message: 'Internal server error',
        source: 'empty-index',
        indexStatus: 'missing',
        data: {
          items: [],
          page,
          pageSize,
          total: 0,
        },
      },
      { status: 500 }
    )
  }
}