import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Client } from "pg"
import { signSiteAgentRequest } from "../../lib/site-agent/hmac"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const SITE_CODE = "SH01"

function signedHeaders(input: {
  path: string
  method?: string
  rawBody?: string
  siteCode?: string
  timestamp?: string
  nonce?: string
}) {
  const siteCode = input.siteCode ?? SITE_CODE
  const timestamp = input.timestamp ?? String(Date.now())
  const nonce = input.nonce ?? randomBytes(16).toString("hex")
  const rawBody = input.rawBody ?? ""
  const secret =
    process.env.SITE_AGENT_SECRET ?? process.env.SYNC_PACKAGE_SECRET
  assert(secret, "SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is required")
  return {
    "content-type": "application/json",
    "x-site-code": siteCode,
    "x-agent-timestamp": timestamp,
    "x-agent-nonce": nonce,
    "x-agent-signature": signSiteAgentRequest({
      siteCode,
      timestamp,
      nonce,
      method: input.method ?? "GET",
      path: input.path,
      rawBody,
      secret,
    }),
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const siteDatabaseUrl = process.env.SITE_DATABASE_URL
  assert(databaseUrl, "DATABASE_URL is required")
  assert(siteDatabaseUrl, "SITE_DATABASE_URL is required")
  await installAuthenticatedFetch(BASE_URL)
  const client = new Client({ connectionString: databaseUrl })
  const siteClient = new Client({ connectionString: siteDatabaseUrl })
  await client.connect()
  await siteClient.connect()
  const stateDir = await mkdtemp(join(tmpdir(), "r19d-agent-control-"))
  const commandIds: string[] = []
  const commandNos: string[] = []
  let taskId: string | null = null

  try {
    const site = await client.query(
      "SELECT 1 FROM sync_sites WHERE site_code = $1",
      [SITE_CODE]
    )
    assert.equal(site.rowCount, 1, "SH01 must be registered")

    const createResponse = await fetch(`${BASE_URL}/api/control/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceSiteId: SITE_CODE,
        commandType: "task_pause",
        targetType: "task",
        targetId: "1",
        payload: { testMarker: `r19d-auth-${Date.now()}` },
      }),
    })
    const created = await createResponse.json()
    assert.equal(createResponse.status, 201)
    const authCommandId = created.command.id as string
    commandIds.push(authCommandId)
    commandNos.push(created.command.commandNo)
    await client.query(
      `UPDATE control_command
       SET requested_at = TIMESTAMPTZ '1970-01-01 00:00:00+00'
       WHERE id = $1`,
      [authCommandId]
    )

    const path = `/api/site-control/commands?siteCode=${SITE_CODE}&limit=1`
    const unsigned = await fetch(`${BASE_URL}${path}`)
    assert.equal(unsigned.status, 401)

    const headers = signedHeaders({ path })
    const signed = await fetch(`${BASE_URL}${path}`, { headers })
    const signedBody = await signed.json()
    assert.equal(signed.status, 200)
    assert.equal(signedBody.commands.length, 1)
    assert.equal(signedBody.commands[0].id, authCommandId)

    const replayed = await fetch(`${BASE_URL}${path}`, { headers })
    assert.equal(replayed.status, 409)

    const crossSitePath = `/api/site-control/commands?siteCode=${SITE_CODE}&limit=1`
    const crossSite = await fetch(`${BASE_URL}${crossSitePath}`, {
      headers: signedHeaders({
        path: crossSitePath,
        siteCode: "BJ02",
      }),
    })
    assert.equal(crossSite.status, 401)

    const expired = await fetch(`${BASE_URL}${path}`, {
      headers: signedHeaders({
        path,
        timestamp: String(Date.now() - 10 * 60 * 1000),
      }),
    })
    assert.equal(expired.status, 401)

    console.log("R.19D signed control API: PASS")

    await client.query("DELETE FROM control_command WHERE id = $1", [
      authCommandId,
    ])
    commandIds.splice(commandIds.indexOf(authCommandId), 1)
    commandNos.splice(commandNos.indexOf(created.command.commandNo), 1)

    const marker = `R19D-E2E-${Date.now()}`
    const inserted = await siteClient.query<{ id: string }>(
      `INSERT INTO tbl_task(task_type, status, task_name, create_dt, update_dt)
       VALUES (0, 19, $1, NOW(), NOW())
       RETURNING id::text`,
      [marker]
    )
    taskId = inserted.rows[0].id

    const createControl = async (
      commandType: "task_pause" | "task_resume",
      requestedAt: string
    ) => {
      const response = await fetch(`${BASE_URL}/api/control/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceSiteId: SITE_CODE,
          commandType,
          targetType: "task",
          targetId: taskId,
          payload: { testMarker: marker },
        }),
      })
      const body = await response.json()
      assert.equal(response.status, 201)
      commandIds.push(body.command.id)
      commandNos.push(body.command.commandNo)
      await client.query(
        "UPDATE control_command SET requested_at = $2 WHERE id = $1",
        [body.command.id, requestedAt]
      )
      return body.command
    }

    const runAgentOnce = () =>
      execFileSync("pnpm", ["agent:site", "--", "--once"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SITE_CODE: SITE_CODE,
          SITE_AGENT_ID: "r19d-control-e2e",
          SITE_AGENT_VERSION: "r19d-e2e",
          PLATFORM_URL: BASE_URL,
          SITE_AGENT_STATE_DIR: stateDir,
          SITE_AGENT_CONTROL_BATCH_SIZE: "1",
          SITE_AGENT_TASK_SYNC_INTERVAL_MS: "1000",
          SITE_AGENT_SNAPSHOT_SYNC_INTERVAL_MS: "5000",
        },
        encoding: "utf8",
        timeout: 60_000,
      })

    const pauseCommand = await createControl(
      "task_pause",
      "1970-01-01T00:00:00.000Z"
    )
    const pauseOutput = runAgentOnce()
    assert.match(pauseOutput, /"event":"control_cycle_completed"/)

    const pausedSource = await siteClient.query<{ status: number }>(
      "SELECT status FROM tbl_task WHERE id = $1",
      [taskId]
    )
    assert.equal(pausedSource.rows[0].status, 20)
    const pausedCenter = await client.query<{
      status: string
      result: Record<string, unknown>
    }>(
      "SELECT status, result FROM control_command WHERE id = $1",
      [pauseCommand.id]
    )
    assert.equal(pausedCenter.rows[0].status, "success")
    assert.equal(
      (pausedCenter.rows[0].result.after as { status?: number })?.status,
      20
    )
    const pausedUnified = await client.query<{ status: string }>(
      `SELECT status
       FROM unified_tasks
       WHERE source_site_id = $1 AND source_id = $2`,
      [SITE_CODE, taskId]
    )
    assert.equal(pausedUnified.rows[0]?.status, "paused")

    const resumeCommand = await createControl(
      "task_resume",
      "1970-01-01T00:00:01.000Z"
    )
    const resumeOutput = runAgentOnce()
    assert.match(resumeOutput, /"event":"control_cycle_completed"/)

    const resumedSource = await siteClient.query<{ status: number }>(
      "SELECT status FROM tbl_task WHERE id = $1",
      [taskId]
    )
    assert.equal(resumedSource.rows[0].status, 19)
    const resumedCenter = await client.query<{
      status: string
      result: Record<string, unknown>
    }>(
      "SELECT status, result FROM control_command WHERE id = $1",
      [resumeCommand.id]
    )
    assert.equal(resumedCenter.rows[0].status, "success")
    assert.equal(
      (resumedCenter.rows[0].result.after as { status?: number })?.status,
      19
    )

    const audit = await client.query<{ action: string; dry_run: boolean }>(
      `SELECT action, dry_run
       FROM audit_log
       WHERE command_no = ANY($1::text[])
       ORDER BY created_at`,
      [[pauseCommand.commandNo, resumeCommand.commandNo]]
    )
    assert.deepEqual(
      audit.rows.map((row) => row.action),
      ["task_pause", "task_resume"]
    )
    assert(audit.rows.every((row) => row.dry_run === false))

    const runtime = await client.query<{
      last_control_at: string | null
      capabilities: Record<string, { supported?: boolean; evidence?: string }>
    }>(
      `SELECT last_control_at::text, capabilities
       FROM site_agent_runtime
       WHERE site_code = $1`,
      [SITE_CODE]
    )
    assert(runtime.rows[0].last_control_at)
    assert.equal(runtime.rows[0].capabilities.task_pause?.supported, true)
    assert.match(
      runtime.rows[0].capabilities.task_resume?.evidence ?? "",
      /pre-pause/
    )

    console.log("R.19D real pause/resume Agent loop: PASS")
  } finally {
    if (taskId) {
      await siteClient.query("DELETE FROM tbl_task WHERE id = $1", [taskId])
      await client.query(
        `DELETE FROM unified_tasks
         WHERE source_site_id = $1 AND source_id = $2`,
        [SITE_CODE, taskId]
      )
    }
    if (commandNos.length > 0) {
      await client.query(
        "DELETE FROM audit_log WHERE command_no = ANY($1::text[])",
        [commandNos]
      )
    }
    if (commandIds.length > 0) {
      await client.query(
        "DELETE FROM control_command WHERE id = ANY($1::uuid[])",
        [commandIds]
      )
    }
    await client.query(
      `DELETE FROM sync_table_log
       WHERE package_log_id IN (
         SELECT id FROM sync_package_log
         WHERE site_code = $1 AND version = 'r19d-e2e'
       )`,
      [SITE_CODE]
    )
    await client.query(
      `DELETE FROM sync_package_log
       WHERE site_code = $1 AND version = 'r19d-e2e'`,
      [SITE_CODE]
    )
    await siteClient.end()
    await client.end()
    await rm(stateDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error("R.19D signed control API: FAIL", error)
  process.exit(1)
})
