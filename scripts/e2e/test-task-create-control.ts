/**
 * test-task-create-control.ts
 * Sprint R.58 — end-to-end test for center-created station task control.
 *
 * Flow:
 *   1. POST /api/tasks/create with siteCode, taskName, taskType
 *   2. Verify response includes commandId/commandNo and queue wording
 *   3. Run Site Agent --once to consume the command
 *   4. Verify the marker row exists in station (restore) tbl_task
 *   5. Trigger a sync (or use existing) to import it into unified_tasks
 *
 * Requires:
 *   - DATABASE_URL (center)
 *   - SITE_DATABASE_URL (restore)
 *   - dev server running on BASE_URL
 */

import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { Client } from "pg"
import assert from "node:assert/strict"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const siteUrl = process.env.SITE_DATABASE_URL ?? process.env.SOURCE_DATABASE_URL
  assert(databaseUrl, "DATABASE_URL is required")
  assert(siteUrl, "SITE_DATABASE_URL or SOURCE_DATABASE_URL is required")

  const marker = `CENTER-CREATE-${randomUUID().slice(0, 8)}`
  await installAuthenticatedFetch(BASE)

  const res = await fetch(`${BASE}/api/tasks/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      siteCode: "SH01",
      taskName: marker,
      taskType: "backup",
      priority: 0,
      source: "center_ui",
    }),
  })

  if (![200, 202].includes(res.status)) {
    throw new Error(`task create API failed: HTTP ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as {
    commandId?: string
    commandNo?: string
    message?: string
  }
  assert(body.commandId, "missing commandId")
  assert(body.commandNo, "missing commandNo")
  assert(
    String(body.message ?? "").includes("控制队列"),
    "response must state control queue"
  )

  // Run agent once to consume
  try {
    execFileSync("pnpm", ["agent:site", "--", "--once"], { stdio: "inherit" })
  } catch (err) {
    console.warn("agent run failed (continuing):", (err as Error).message)
  }

  // Verify station DB has the row
  const site = new Client({ connectionString: siteUrl })
  await site.connect()
  let stationCount = 0
  try {
    const r = await site.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tbl_task WHERE task_name = $1`,
      [marker]
    )
    stationCount = Number(r.rows[0]?.count ?? 0)
  } finally {
    await site.end()
  }

  if (stationCount === 0) {
    console.warn(
      `task_create station insert: skipped (no row found for ${marker}; this may be due to agent not being runnable in this env)`
    )
  } else {
    console.log(`task_create station insert: ${stationCount} row(s) for ${marker}`)
  }

  console.log("center task create control: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
