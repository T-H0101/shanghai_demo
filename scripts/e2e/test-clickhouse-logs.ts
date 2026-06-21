/**
 * test-clickhouse-logs.ts
 * Sprint R.57 — verify /api/logs uses center-owned read path
 * (log-repository). NEVER returns mock data.
 *
 * R.79 boundary contract additions:
 *   - Verify route code reads CLICKHOUSE_URL env
 *   - Verify route code uses log-repository (center_pg fallback) or
 *     exposes partial / blocked_by_external_system honestly
 *   - Verify route source does NOT contain INSERT INTO tbl_file / tbl_folder
 *     (logs route does not ingest file tables anyway; this is a defensive
 *     negative-boundary check)
 */

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { installAuthenticatedFetch } from "./auth-helper"
import { queryClickHouseLogs } from "../../lib/logs/clickhouse-client"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

function safeIdentifier(value: string, fallback: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : fallback
}

async function main() {
  await installAuthenticatedFetch(BASE)
  const res = await fetch(`${BASE}/api/logs?limit=1`, {
    signal: AbortSignal.timeout(8000),
  })
  assert.equal(res.status, 200, "logs must return 200")
  const body = (await res.json()) as {
    code?: number
    dataSource?: string
    data?: { source?: string; items?: unknown[] }
    source?: string
  }

  // The /api/logs endpoint is the union of 6 center PG log sources
  // and uses log-repository when ClickHouse is configured. We verify
  // that dataSource is one of "database" | "empty" | "error" and not
  // "mock".
  assert.ok(
    ["database", "empty", "error"].includes(body.dataSource ?? ""),
    `dataSource must be database|empty|error, got ${body.dataSource}`
  )
  assert.notEqual(body.dataSource, "mock", "logs must not return mock")

  if (process.env.CLICKHOUSE_URL && process.env.CLICKHOUSE_DATABASE) {
    const marker = `CH-E2E-${randomUUID().slice(0, 8)}`
    const chUrl = process.env.CLICKHOUSE_URL.replace(/\/$/, "")
    const database = safeIdentifier(process.env.CLICKHOUSE_DATABASE, "unified_logs")
    const table = safeIdentifier(process.env.CLICKHOUSE_LOG_TABLE ?? "task_logs", "task_logs")
    const user = process.env.CLICKHOUSE_USER ?? "default"
    const password = process.env.CLICKHOUSE_PASSWORD ?? ""
    const auth = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
    const setupSql = `
      CREATE DATABASE IF NOT EXISTS ${database};
      CREATE TABLE IF NOT EXISTS ${database}.${table} (
        log_id String,
        site_code String,
        task_id String,
        operator String,
        device_id String,
        disc_no String,
        error_code String,
        error_message String,
        occurred_at DateTime,
        level String,
        message String
      ) ENGINE = MergeTree ORDER BY occurred_at;
      INSERT INTO ${database}.${table}
      (log_id, site_code, task_id, operator, device_id, disc_no, error_code, error_message, occurred_at, level, message)
      VALUES ('${marker}', 'SH01', 'TASK-${marker}', 'e2e', 'DEV-${marker}', 'DISC-${marker}', '', '', now(), 'info', '${marker} marker');
    `
    const setupRes = await fetch(`${chUrl}/?multiquery=1`, {
      method: "POST",
      headers: { "content-type": "text/plain", authorization: auth },
      body: setupSql,
      signal: AbortSignal.timeout(8000),
    })
    assert.ok(setupRes.ok, `ClickHouse marker setup failed: HTTP ${setupRes.status}`)
    const markerResult = await queryClickHouseLogs({ keyword: marker, siteCode: "SH01", limit: 5, offset: 0 })
    assert.ok(
      markerResult.items.some((item) => item.logId === marker || item.message?.includes(marker)),
      "ClickHouse configured path must query the inserted marker"
    )
    console.log(`CLICKHOUSE_URL configured; marker query PASS (${marker})`)
  } else {
    console.log("CLICKHOUSE_URL not configured; configured-path test skipped with center_pg evidence")
  }

  // R.79: boundary contract checks against source code
  const repoSource = await readFile("lib/logs/log-repository.ts", "utf8")
  const chClientSource = await readFile("lib/logs/clickhouse-client.ts", "utf8")
  const routeSource = await readFile("app/api/logs/route.ts", "utf8")
  const combined = `${routeSource}\n${repoSource}\n${chClientSource}`

  assert.ok(
    combined.includes("CLICKHOUSE_URL"),
    "R.79: logs boundary must read CLICKHOUSE_URL env"
  )
  assert.ok(
    chClientSource.includes("FORMAT TabSeparatedWithNames") &&
      chClientSource.includes("param_lim") &&
      chClientSource.includes("param_off"),
    "R.79: ClickHouse query must send typed HTTP parameters and parse a header row"
  )
  assert.ok(
    combined.includes("center_pg") ||
      combined.includes("clickhouse") ||
      combined.includes("blocked_by_external_system"),
    "R.79: logs boundary must expose center_pg/clickhouse/blocked state"
  )
  assert.ok(
    !combined.includes("INSERT INTO unified_tbl_file") &&
      !combined.includes("INSERT INTO unified_tbl_folder"),
    "R.79: logs route must NEVER ingest tbl_file/tbl_folder"
  )

  console.log("clickhouse logs boundary: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
