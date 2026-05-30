/**
 * POST /api/ingest/devices
 * 接收站点推送的 devices 数据包
 * Sprint 2B.7 - devices ingest 扩展
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, validateSiteCodeMatch } from '@/lib/ingest/api-keys'
import { ingestDevices } from '@/lib/ingest/devices-ingest'
import { authError, authMismatchError, validationError, createErrorResponse, ERROR_CODES } from '@/lib/ingest/errors'
import type { IngestRequest } from '@/lib/ingest/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. 获取 API Key
    const apiKey = request.headers.get('x-api-key') || ''
    if (!apiKey) {
      return authError('x-api-key header is required')
    }

    // 2. 校验 API Key
    const matchedSiteCode = validateApiKey(apiKey)
    if (!matchedSiteCode) {
      return authError('Invalid API Key')
    }

    // 3. 解析请求体
    let body: IngestRequest
    try {
      body = await request.json()
    } catch {
      return validationError('Invalid JSON body')
    }

    // 4. 校验 siteCode 与已验证的 siteCode 匹配
    if (!validateSiteCodeMatch(matchedSiteCode, body.siteCode)) {
      return authMismatchError(body.siteCode)
    }

    // 5. 调用 ingest service
    const result = await ingestDevices(body, matchedSiteCode)

    // 6. 返回成功响应
    return NextResponse.json(result)
  } catch (error) {
    // 如果是已知错误响应
    if (error && typeof error === 'object' && 'response' in error) {
      return (error as { response: NextResponse }).response
    }

    // 未知错误
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Ingest Devices API Error]', error)
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, errorMessage)
  }
}
