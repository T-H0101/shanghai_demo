/**
 * 数据库健康检查接口
 * GET /api/system/db-health
 *
 * Sprint 2B.0 - 验证 PostgreSQL 连接
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDbHealth } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const health = await checkDbHealth()

  const response = {
    service: 'db-health',
    timestamp: new Date().toISOString(),
    database: {
      status: health.status,
      connected: health.connected,
      latencyMs: health.latencyMs,
      pool: health.poolStats,
      error: health.error,
    },
  }

  const statusCode = health.status === 'healthy' ? 200 : 503

  return NextResponse.json(response, { status: statusCode })
}