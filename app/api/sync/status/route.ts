import { NextRequest, NextResponse } from 'next/server'
import { queryProgress } from '@/lib/sync/query'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sync/status
 * 查询同步进度
 *
 * Query params:
 *   - site?: string (可选)
 *   - table?: string (可选)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const site = searchParams.get('site') ?? undefined
  const table = searchParams.get('table') ?? undefined

  try {
    const data = await queryProgress({ site, table })
    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { data: [], error: errorMessage },
      { status: 500 }
    )
  }
}