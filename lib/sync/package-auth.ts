/**
 * Sprint 2G.1 - /api/sync/package HMAC 鉴权
 *
 * 签名方案:
 * - HTTP 头: x-site-code, x-timestamp, x-nonce, x-signature
 * - 签名内容: HMAC-SHA256(secret, `${timestamp}.${nonce}.${rawBody}`)
 * - 输出: hex
 *
 * 校验顺序 (从最便宜的检查开始):
 * 1. auth mode + secret 是否配置
 * 2. 必需头是否存在
 * 3. timestamp 解析 + 5 分钟窗口
 * 4. siteCode 头 与 payload.siteCode 一致
 * 5. signature 时间安全比较
 *
 * dev mode:
 * - 允许无签名 (仅开发环境)
 * - 响应里带 warning
 * - 生产必须使用 strict
 *
 * 安全:
 * - 使用 crypto.timingSafeEqual 防时间侧信道
 * - 任何错误路径不打印 secret
 * - secret 仅从环境变量读取
 */

import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================
// 错误码常量 (响应和测试脚本共用)
// ============================================================

export const AUTH_ERROR_CODES = {
  OK: 'OK',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  MISSING_HEADER: 'MISSING_HEADER',
  EXPIRED_TIMESTAMP: 'EXPIRED_TIMESTAMP',
  SITE_CODE_MISMATCH: 'SITE_CODE_MISMATCH',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  AUTH_NOT_CONFIGURED: 'AUTH_NOT_CONFIGURED',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  DEV_MODE_WARNING: 'DEV_MODE_WARNING',
} as const

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]

export interface AuthVerifyResult {
  ok: boolean
  code: AuthErrorCode
  message: string
  /** dev 模式且无签名时, 标记 warning */
  warning?: string
}

// ============================================================
// 配置
// ============================================================

export type AuthMode = 'strict' | 'dev'

const DEV_DEFAULT_SECRET = 'TEST_SYNC_SECRET'  // 文档化标明, 仅 dev 使用

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000  // 5 分钟

export interface AuthConfig {
  mode: AuthMode
  secret: string | null
  timestampWindowMs: number
  /** dev 模式是否允许 (即 secret 未配置时不报错) */
  allowUnconfiguredInDev: boolean
}

/**
 * 读取运行时配置 (每次都从 env 读, 支持运行时切换)
 * 不抛错, 返回 null secret 让 verify 决定
 */
export function getSyncPackageAuthConfig(): AuthConfig {
  const modeRaw = (process.env.SYNC_PACKAGE_AUTH_MODE ?? 'strict').toLowerCase()
  const mode: AuthMode = modeRaw === 'dev' ? 'dev' : 'strict'

  let secret = process.env.SYNC_PACKAGE_SECRET ?? ''
  if (!secret && mode === 'dev') {
    // dev 模式缺省 secret, 用 dev default, 但响应里带警告
    secret = DEV_DEFAULT_SECRET
  }

  return {
    mode,
    secret: secret || null,
    timestampWindowMs: TIMESTAMP_WINDOW_MS,
    allowUnconfiguredInDev: mode === 'dev',
  }
}

// ============================================================
// 签名生成 (站点侧 / 测试脚本使用)
// ============================================================

export interface SignParams {
  rawBody: string
  timestamp: string | number
  nonce: string
  secret: string
}

export interface SignResult {
  signature: string
  timestamp: string
  nonce: string
  signingString: string  // 调试用, 不含 secret
}

/**
 * 生成 HMAC-SHA256 签名
 * 输出: 64-char hex
 */
export function signSyncPackageBody(params: SignParams): SignResult {
  const { rawBody, timestamp, nonce, secret } = params
  const tsStr = String(timestamp)
  const signingString = `${tsStr}.${nonce}.${rawBody}`
  const sig = createHmac('sha256', secret)
    .update(signingString, 'utf8')
    .digest('hex')
  return { signature: sig, timestamp: tsStr, nonce, signingString }
}

// ============================================================
// 签名校验 (总控侧使用)
// ============================================================

