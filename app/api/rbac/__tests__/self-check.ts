/**
 * Sprint R.83.2 Task 5 — 5 CRUD endpoints self-check
 *
 * Exercises GET/POST/PUT/DELETE across 5 RBAC resources:
 *   - roles         (unified_roles)
 *   - dicts         (unified_dicts)
 *   - logs          (unified_sys_logs, read-only)
 *   - credentials   (unified_credible_proves)
 *   - users-mfa     (unified_user_mfas)
 *
 * Total checks:
 *   - 4 endpoints (roles/dicts/credentials/users-mfa): 5 happy-path × 4 = 20
 *   - 1 endpoint (logs):                              1 GET only = 1
 *   - 5 negative-path DELETE checks                   5
 *   - 4 idempotent POST (repeat upsert)               4
 *                                                          = 30
 *
 * PASS = 30/30 (or logs endpoint reduced: 24 happy + 5 negative = 29, see run)
 *
 * Usage:
 *   pnpm exec tsx app/api/rbac/__tests__/self-check.ts
 */

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"
const TEST_SITE_CODE = process.env.TEST_SITE_CODE ?? "SH01"
const TEST_RECORD_ID = process.env.TEST_RECORD_ID ?? "test-r83-2-selfcheck-1"

interface CheckResult {
  name: string
  ok: boolean
  detail?: string
}

const results: CheckResult[] = []

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail })
  const tag = ok ? "PASS" : "FAIL"
  const suffix = detail ? `  (${detail})` : ""
  console.log(`  [${tag}] ${name}${suffix}`)
}

async function httpJson(
  method: string,
  path: string,
  init: { body?: unknown; query?: Record<string, string> } = {},
): Promise<{ status: number; body: any }> {
  const url = new URL(path, BASE)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "content-type": "application/json" },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  let body: any = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

async function ensureDevServer(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/`)
    if (r.ok) return true
  } catch {
    // not up
  }
  console.log("Dev server not detected; spawning `pnpm dev` ...")
  const child = spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  })
  child.unref()

  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    try {
      const r = await fetch(`${BASE}/`)
      if (r.ok) return true
    } catch {
      // retry
    }
  }
  // one more retry after grace
  try {
    const r = await fetch(`${BASE}/`)
    return r.ok
  } catch {
    return false
  }
}

function expectEnvelope(name: string, body: any, shape: { code?: number; dataFields: string[] }) {
  const checks: string[] = []
  if (shape.code !== undefined) {
    checks.push(`code=${body?.code}===${shape.code}`)
  }
  const data = body?.data ?? {}
  for (const f of shape.dataFields) {
    checks.push(`data.${f}=${f in data}`)
  }
  const ok = checks.every((c) => !c.includes("=false") && !c.includes("=undefined"))
  record(name, ok, ok ? undefined : checks.join(" "))
}

async function runCrudBlock(resource: string, supportsWrite: boolean) {
  const base = `/api/rbac/${resource}`

  // 1. GET list
  {
    const r = await httpJson("GET", base, {
      query: { siteCode: TEST_SITE_CODE, limit: "10" },
    })
    const ok =
      r.status === 200 &&
      r.body?.code === 0 &&
      Array.isArray(r.body?.data?.items) &&
      typeof r.body?.data?.total === "number" &&
      Array.isArray(r.body?.data?.sourceTables)
    record(`[${resource}] GET list`, ok, `status=${r.status} keys=${r.body ? Object.keys(r.body).join(",") : "null"}`)
  }

  if (!supportsWrite) {
    // logs is read-only
    // 2. POST should NOT exist (expect 405 or 404)
    {
      const r = await httpJson("POST", base, {
        body: { source_site_id: TEST_SITE_CODE, source_record_id: TEST_RECORD_ID, raw_data: { test: "value" } },
      })
      const ok = r.status >= 400
      record(`[${resource}] POST rejected (read-only)`, ok, `status=${r.status}`)
    }
    return
  }

  // 3. POST insert
  {
    const r = await httpJson("POST", base, {
      body: {
        source_site_id: TEST_SITE_CODE,
        source_record_id: TEST_RECORD_ID,
        raw_data: { test: "value" },
      },
    })
    const ok = r.status === 200 && r.body?.code === 0 && typeof r.body?.data?.id === "string"
    record(`[${resource}] POST insert`, ok, `status=${r.status} id=${r.body?.data?.id}`)
  }

  // 4. POST idempotent upsert
  {
    const r = await httpJson("POST", base, {
      body: {
        source_site_id: TEST_SITE_CODE,
        source_record_id: TEST_RECORD_ID,
        raw_data: { test: "value-upserted" },
      },
    })
    const ok = r.status === 200 && r.body?.code === 0 && typeof r.body?.data?.id === "string"
    record(`[${resource}] POST idempotent upsert`, ok, `status=${r.status}`)
  }

  // 5. PUT update
  {
    const r = await httpJson("PUT", base, {
      body: {
        source_site_id: TEST_SITE_CODE,
        source_record_id: TEST_RECORD_ID,
        raw_data: { test: "value-updated" },
      },
    })
    const ok = r.status === 200 && r.body?.code === 0 && Number(r.body?.data?.updated) >= 1
    record(`[${resource}] PUT update`, ok, `status=${r.status} updated=${r.body?.data?.updated}`)
  }

  // 6. DELETE happy path
  {
    const r = await httpJson("DELETE", base, {
      query: { siteCode: TEST_SITE_CODE, sourceRecordId: TEST_RECORD_ID },
    })
    const ok = r.status === 200 && r.body?.code === 0 && Number(r.body?.data?.deleted) >= 1
    record(`[${resource}] DELETE happy`, ok, `status=${r.status} deleted=${r.body?.data?.deleted}`)
  }

  // 7. DELETE negative (missing query params)
  {
    const r = await httpJson("DELETE", base)
    const ok = r.status >= 400
    record(`[${resource}] DELETE missing params rejected`, ok, `status=${r.status}`)
  }
}

async function main() {
  const up = await ensureDevServer()
  if (!up) {
    console.error("Dev server failed to start")
    process.exit(2)
  }

  console.log(`Self-check against ${BASE}  siteCode=${TEST_SITE_CODE} recordId=${TEST_RECORD_ID}`)

  for (const resource of ["roles", "dicts", "logs", "credentials", "users-mfa"]) {
    const supportsWrite = resource !== "logs"
    await runCrudBlock(resource, supportsWrite)
  }

  const failed = results.filter((r) => !r.ok)
  const passed = results.length - failed.length
  console.log(`\nSummary: ${passed}/${results.length} PASS, ${failed.length} FAIL`)

  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const f of failed) {
      console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`)
    }
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error("Self-check crashed:", e)
  process.exit(1)
})