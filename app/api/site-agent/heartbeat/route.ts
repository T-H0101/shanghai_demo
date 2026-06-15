import { NextRequest, NextResponse } from "next/server"
import { transaction } from "@/lib/db"
import { verifySiteAgentRequest } from "@/lib/site-agent/hmac"
import { consumeSiteAgentNonce } from "@/lib/site-agent/nonce-store"

export const dynamic = "force-dynamic"

const SITE_CODE_PATTERN = /^[A-Za-z0-9_-]{1,50}$/
const FORBIDDEN_RUNTIME_KEY = /password|secret|token|database.?url|credential/i

interface HeartbeatPayload {
  siteCode: string
  agentId: string
  agentVersion: string
  startedAt: string | null
  reportedAt: string
  databaseReachable: boolean
  lastSyncAt: string | null
  lastControlAt: string | null
  spoolDepth: number
  capabilities: Record<string, unknown>
}

function isIsoDate(value: unknown, nullable = false): value is string | null {
  if (nullable && value === null) return true
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  return Object.entries(value).some(
    ([key, nested]) =>
      FORBIDDEN_RUNTIME_KEY.test(key) || containsForbiddenKey(nested)
  )
}

function parsePayload(value: unknown): HeartbeatPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (
    typeof body.siteCode !== "string" ||
    !SITE_CODE_PATTERN.test(body.siteCode) ||
    typeof body.agentId !== "string" ||
    body.agentId.length < 1 ||
    body.agentId.length > 100 ||
    typeof body.agentVersion !== "string" ||
    body.agentVersion.length < 1 ||
    body.agentVersion.length > 50 ||
    !isIsoDate(body.startedAt, true) ||
    !isIsoDate(body.reportedAt) ||
    typeof body.databaseReachable !== "boolean" ||
    !isIsoDate(body.lastSyncAt, true) ||
    !isIsoDate(body.lastControlAt, true) ||
    !Number.isInteger(body.spoolDepth) ||
    (body.spoolDepth as number) < 0 ||
    !body.capabilities ||
    typeof body.capabilities !== "object" ||
    Array.isArray(body.capabilities) ||
    containsForbiddenKey(body.capabilities)
  ) {
    return null
  }

  return {
    siteCode: body.siteCode,
    agentId: body.agentId,
    agentVersion: body.agentVersion,
    startedAt: body.startedAt,
    reportedAt: body.reportedAt as string,
    databaseReachable: body.databaseReachable,
    lastSyncAt: body.lastSyncAt,
    lastControlAt: body.lastControlAt,
    spoolDepth: body.spoolDepth as number,
    capabilities: body.capabilities as Record<string, unknown>,
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody, "utf8") > 64 * 1024) {
    return NextResponse.json(
      { code: "PAYLOAD_TOO_LARGE", message: "heartbeat payload exceeds 64 KiB" },
      { status: 413 }
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "heartbeat body must be valid JSON" },
      { status: 400 }
    )
  }

  const payloadSiteCode =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? String((parsed as Record<string, unknown>).siteCode ?? "")
      : null
  const auth = verifySiteAgentRequest({
    siteCode: request.headers.get("x-site-code"),
    timestamp: request.headers.get("x-agent-timestamp"),
    nonce: request.headers.get("x-agent-nonce"),
    signature: request.headers.get("x-agent-signature"),
    method: request.method,
    path: request.nextUrl.pathname,
    rawBody,
    payloadSiteCode,
  })
  if (!auth.ok) {
    const status = auth.code === "AUTH_NOT_CONFIGURED" ? 503 : 401
    return NextResponse.json(
      { code: auth.code, message: auth.message },
      { status }
    )
  }

  const payload = parsePayload(parsed)
  if (!payload) {
    return NextResponse.json(
      {
        code: "INVALID_PAYLOAD",
        message:
          "heartbeat fields are invalid or capabilities contain secret-like keys",
      },
      { status: 400 }
    )
  }

  const nonce = request.headers.get("x-agent-nonce")!
  try {
    const nonceResult = await consumeSiteAgentNonce(payload.siteCode, nonce)
    if (!nonceResult.ok) {
      return NextResponse.json(
        {
          code: nonceResult.code,
          message:
            nonceResult.code === "UNKNOWN_SITE"
              ? "siteCode is not registered in sync_sites"
              : "nonce has already been used",
        },
        { status: nonceResult.code === "UNKNOWN_SITE" ? 404 : 409 }
      )
    }

    const result = await transaction(async (client) => {
      const runtimeJson = {
        siteCode: payload.siteCode,
        agentId: payload.agentId,
        agentVersion: payload.agentVersion,
        startedAt: payload.startedAt,
        reportedAt: payload.reportedAt,
        databaseReachable: payload.databaseReachable,
        lastSyncAt: payload.lastSyncAt,
        lastControlAt: payload.lastControlAt,
        spoolDepth: payload.spoolDepth,
        capabilities: payload.capabilities,
      }
      const runtimeResult = await client.query(
        `INSERT INTO site_agent_runtime (
           site_code, agent_id, agent_version, started_at, reported_at,
           database_reachable, last_sync_at, last_control_at, spool_depth,
           capabilities, runtime_json
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
         ON CONFLICT (site_code) DO UPDATE SET
           agent_id = EXCLUDED.agent_id,
           agent_version = EXCLUDED.agent_version,
           started_at = EXCLUDED.started_at,
           reported_at = EXCLUDED.reported_at,
           database_reachable = EXCLUDED.database_reachable,
           last_sync_at = EXCLUDED.last_sync_at,
           last_control_at = EXCLUDED.last_control_at,
           spool_depth = EXCLUDED.spool_depth,
           capabilities = EXCLUDED.capabilities,
           runtime_json = EXCLUDED.runtime_json,
           updated_at = NOW()
         RETURNING site_code, agent_id, agent_version, reported_at::text`,
        [
          payload.siteCode,
          payload.agentId,
          payload.agentVersion,
          payload.startedAt,
          payload.reportedAt,
          payload.databaseReachable,
          payload.lastSyncAt,
          payload.lastControlAt,
          payload.spoolDepth,
          JSON.stringify(payload.capabilities),
          JSON.stringify(runtimeJson),
        ]
      )
      await client.query(
        `UPDATE sync_sites
         SET last_connected_at = $2
         WHERE site_code = $1`,
        [payload.siteCode, payload.reportedAt]
      )
      return { kind: "recorded" as const, row: runtimeResult.rows[0] }
    })

    const row = result.row
    return NextResponse.json({
      code: 0,
      message: "heartbeat recorded",
      data: {
        siteCode: row.site_code,
        agentId: row.agent_id,
        agentVersion: row.agent_version,
        reportedAt: row.reported_at,
      },
      dataSource: "site_agent_runtime",
      traceId: `api-${Date.now()}`,
    })
  } catch (error) {
    console.error("[API Error] /api/site-agent/heartbeat:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        dataSource: "error",
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
