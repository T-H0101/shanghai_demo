/**
 * Sprint R.83.8 Task 3 — 3 CRUD endpoints self-check
 * (task-detail + slot-files + slot-folders)
 *
 * Exercises GET/POST/PUT/DELETE across 3 new resources.
 *
 * Total checks (≥18):
 *   - 3 endpoints × 6 = 18 happy-path + envelope
 *   - 3 negative-path DELETE (missing params) = 3
 *                                                  = 21
 *
 * Usage:
 *   pnpm exec tsx app/api/__tests__/r83.8-api-test.ts
 */

import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"
const TEST_SITE_CODE = process.env.TEST_SITE_CODE ?? "SH01"
const TEST_RECORD_ID = process.env.TEST_RECORD_ID ?? "test-r83-8-selfcheck-1"

let authCookie = ""

async function loginCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: TEST_SITE_CODE }),
  })
  const cookie = res.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1]
  if (!res.ok || !cookie) {
    throw new Error(`login failed: HTTP ${res.status}`)
  }
  return `odp_session=${cookie}`
}

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
    headers: { "content-type": "application/json", ...(authCookie ? { cookie: authCookie } : {}) },
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
  try {
    const r = await fetch(`${BASE}/`)
    return r.ok
  } catch {
    return false
  }
}

async function runCrudBlock(resource: string) {
  const base = `/api/${resource}`

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

  // 2. POST insert
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

  // 3. POST idempotent upsert
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

  // 4. PUT update
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

  // 5. DELETE happy path
  {
    const r = await httpJson("DELETE", base, {
      query: { siteCode: TEST_SITE_CODE, sourceRecordId: TEST_RECORD_ID },
    })
    const ok = r.status === 200 && r.body?.code === 0 && Number(r.body?.data?.deleted) >= 1
    record(`[${resource}] DELETE happy`, ok, `status=${r.status} deleted=${r.body?.data?.deleted}`)
  }

  // 6. DELETE negative (missing query params)
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

  authCookie = await loginCookie()

  console.log(`Self-check against ${BASE}  siteCode=${TEST_SITE_CODE} recordId=${TEST_RECORD_ID}`)

  for (const resource of [
    "task-detail",
    "slot-files",
    "slot-folders",
  ]) {
    await runCrudBlock(resource)
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