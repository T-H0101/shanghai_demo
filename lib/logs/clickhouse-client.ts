/**
 * lib/logs/clickhouse-client.ts
 * Sprint R.57 — neutral ClickHouse HTTP client.
 *
 * Reads only from environment. Never reads source DB.
 */

export function isClickHouseConfigured(): boolean {
  return Boolean(process.env.CLICKHOUSE_URL && process.env.CLICKHOUSE_DATABASE)
}

export interface ClickHouseLogRecord {
  logId: string
  siteCode: string
  taskId?: string
  operator?: string
  deviceId?: string
  discNo?: string
  errorCode?: string
  errorMessage?: string
  occurredAt: string
  level?: string
  message?: string
}

export interface ClickHouseLogQuery {
  keyword?: string
  siteCode?: string
  limit: number
  offset: number
}

function authHeader(): Record<string, string> {
  const user = process.env.CLICKHOUSE_USER ?? "default"
  const password = process.env.CLICKHOUSE_PASSWORD ?? ""
  const token = Buffer.from(`${user}:${password}`).toString("base64")
  return { authorization: `Basic ${token}` }
}

function safeIdentifier(value: string, fallback: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : fallback
}

export async function queryClickHouseLogs(
  query: ClickHouseLogQuery
): Promise<{ items: ClickHouseLogRecord[]; total: number }> {
  if (!isClickHouseConfigured()) {
    return { items: [], total: 0 }
  }
  const url = process.env.CLICKHOUSE_URL!.replace(/\/$/, "")
  const database = safeIdentifier(process.env.CLICKHOUSE_DATABASE!, "unified_logs")
  const table = safeIdentifier(process.env.CLICKHOUSE_LOG_TABLE ?? "task_logs", "task_logs")
  const conditions: string[] = ["1=1"]
  const params = new URLSearchParams()
  if (query.keyword) {
    conditions.push(
      "(message ILIKE {kw:String} OR error_message ILIKE {kw:String})"
    )
    params.set("param_kw", `%${query.keyword}%`)
  }
  if (query.siteCode) {
    conditions.push("site_code = {sc:String}")
    params.set("param_sc", query.siteCode)
  }
  const sql = `SELECT log_id, site_code, task_id, operator, device_id, disc_no,
                      error_code, error_message, occurred_at, level, message
               FROM ${database}.${table}
               WHERE ${conditions.join(" AND ")}
               ORDER BY occurred_at DESC
               LIMIT {lim:UInt32} OFFSET {off:UInt32}
               FORMAT TabSeparatedWithNames`
  params.set("param_lim", String(query.limit))
  params.set("param_off", String(query.offset))
  const endpoint = `${url}/?${params.toString()}`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "text/plain", ...authHeader() },
    body: sql,
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`clickhouse_query_failed: HTTP ${res.status}`)
  }
  const text = await res.text()
  // CSV with header row from ClickHouse JSONEachRow fallback
  const lines = text.trim().split("\n")
  if (lines.length <= 1) {
    return { items: [], total: 0 }
  }
  const items: ClickHouseLogRecord[] = lines.slice(1).map((line) => {
    const cols = line.split("\t")
    return {
      logId: cols[0] ?? "",
      siteCode: cols[1] ?? "",
      taskId: cols[2] || undefined,
      operator: cols[3] || undefined,
      deviceId: cols[4] || undefined,
      discNo: cols[5] || undefined,
      errorCode: cols[6] || undefined,
      errorMessage: cols[7] || undefined,
      occurredAt: cols[8] ?? new Date().toISOString(),
      level: cols[9] || undefined,
      message: cols[10] || undefined,
    }
  })
  return { items, total: items.length }
}

export async function pingClickHouse(): Promise<boolean> {
  if (!isClickHouseConfigured()) return false
  const url = process.env.CLICKHOUSE_URL!.replace(/\/$/, "")
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain", ...authHeader() },
      body: "SELECT 1 FORMAT TabSeparated",
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}
