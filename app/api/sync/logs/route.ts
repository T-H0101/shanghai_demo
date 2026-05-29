import { NextRequest, NextResponse } from 'next/server'
import { queryLogs, clampLimit } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/logs
 * 查询同步日志
 *
 * Query params:
 *   - site?: string (可选)
 *   - table?: string (可选)
 *   - limit?: number (可选，默认 10，最大 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get('site') ?? undefined
  const table = searchParams.get('table') ?? undefined
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10)
  const limit = clampLimit(rawLimit)

  try {
    const data = await queryLogs({ site, table }, limit)
    return NextResponse.json({ data, limit })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { data: [], limit, error: errorMessage },
      { status: 500 }
    )
  }
}