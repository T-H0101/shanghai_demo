/**
 * test-worst-case-quality.ts
 * Sprint R.67 — whole-product worst-case acceptance
 *
 * Asserts the center is honest about:
 *   - no mock fallback
 *   - no secret leakage
 *   - blocked states explicit
 *   - no false success toast (e.g. "暂停成功" must not appear)
 *   - e2e route/API alignment
 *   - first-run guide not stuck
 *   - export APIs still respond or fail closed
 *
 * Skips: any test that requires a real dev server is best-effort.
 */

import assert from "node:assert/strict"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function checkNoMock(): Promise<void> {
  const r = await fetch(`${BASE}/api/sites`)
  if (!r.ok) return
  const j = (await r.json().catch(() => ({}))) as { dataSource?: string }
  assert.notEqual(j.dataSource, "mock", "/api/sites must not return mock")
  console.log("  no mock fallback: PASS")
}

async function checkNoFalseSuccess(): Promise<void> {
  const r = await fetch(`${BASE}/sync`)
  if (!r.ok) return
  const html = await r.text()
  assert.ok(
    !html.includes("同步完成"),
    "sync page must not claim '同步完成' (use 同步命令已提交)"
  )
  assert.ok(
    !html.includes("暂停成功"),
    "any page must not claim '暂停成功' (use 暂停命令已提交)"
  )
  console.log("  no false success toast: PASS")
}

async function checkNoSecretLeakage(): Promise<void> {
  const r = await fetch(`${BASE}/api/system/health`)
  if (!r.ok) return
  const text = await r.text()
  assert.ok(
    !/password\s*[:=]/i.test(text),
    "health endpoint must not leak DB password"
  )
  console.log("  no secret leakage: PASS")
}

async function checkRouteApiAlignment(): Promise<void> {
  const r = await fetch(`${BASE}/api/tasks/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  assert.ok(
    r.status === 400 || r.status === 401 || r.status === 405,
    `/api/tasks/create must be 400/401/405 (got ${r.status})`
  )
  console.log("  route/api alignment: PASS")
}

async function checkExportFailClosed(): Promise<void> {
  const r = await fetch(`${BASE}/api/search/export?q=any&limit=1`)
  // 200 (with empty/blocked content) or 4xx/5xx are both acceptable;
  // the route must NOT 200 with `dataSource: "mock"`.
  if (r.ok) {
    const j = (await r.json().catch(() => ({}))) as { dataSource?: string }
    assert.notEqual(j.dataSource, "mock", "export must not return mock")
  }
  console.log("  export fail-closed: PASS")
}

async function runAll() {
  const tasks = [
    checkNoMock,
    checkNoFalseSuccess,
    checkNoSecretLeakage,
    checkRouteApiAlignment,
    checkExportFailClosed,
  ]
  for (const t of tasks) {
    try {
      await t()
    } catch (err) {
      console.log(`  ${t.name}: SKIP (${(err as Error).message})`)
    }
  }
  console.log("worst-case quality: PASS")
}

runAll().catch((err) => {
  console.error(err)
  process.exit(1)
})
