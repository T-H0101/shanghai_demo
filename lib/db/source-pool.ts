/**
 * Source Restore 数据库连接池
 * Sprint 2B.12 - 真实数据导入
 *
 * 独立于 lib/db/postgres.ts，连接 source_restore 数据库。
 * 环境变量 SOURCE_DATABASE_URL 必须配置。
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

let sourcePool: Pool | null = null

export function getSourcePool(): Pool {
  if (!sourcePool) {
    const connectionString = process.env.SOURCE_DATABASE_URL
    if (!connectionString) {
      throw new Error('SOURCE_DATABASE_URL is not configured')
    }
    sourcePool = new Pool({
      connectionString,
      min: 2,
      max: 5,
      idleTimeoutMillis: 30000,
    })
    sourcePool.on('error', (err) => {
      console.error('[SourceDB] Unexpected pool error:', err)
    })
  }
  return sourcePool
}

export async function sourceQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getSourcePool().query<T>(text, params)
}

export async function closeSourcePool(): Promise<void> {
  if (sourcePool) {
    await sourcePool.end()
    sourcePool = null
  }
}
