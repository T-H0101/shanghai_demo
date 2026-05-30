/**
 * Ingest 统一错误响应格式
 * Sprint 2B.6 - Tasks Ingest API
 */

import { NextResponse } from 'next/server'
import type { IngestErrorResponse } from './types'

/**
 * 错误码枚举
 */
export const ERROR_CODES = {
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_BATCH: 'DUPLICATE_BATCH',
  UNSUPPORTED_SOURCE_TABLE: 'UNSUPPORTED_SOURCE_TABLE',
  RECORD_LIMIT_EXCEEDED: 'RECORD_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/**
 * HTTP 状态码映射
 */
const HTTP_STATUS_MAP: Record<string, number> = {
  [ERROR_CODES.AUTH_ERROR]: 401,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.DUPLICATE_BATCH]: 409,
  [ERROR_CODES.UNSUPPORTED_SOURCE_TABLE]: 400,
  [ERROR_CODES.RECORD_LIMIT_EXCEEDED]: 413,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: string,
  message: string,
  errors?: IngestErrorResponse['errors']
): NextResponse<IngestErrorResponse> {
  const statusCode = HTTP_STATUS_MAP[code] || 500

  const response: IngestErrorResponse = {
    status: 'error',
    code,
    message,
    ...(errors && { errors }),
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * 认证失败
 */
export function authError(message: string = 'API Key missing or invalid') {
  return createErrorResponse(ERROR_CODES.AUTH_ERROR, message)
}

/**
 * siteCode 与 API Key 不匹配
 * HTTP 403 Forbidden
 */
export function authMismatchError(siteCode: string) {
  const response: IngestErrorResponse = {
    status: 'error',
    code: ERROR_CODES.AUTH_ERROR,
    message: `API Key does not match siteCode: ${siteCode}`,
  }
  return NextResponse.json(response, { status: 403 })
}

/**
 * 字段校验失败
 */
export function validationError(
  message: string,
  errors?: IngestErrorResponse['errors']
) {
  return createErrorResponse(ERROR_CODES.VALIDATION_ERROR, message, errors)
}

/**
 * 批次重复但内容不一致
 */
export function duplicateBatchError(batchId: string) {
  return createErrorResponse(
    ERROR_CODES.DUPLICATE_BATCH,
    `Batch ${batchId} already processed with different content`
  )
}

/**
 * 不支持的源表
 */
export function unsupportedSourceTableError(table: string) {
  return createErrorResponse(
    ERROR_CODES.UNSUPPORTED_SOURCE_TABLE,
    `Unsupported source table: ${table}`
  )
}

/**
 * 超过记录数限制
 */
export function recordLimitExceededError(count: number, limit: number) {
  return createErrorResponse(
    ERROR_CODES.RECORD_LIMIT_EXCEEDED,
    `Record count ${count} exceeds limit ${limit}`,
    [
      {
        field: 'records',
        expected: limit,
        actual: count,
        message: 'Records array length exceeds maximum limit',
      },
    ]
  )
}

/**
 * 数据库错误
 */
export function databaseError(message: string) {
  return createErrorResponse(ERROR_CODES.DATABASE_ERROR, message)
}
