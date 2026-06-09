/**
 * Admin token guard for deprecated/internal endpoints.
 *
 * 用法 (route handler):
 *   import { verifyAdminToken } from '@/lib/auth/admin-token'
 *   export async function POST(req: NextRequest) {
 *     const guard = verifyAdminToken(req)
 *     if (!guard.ok) return guard.response
 *     // ... 业务
 *   }
 *
 * 行为:
 *   - 读取请求头 x-admin-token
 *   - 与 env ADMIN_TOKEN (timingSafeEqual) 比对
 *   - dev 模式 (SYNC_PACKAGE_AUTH_MODE=dev) 且未配置 ADMIN_TOKEN → 放行 + warning
 *   - strict 模式未配置 ADMIN_TOKEN → 503
 *   - token 不匹配 → 401
 *
 * 设计理由:
 *   - 复用既有的 SYNC_PACKAGE_AUTH_MODE 模式 (dev 宽松 / strict 严格)
 *   - 不引入新 middleware, 写接口本地 guard, 风险面最小
 *   - Sprint 5.1 接入 ADFS 时, 替换为 requireSession()
 */
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_TOKEN_HEADER = 'x-admin-token'

export interface AdminGuardOk {
  ok: true
  mode: 'dev' | 'strict'
}

export interface AdminGuardFail {
  ok: false
  response: NextResponse
}

export type AdminGuardResult = AdminGuardOk | AdminGuardFail

function isDevMode(): boolean {
  return (process.env.SYNC_PACKAGE_AUTH_MODE ?? 'strict').toLowerCase() === 'dev'
}

export function verifyAdminToken(request: NextRequest): AdminGuardResult {
  const configured = process.env.ADMIN_TOKEN ?? ''
  const dev = isDevMode()
  const presented = request.headers.get(ADMIN_TOKEN_HEADER) ?? ''

  // 1. dev 模式 + 无 secret + 无 token → 放行 (与 sync/package 行为一致)
  if (dev && !configured && !presented) {
    return { ok: true, mode: 'dev' }
  }

  // 2. strict 模式未配置 → 拒绝 (fail-closed)
  if (!configured) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          status: 'failed',
          error: 'ADMIN_TOKEN not configured. Set ADMIN_TOKEN env or SYNC_PACKAGE_AUTH_MODE=dev for development.',
        },
        { status: 503 }
      ),
    }
  }

  // 3. 无 token → 401
  if (!presented) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: 'failed', error: 'Missing x-admin-token header.' },
        { status: 401 }
      ),
    }
  }

  // 4. timingSafeEqual 比对 (长度不一致直接 false)
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(configured, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: 'failed', error: 'Invalid admin token.' },
        { status: 401 }
      ),
    }
  }

  return { ok: true, mode: dev ? 'dev' : 'strict' }
}
