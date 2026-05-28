/**
 * 系统健康检查接口
 * GET /api/system/health
 *
 * 不依赖数据库的基础健康检查
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const response = {
    service: 'optical-disc-management',
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    checks: {
      api: 'ok',
      memory: process.memoryUsage().heapUsed / 1024 / 1024 < 500 ? 'ok' : 'warning',
    },
  }

  return NextResponse.json(response)
}