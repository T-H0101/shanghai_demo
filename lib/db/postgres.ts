/**
 * PostgreSQL Client 封装
 * Sprint 2B.0 - 数据库连接配置
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg'

// ============================================================
// 配置
// ============================================================

export interface DbConfig {
  connectionString: string
  minPool?: number
  maxPool?: number
  idleTimeoutMs?: number
}

function getDbConfig(): DbConfig {
  return {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/optical_disc_central',
    minPool: parseInt(process.env.DB_POOL_MIN || '2'),
    maxPool: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
  }
}

// ============================================================
// 连接池单例
// ============================================================

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const config = getDbConfig()
    pool = new Pool({
      connectionString: config.connectionString,
      min: config.minPool,
      max: config.maxPool,
      idleTimeoutMillis: config.idleTimeoutMs,
    })

    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err)
    })
  }
  return pool
}

// ============================================================
// 连接管理
// ============================================================

export async function getClient(): Promise<PoolClient> {
  return getPool().connect()
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now()
  const result = await getPool().query<T>(text, params)
  const duration = Date.now() - start

  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] Query executed:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount })
  }

  return result
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ============================================================
// 健康检查
// ============================================================

export interface DbHealthStatus {
  status: 'healthy' | 'unhealthy'
  connected: boolean
  poolStats: {
    total: number
    idle: number
    waiting: number
  }
  latencyMs?: number
  error?: string
}

export async function checkDbHealth(): Promise<DbHealthStatus> {
  const start = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1')

    return {
      status: 'healthy',
      connected: true,
      poolStats: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      connected: false,
      poolStats: { total: 0, idle: 0, waiting: 0 },
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============================================================
// 关闭连接
// ============================================================

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    console.log('[DB] Pool closed')
  }
}