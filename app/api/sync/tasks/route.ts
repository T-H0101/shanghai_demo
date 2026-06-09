import { NextRequest, NextResponse } from 'next/server'
import { syncTasks } from '@/lib/sync/tasks-sync'
import { verifyAdminToken } from '@/lib/auth/admin-token'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sync/tasks
 * 触发 tasks 同步
 *
 * @deprecated Sprint 2B 早期内部 trigger 端点
 *   - 风险: 无鉴权, 任何人都能 POST 触发全表重同步
 *   - 现状: 已被 Sprint 2D.2 sync/package 取代 (走 HMAC + 鉴权)
 *   - 处置 (Sprint 4.7): 加 x-admin-token 头 (env ADMIN_TOKEN)
 *   - 详见 docs/summary/CODEBASE_QUALITY_AUDIT.md §3.2
 */
export async function POST(request: NextRequest) {
  // 鉴权 guard: dev 模式无 token 可用 (与 sync/package 行为一致), strict 模式必须 ADMIN_TOKEN
  const guard = verifyAdminToken(request)
  if (!guard.ok) return guard.response

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