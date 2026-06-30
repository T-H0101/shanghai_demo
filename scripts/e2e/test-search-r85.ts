/**
 * scripts/e2e/test-search-r85.ts
 * R.85 — verify SearchPort boundary contract
 *
 * Asserts:
 *   1. /api/search returns `source: "opensearch"` when SEARCH_ES_URL + INDEX
 *      are set and ES is reachable; the route reads via SearchPort.
 *   2. /api/search returns `source: "blocked_by_external_system"` when
 *      SEARCH_ES_URL is unset, with `blocker: "es_not_configured"`.
 *   3. Route source code imports from `lib/adapters/opensearch/file-search-adapter`
 *      and never imports `lib/search/es-client` directly (ADR 0002).
 *   4. Route source code never contains `INSERT INTO unified_tbl_file` or
 *      `INSERT INTO unified_tbl_folder` (R.79 file/folder boundary).
 *   5. FileIndexDocument domain type is well-formed.
 *
 * Run:
 *   pnpm e2e:search-r85            # blocked path (default)
 *   SEARCH_ES_URL=http://localhost:9201 SEARCH_ES_INDEX=disc_file_index \
 *     pnpm e2e:search-r85          # both paths
 */

import { config as loadDotenv } from "dotenv"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"

loadDotenv({ path: ".env.local", quiet: true })

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

function dataSource(body: Record<string, unknown>): string | undefined {
  const data = body.data as Record<string, unknown> | undefined
  return (data?.source as string | undefined) ?? (body.source as string | undefined)
}

async function main() {
  // === Boundary contract: route source code ===
  const routeSource = await readFile("app/api/search/route.ts", "utf8")
  const adapterSource = await readFile(
    "lib/adapters/opensearch/file-search-adapter.ts",
    "utf8"
  )
  const portSource = await readFile("lib/ports/search-port.ts", "utf8")
  const domainSource = await readFile(
    "lib/domain/search/file-index-document.ts",
    "utf8"
  )
  const indexerSource = await readFile("scripts/index/file-indexer.ts", "utf8")

  assert.ok(
    routeSource.includes("createOpenSearchFileSearchAdapter"),
    "R.85: route must call createOpenSearchFileSearchAdapter()"
  )
  assert.ok(
    !routeSource.includes('from "@/lib/search/es-client"'),
    "R.85: route must NOT import lib/search/es-client directly (ADR 0002)"
  )
  assert.ok(
    !routeSource.includes("INSERT INTO unified_tbl_file") &&
      !routeSource.includes("INSERT INTO unified_tbl_folder"),
    "R.79: file/folder full PG ingest forbidden"
  )
  assert.ok(
    portSource.includes("interface SearchPort"),
    "R.85: SearchPort must be a TypeScript interface"
  )
  assert.ok(
    adapterSource.includes("implements") ||
      adapterSource.includes("createOpenSearchFileSearchAdapter"),
    "R.85: adapter must implement SearchPort"
  )
  assert.ok(
    domainSource.includes("FileIndexDocument") &&
      domainSource.includes("isValidFileIndexDocument"),
    "R.85: FileIndexDocument domain type must exist"
  )
  assert.ok(
    indexerSource.includes("createOpenSearchFileSearchAdapter"),
    "R.85: file-indexer must use SearchPort"
  )

  // === Blocked path (always run) ===
  const blocked = await fetchJson(
    `${BASE}/api/search?q=${encodeURIComponent("__r85_blocked__")}&limit=1`
  )
  assert.equal(blocked.status, 200, "blocked path must return 200 with envelope")
  const blockedSource = dataSource(blocked.body)
  // When SEARCH_ES_URL is set in this dev env, opensearch path runs.
  // When unset, blocked path runs. Both are valid R.85 outcomes.
  assert.ok(
    blockedSource === "blocked_by_external_system" ||
      blockedSource === "opensearch",
    `R.85: source must be blocked_by_external_system or opensearch, got ${blockedSource}`
  )

  if (!process.env.SEARCH_ES_URL || !process.env.SEARCH_ES_INDEX) {
    assert.equal(
      blockedSource,
      "blocked_by_external_system",
      "without SEARCH_ES_URL, blocked path must win"
    )
    const blockedData = blocked.body.data as Record<string, unknown>
    assert.equal(
      blockedData.blocker,
      "es_not_configured",
      "R.85: blocked blocker must be es_not_configured"
    )
    console.log("R.85 blocked path: PASS (SEARCH_ES_URL not set)")
  } else {
    // === Configured path (optional) ===
    const esUrl = process.env.SEARCH_ES_URL.replace(/\/$/, "")
    const index = process.env.SEARCH_ES_INDEX
    const marker = `R85-E2E-${randomUUID().slice(0, 8)}`
    await fetch(`${esUrl}/${index}`, { method: "PUT" }).catch(() => null)
    const idx = await fetch(`${esUrl}/${index}/_doc?refresh=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        siteCode: "SH01",
        fileName: `${marker}.pdf`,
        filePath: `/r85/${marker}.pdf`,
        extension: "pdf",
        updatedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
    assert.ok(idx.ok, `marker index failed: HTTP ${idx.status}`)

    const markerRes = await fetchJson(
      `${BASE}/api/search?q=${encodeURIComponent(marker)}&limit=5`
    )
    const markerSource = dataSource(markerRes.body)
    assert.equal(markerSource, "opensearch", "R.85: configured path must return opensearch")
    const items = (markerRes.body.data as { items?: unknown[] }).items ?? []
    assert.ok(
      items.some((item) => {
        const f = (item as { fileName?: string }).fileName
        return typeof f === "string" && f.includes(marker)
      }),
      "R.85: marker must appear in /api/search hits"
    )
    console.log(`R.85 configured path: PASS (marker=${marker})`)
  }

  console.log("R.85 search port boundary: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