export interface VerifyParams {
  /** 客户端头 */
  siteCode: string | null
  timestamp: string | null
  nonce: string | null
  signature: string | null
  /** 原始 body 字节, 用于签名 (避免 JSON.stringify 重排) */
  rawBody: string
  /** 当前 payload 的 siteCode (用于和头一致) */
  payloadSiteCode: string | null
  /** 覆盖时钟, 用于测试 (默认 Date.now) */
  now?: number
}

export function verifySyncPackageRequest(params: VerifyParams): AuthVerifyResult {
  const config = getSyncPackageAuthConfig()
  const now = params.now ?? Date.now()

  // 1. strict 模式必须配置 secret
  if (!config.secret) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.AUTH_NOT_CONFIGURED,
      message:
        'SYNC_PACKAGE_SECRET is not configured. Set SYNC_PACKAGE_AUTH_MODE=dev for development only.',
    }
  }

  // 2. dev 模式 + 无签名 → 放行 + warning
  if (
    config.mode === 'dev' &&
    !params.signature &&
    !params.timestamp &&
    !params.nonce &&
    !params.siteCode
  ) {
    return {
      ok: true,
      code: AUTH_ERROR_CODES.OK,
      message: 'ok (dev mode, no signature)',
      warning:
        'Auth bypassed in dev mode. Set SYNC_PACKAGE_AUTH_MODE=strict for production.',
    }
  }

  // 3. 必需头检查
  if (!params.signature) {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_SIGNATURE, message: 'x-signature header is required' }
  }
  if (!params.timestamp) {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_HEADER, message: 'x-timestamp header is required' }
  }
  if (!params.nonce) {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_HEADER, message: 'x-nonce header is required' }
  }
  if (!params.siteCode) {
    return { ok: false, code: AUTH_ERROR_CODES.MISSING_HEADER, message: 'x-site-code header is required' }
  }

  // 4. timestamp 解析 + 5 分钟窗口
  const tsNum = Number(params.timestamp)
  if (!Number.isFinite(tsNum)) {
    return { ok: false, code: AUTH_ERROR_CODES.INVALID_TIMESTAMP, message: 'x-timestamp must be a numeric Unix ms timestamp' }
  }
  const skew = Math.abs(now - tsNum)
  if (skew > config.timestampWindowMs) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.EXPIRED_TIMESTAMP,
      message: `Timestamp skew ${skew}ms exceeds window ${config.timestampWindowMs}ms`,
    }
  }

  // 5. siteCode 头与 payload 一致
  if (params.payloadSiteCode && params.siteCode !== params.payloadSiteCode) {
    return {
      ok: false,
      code: AUTH_ERROR_CODES.SITE_CODE_MISMATCH,
      message: `x-site-code (${params.siteCode}) does not match payload.siteCode (${params.payloadSiteCode})`,
    }
  }

  // 6. 重新计算签名 + 时间安全比较
  const expected = signSyncPackageBody({
    rawBody: params.rawBody,
    timestamp: tsNum,
    nonce: params.nonce,
    secret: config.secret,
  }).signature

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(params.signature, 'hex')
  if (a.length !== b.length || a.length === 0) {
    return { ok: false, code: AUTH_ERROR_CODES.INVALID_SIGNATURE, message: 'Signature length mismatch' }
  }
  const valid = timingSafeEqual(a, b)
  if (!valid) {
    return { ok: false, code: AUTH_ERROR_CODES.INVALID_SIGNATURE, message: 'Signature does not match' }
  }

  return { ok: true, code: AUTH_ERROR_CODES.OK, message: 'ok' }
}

// ============================================================
// 头解析辅助 (从 NextRequest.headers)
// ============================================================

export interface AuthHeaders {
  siteCode: string | null
  timestamp: string | null
  nonce: string | null
  signature: string | null
}

export function extractAuthHeaders(headers: Headers): AuthHeaders {
  return {
    siteCode: headers.get('x-site-code'),
    timestamp: headers.get('x-timestamp'),
    nonce: headers.get('x-nonce'),
    signature: headers.get('x-signature'),
  }
}
