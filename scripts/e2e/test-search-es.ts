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
 *   - Without SEARCH_ES_URL: /api/search returns source="blocked_by_external_system".
 *   - With SEARCH_ES_URL: index a marker and query it through /api/search.
 */

import { config as loadDotenv } from "dotenv"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"

loadDotenv({ path: ".env.local", quiet: true })

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
    source === "opensearch" ||
      source === "es" ||
      source === "unified_file_index" ||
      source === "blocked_by_external_system",
    `source must be one of opensearch|es|unified_file_index|blocked_by_external_system, got ${source}`
  )

  if (process.env.SEARCH_ES_URL && process.env.SEARCH_ES_INDEX) {
    const esUrl = process.env.SEARCH_ES_URL.replace(/\/$/, "")
    const index = process.env.SEARCH_ES_INDEX
    const marker = `ES-E2E-${randomUUID().slice(0, 8)}`
    await fetch(`${esUrl}/${index}`, { method: "PUT" }).catch(() => null)
    const indexRes = await fetch(`${esUrl}/${index}/_doc?refresh=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        siteCode: "SH01",
        fileName: `${marker}.pdf`,
        filePath: `/e2e/${marker}.pdf`,
        extension: "pdf",
        updatedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
    assert.ok(indexRes.ok, `ES marker index failed: HTTP ${indexRes.status}`)
    const markerRes = await fetch(`${BASE}/api/search?q=${encodeURIComponent(marker)}&limit=5`, {
      signal: AbortSignal.timeout(8000),
    })
    const markerBody = await markerRes.json()
    const markerItems = markerBody?.data?.items ?? []
    assert.ok(
      markerRes.ok &&
        markerBody?.data?.source === "opensearch" &&
        markerItems.some((item: { fileName?: string }) => item.fileName?.includes(marker)),
      "ES configured path must index and query a marker through /api/search"
    )
    console.log(`SEARCH_ES_URL configured; marker query PASS (${marker})`)
  } else {
    assert.equal(
      source,
      "blocked_by_external_system",
      "without SEARCH_ES_URL, search must expose blocked_by_external_system"
    )
    console.log("SEARCH_ES_URL not configured; blocked path PASS")
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
