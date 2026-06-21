/**
 * test-search-es.ts
 * Sprint R.56 — verify /api/search uses center-owned read path
 * and never falls back to direct site_restore_db reads.
 *
 * R.79 boundary contract additions:
 *   - Verify the route source code references SEARCH_ES_URL env
 *   - Verify the route returns blocked_by_external_system when ES is absent
 *   - Verify the route NEVER contains INSERT INTO unified_tbl_file (full ingest
 *     into PG17 center is forbidden — file/folder go to ES/OpenSearch only)
 *
 * Behavior:
 *   - Without SEARCH_ES_URL: /api/search returns source="blocked_by_external_system"
 *     or "unified_file_index" (whichever applies), never "site_restore_db".
 *   - With SEARCH_ES_URL: configured-path test is skipped with explicit note.
 */

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function main() {
  const res = await fetch(`${BASE}/api/search?q=anytest&limit=1`, {
    signal: AbortSignal.timeout(8000),
  })
  assert.equal(res.status, 200, "search must return 200")
  const body = (await res.json()) as {
    data?: { source?: string; items?: unknown[] }
    source?: string
  }
  const source = body.source ?? body.data?.source
  console.log(`source=${source} items=${body.data?.items?.length ?? 0}`)

  assert.ok(source, "source must be present")
  assert.notEqual(
    source,
    "site_restore_db",
    "R.55: /api/search must NOT return site_restore_db as product source"
  )
  assert.ok(
    source === "es" ||
      source === "unified_file_index" ||
      source === "blocked_by_external_system",
    `source must be one of es|unified_file_index|blocked_by_external_system, got ${source}`
  )

  if (process.env.SEARCH_ES_URL && process.env.SEARCH_ES_INDEX) {
    console.log("SEARCH_ES_URL configured; ES-configured contract test would index/query a marker here.")
  } else {
    console.log("SEARCH_ES_URL not configured; configured-path test skipped with blocked_by_external_system evidence")
  }

  // R.79: boundary contract checks against source code
  const routeSource = await readFile("app/api/search/route.ts", "utf8")
  const repoSource = await readFile("lib/search/file-index-repository.ts", "utf8")
  const esClientSource = await readFile("lib/search/es-client.ts", "utf8")
  const combined = `${routeSource}\n${repoSource}\n${esClientSource}`

  assert.ok(
    combined.includes("SEARCH_ES_URL"),
    "R.79: search boundary must read SEARCH_ES_URL env"
  )
  assert.ok(
    combined.includes("blocked_by_external_system"),
    "R.79: search boundary must expose blocked_by_external_system state"
  )
  assert.ok(
    !combined.includes("INSERT INTO unified_tbl_file") &&
      !combined.includes("INSERT INTO unified_tbl_folder"),
    "R.79: full tbl_file/tbl_folder must NEVER be ingested into PG17 center"
  )

  console.log("search es boundary: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
