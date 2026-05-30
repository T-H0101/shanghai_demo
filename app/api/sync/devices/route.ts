import { NextRequest, NextResponse } from 'next/server'
import { syncDevices } from '@/lib/sync/devices-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/devices
 * 触发 devices 同步
 */
export async function POST(request: NextRequest) {
  try {
    const result = await syncDevices()
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
