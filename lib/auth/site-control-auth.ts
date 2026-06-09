/**
 * Site-control 鉴权 guard.
 *
 * 协议: 与 /api/sync/package 同步协议一致的简化版
 *   - dev 模式 (SYNC_PACKAGE_AUTH_MODE=dev) → 直接放行
 *   - strict 模式 → 校验 x-site-control-signature 头
 *     值必须等于 env SYNC_PACKAGE_SECRET (timingSafeEqual)
 *
 * 设计理由:
 *   - 不修改控制协议 (不变更 header 名称/语义)
 *   - 仅修复时序攻击 (=== → timingSafeEqual)
 *   - Sprint 5.1 接入 ADFS 时, 替换为完整 HMAC + siteCode 校验
 */
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSyncPackageAuthConfig } from '@/lib/sync/package-auth'

const SIG_HEADER = 'x-site-control-signature'

export interface SiteAuthOk {
  ok: true
  mode: 'dev' | 'strict'
}
export interface SiteAuthFail {
  ok: false
  response: NextResponse
}
export type SiteAuthResult = SiteAuthOk | SiteAuthFail

export function verifySiteControlRequest(request: NextRequest): SiteAuthResult {
  const config = getSyncPackageAuthConfig()
  if (config.mode === 'dev') {
    return { ok: true, mode: 'dev' }
  }
  // strict 模式: 必须配置 secret
  if (!config.secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'SYNC_PACKAGE_SECRET not configured. Set env or SYNC_PACKAGE_AUTH_MODE=dev.' },
        { status: 503 }
      ),
    }
  }
  const sig = request.headers.get(SIG_HEADER)
  if (!sig) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `missing ${SIG_HEADER} header` },
        { status: 401 }
      ),
    }
  }
  // timingSafeEqual 要求等长, 不等直接拒
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(config.secret, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `invalid ${SIG_HEADER}` },
        { status: 401 }
      ),
    }
  }
  return { ok: true, mode: 'strict' }
}
