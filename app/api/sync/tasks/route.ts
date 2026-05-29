import { NextRequest, NextResponse } from 'next/server'
import { syncTasks } from '@/lib/sync/tasks-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/tasks
 * 触发 tasks 同步
 */
export async function POST(request: NextRequest) {
  try {
    const result = await syncTasks()
    return NextResponse.json(result)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        status: 'failed',
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}