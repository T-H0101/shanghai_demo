/**
 * API 统一成功/失败响应
 * - 业务失败：调用方传入中文 message
 * - 未预期运行时异常：一律「未知异常」，原始错误只打日志
 */

import { NextResponse } from "next/server"
import {
  BAD_REQUEST_MESSAGE,
  FORBIDDEN_MESSAGE,
  NOT_FOUND_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
  UNKNOWN_EXCEPTION_MESSAGE,
} from "@/lib/api/http-error"

export { UNKNOWN_EXCEPTION_MESSAGE }

export function newTraceId(): string {
  return `api-${Date.now()}`
}

export type ApiOkBody<T> = {
  code: 0
  message: string
  data: T
  traceId: string
} & Record<string, unknown>

export type ApiFailBody = {
  code: number
  message: string
  data: null
  traceId: string
  error?: string
} & Record<string, unknown>

export function apiOk<T>(
  data: T,
  extra?: Record<string, unknown>,
  init?: ResponseInit,
): NextResponse {
  const body: ApiOkBody<T> = {
    code: 0,
    message: "ok",
    data,
    traceId: newTraceId(),
    ...extra,
  }
  return NextResponse.json(body, init)
}

export function apiFail(opts: {
  status?: number
  code?: number
  message: string
  error?: string
  extra?: Record<string, unknown>
}): NextResponse {
  const status = opts.status ?? 400
  const body: ApiFailBody = {
    code: opts.code ?? status,
    message: opts.message,
    data: null,
    traceId: newTraceId(),
    ...(opts.error ? { error: opts.error } : {}),
    ...opts.extra,
  }
  return NextResponse.json(body, { status })
}

export function apiBadRequest(message = BAD_REQUEST_MESSAGE, error?: string) {
  return apiFail({ status: 400, message, error })
}

export function apiUnauthorized(message = SESSION_EXPIRED_MESSAGE) {
  return apiFail({ status: 401, message, error: "AUTH_UNAUTHENTICATED" })
}

export function apiForbidden(message = FORBIDDEN_MESSAGE) {
  return apiFail({ status: 403, message, error: "AUTH_FORBIDDEN" })
}

export function apiNotFound(message = NOT_FOUND_MESSAGE) {
  return apiFail({ status: 404, message })
}

/**
 * 捕获未预期异常：日志保留原文，响应对用户仅「未知异常」。
 * AuthError / 其它已构造的 NextResponse 原样返回。
 */
export function apiUnknownException(
  err: unknown,
  logLabel?: string,
): NextResponse {
  if (err instanceof NextResponse) return err
  const label = logLabel ? `[API] ${logLabel}` : "[API]"
  console.error(label, err)
  return apiFail({
    status: 500,
    code: 500,
    message: UNKNOWN_EXCEPTION_MESSAGE,
  })
}

/** 路由 catch 推荐写法：return handleRouteError(err, "/api/xxx") */
export function handleRouteError(err: unknown, logLabel?: string): NextResponse {
  return apiUnknownException(err, logLabel)
}

/** 将可能泄露的系统文案压成用户可见文案（写响应前可选） */
export function sanitizePublicMessage(message: string | null | undefined): string {
  const raw = (message ?? "").trim()
  if (!raw) return UNKNOWN_ERROR_MESSAGE
  if (raw === UNKNOWN_EXCEPTION_MESSAGE) return UNKNOWN_EXCEPTION_MESSAGE
  if (
    /internal server error|unknown error|^unknown$|invalid request|econnrefused|password|sql|stack/i.test(
      raw,
    )
  ) {
    return UNKNOWN_EXCEPTION_MESSAGE
  }
  if (!/[\u4e00-\u9fff]/.test(raw)) return UNKNOWN_ERROR_MESSAGE
  return raw.length <= 80 ? raw : UNKNOWN_ERROR_MESSAGE
}
