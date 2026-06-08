import { NextRequest, NextResponse } from 'next/server'
import { syncDevices } from '@/lib/sync/devices-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/devices
 * 触发 devices 同步
 *
 * @deprecated Sprint 2B 早期内部 trigger 端点
 *   - 风险: 无鉴权, 任何人都能 POST 触发全表重同步
 *   - 现状: 已被 Sprint 2D.2 sync/package 取代 (走 HMAC + 鉴权)
 *   - 处置: Sprint 4.7 加 `?admin=1` token 或仅内网 IP
 *   - 详见 docs/summary/CODEBASE_QUALITY_AUDIT.md §3.2
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
