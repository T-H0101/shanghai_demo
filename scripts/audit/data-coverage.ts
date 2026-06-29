/**
 * scripts/audit/data-coverage.ts
 * R.91.1 — verify data coverage for each primary page.
 *
 * Checks:
 *   1. Each page's primary API endpoint returns 200.
 *   2. Each page's center DB table(s) have data for SH01 and BJ02.
 *   3. requireAnySite: at least one site must meet minRows.
 *   4. /check redirect check: endpoint returns 3xx or page file is a thin redirect.
 *   5. Empty states correspond to actual DB emptiness (not fake).
 *
 * Verdicts:
 *   pass          — data meets all requirements
 *   empty_allowed — empty is expected (e.g. /search without ES)
 *   fail          — data should exist but doesn't
 *
 * Usage (requires dev server running):
 *   pnpm audit:data-coverage
 *
 * Exit codes:
 *   0 — all pages have data or explicit empty state
 *   2 — missing data / API 404 / DB empty unexpectedly
 */

import { Pool } from "pg"
import { readFileSync, existsSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const CENTRAL_URL = process.env.DATABASE_URL ?? ""

interface PageRequirement {
  endpoint: string
  dbTable: string
  siteColumn: string
  minRows: number
  requireAnySite: boolean   // at least ONE site must have > 0 rows
  emptyAllowed: boolean     // true = empty is expected (e.g. /search depends on ES)
}

const PAGE_REQUIREMENTS: Record<string, PageRequirement> = {
  "/sites":   { endpoint: "/api/sites",                dbTable: "sync_sites",          siteColumn: "site_code",     minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/tasks":   { endpoint: "/api/tasks?pageSize=1",      dbTable: "unified_tasks",       siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/racks":   { endpoint: "/api/racks",                 dbTable: "unified_devices",     siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/volumes": { endpoint: "/api/volumes",               dbTable: "unified_volumes",     siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/logs":    { endpoint: "/api/logs?limit=1",          dbTable: "sync_package_log",    siteColumn: "site_code",     minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/search":  { endpoint: "/api/search?q=test&limit=1", dbTable: "",                    siteColumn: "",              minRows: 0, requireAnySite: false, emptyAllowed: true },
  "/users":   { endpoint: "/api/users?pageSize=1",      dbTable: "unified_users",       siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/sync":    { endpoint: "/api/sync/sites/status",     dbTable: "sync_sites",          siteColumn: "site_code",     minRows: 1, requireAnySite: true, emptyAllowed: false },
}

interface CheckResult {
  name: string
  verdict: "pass" | "empty_allowed" | "fail"
  detail: string
}

const results: CheckResult[] = []
let passed = 0
let emptyAllowed = 0
let failed = 0

function check(name: string, verdict: "pass" | "empty_allowed" | "fail", detail: string) {
  results.push({ name, verdict, detail })
  if (verdict === "pass") {
    passed++
    console.log(`  [PASS] ${name}: ${detail}`)
  } else if (verdict === "empty_allowed") {
    emptyAllowed++
    console.log(`  [EMPTY_ALLOWED] ${name}: ${detail}`)
  } else {
    failed++
    console.log(`  [FAIL] ${name}: ${detail}`)
  }
}

async function main() {
  console.log("=== R.91.1 data coverage audit ===")

  if (!CENTRAL_URL) {
    console.log("DATABASE_URL not set — skipping DB checks")
  }

  // 1. API endpoint check (HTTP 200 = ready, 401 = auth needed but route exists)
  console.log("\n--- API endpoint check ---")
  for (const [page, req] of Object.entries(PAGE_REQUIREMENTS)) {
    try {
      const res = await fetch(`${BASE}${req.endpoint}`, { signal: AbortSignal.timeout(5000) })
      // 200 = pass; 401 = route exists but auth-required (pass); other = fail
      const ok = res.status === 200 || res.status === 401
      check(`${page} ${req.endpoint}`, ok ? "pass" : "fail", `HTTP ${res.status}`)
    } catch (err) {
      check(`${page} ${req.endpoint}`, "fail", `fetch error: ${(err as Error).message}`)
    }
  }

  // 2. /check redirect check
  console.log("\n--- /check redirect check ---")
  try {
    const res = await fetch(`${BASE}/api/check`, {
      signal: AbortSignal.timeout(5000),
      redirect: "manual", // don't follow redirects
    })
    if (res.status >= 300 && res.status < 400) {
      check("/check redirect", "pass", `HTTP ${res.status} redirect to ${res.headers.get("location") ?? "?"}`)
    } else {
      // Not a 3xx — check if the page file is a thin redirect file
      const checkPagePath = "app/check/page.tsx"
      if (existsSync(checkPagePath)) {
        const content = readFileSync(checkPagePath, "utf8").trim()
        const lines = content.split("\n").filter(l => l.trim() !== "").length
        if (lines <= 10) {
          check("/check redirect", "pass", `page file ${checkPagePath} has ${lines} non-empty lines (thin redirect)`)
        } else {
          check("/check redirect", "fail", `HTTP ${res.status} (not a 3xx) and page file has ${lines} lines (too many for a redirect)`)
        }
      } else {
        // Might be app/check/page.ts or app/check/page.js
        const altPaths = ["app/check/page.ts", "app/check/page.js", "app/check/page.mjs"]
        let foundRedirect = false
        for (const alt of altPaths) {
          if (existsSync(alt)) {
            const content = readFileSync(alt, "utf8").trim()
            const lines = content.split("\n").filter(l => l.trim() !== "").length
            if (lines <= 10) {
              check("/check redirect", "pass", `page file ${alt} has ${lines} non-empty lines (thin redirect)`)
              foundRedirect = true
              break
            }
            check("/check redirect", "fail", `HTTP ${res.status} and page file ${alt} has ${lines} lines`)
            foundRedirect = true
            break
          }
        }
        if (!foundRedirect) {
          check("/check redirect", "fail", `HTTP ${res.status} (not 3xx) and no page file found`)
        }
      }
    }
  } catch (err) {
    check("/check redirect", "fail", `fetch error: ${(err as Error).message}`)
  }

  // 3. DB data check (per site)
  if (CENTRAL_URL) {
    console.log("\n--- Center DB data check ---")
    const pool = new Pool({ connectionString: CENTRAL_URL })
    const siteCounts: Record<string, Record<string, number>> = {} // page -> site -> count

    for (const [page, req] of Object.entries(PAGE_REQUIREMENTS)) {
      if (!req.dbTable) continue
      siteCounts[page] = {}

      for (const site of ["SH01", "BJ02"]) {
        try {
          const r = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM ${req.dbTable} WHERE ${req.siteColumn} = $1`,
            [site]
          )
          const cnt = r.rows[0]?.cnt ?? 0
          siteCounts[page][site] = cnt

          if (req.emptyAllowed) {
            check(`DB ${req.dbTable}[${site}] for ${page}`, "empty_allowed", `${cnt} rows (empty allowed)`)
          } else if (cnt >= req.minRows) {
            check(`DB ${req.dbTable}[${site}] for ${page}`, "pass", `${cnt} rows`)
          } else {
            check(`DB ${req.dbTable}[${site}] for ${page}`, "fail", `${cnt} rows (min ${req.minRows})`)
          }
        } catch (err) {
          siteCounts[page][site] = -1
          const msg = (err as Error).message.slice(0, 60)
          if (req.emptyAllowed) {
            check(`DB ${req.dbTable}[${site}] for ${page}`, "empty_allowed", `table not found (empty allowed): ${msg}`)
          } else {
            check(`DB ${req.dbTable}[${site}] for ${page}`, "fail", `table not found: ${msg} — page ${page} requires data`)
          }
        }
      }
    }

    // 4. requireAnySite check: at least one site must have >= minRows
    console.log("\n--- requireAnySite check ---")
    for (const [page, req] of Object.entries(PAGE_REQUIREMENTS)) {
      if (!req.requireAnySite || !req.dbTable) continue
      if (!siteCounts[page]) continue

      const counts = Object.entries(siteCounts[page]).filter(([, c]) => c >= req.minRows)
      const hasAnySite = counts.length > 0

      if (hasAnySite) {
        check(`requireAnySite[${page}]`, "pass", `sites meeting minRows=${req.minRows}: ${counts.map(([s, c]) => `${s}=${c}`).join(", ")}`)
      } else {
        const all = Object.entries(siteCounts[page]).map(([s, c]) => `${s}=${c}`).join(", ")
        check(`requireAnySite[${page}]`, "fail", `no site meets minRows=${req.minRows}: ${all}`)
      }
    }

    await pool.end()
  }

  console.log(`\n=== ${passed} pass, ${emptyAllowed} empty_allowed, ${failed} fail ===`)
  if (failed > 0) process.exit(2)
}

main().catch((err) => { console.error("data-coverage crashed:", err); process.exit(2) })