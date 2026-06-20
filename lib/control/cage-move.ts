/**
 * lib/control/cage-move.ts
 * Sprint R.64 — center command for registering cage moves.
 *
 * Per the plan, the station write requires a tbl_cage_move_log or
 * similar table. If none exists in star_storage_db / source_restore,
 * the center records the move intent in `unified_cage_move_log` only
 * as `implemented_candidate` and returns
 * `blocked_by_source_schema` for the station-side write.
 */

import { Client } from "pg"
import { query } from "@/lib/db/postgres"
import { createControlCommand } from "@/lib/control/control-command"
import { writeAudit } from "@/lib/control/audit"

export interface CageMoveInput {
  sourceSiteCode: string
  targetSiteCode: string
  cageId: string
  operator: string
  approvalStatus: "pending" | "approved" | "rejected"
  ip?: string
}

export interface CageMoveResult {
  commandId: string
  commandNo: string
  status: "queued" | "blocked_by_source_schema"
  centerLogId: string
  blocker?: string
  message: string
}

const CANDIDATE_TABLES = [
  "tbl_cage_move_log",
  "tbl_magazine_move_log",
  "tbl_disc_lib_move_log",
] as const

async function findStationMoveTable(
  client: Client
): Promise<string | null> {
  for (const tbl of CANDIDATE_TABLES) {
    const r = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name=$1`,
      [tbl]
    )
    if (r.rowCount && r.rowCount > 0) return tbl
  }
  return null
}

export async function registerCageMove(
  input: CageMoveInput
): Promise<CageMoveResult> {
  if (!input.cageId) {
    throw new Error("cageId is required")
  }

  // 1. Always write a center-side unified_cage_move_log row (candidate evidence)
  let unifiedTableExists = false
  try {
    const t = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name='unified_cage_move_log'`
    )
    unifiedTableExists = (t.rowCount ?? 0) > 0
  } catch {
    unifiedTableExists = false
  }
  let centerLogId = ""
  if (unifiedTableExists) {
    const ins = await query<{ id: string }>(
      `INSERT INTO unified_cage_move_log
       (source_site_id, target_site_id, cage_id, operator, approval_status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [
        input.sourceSiteCode,
        input.targetSiteCode,
        input.cageId,
        input.operator,
        input.approvalStatus,
      ]
    )
    centerLogId = ins.rows[0]?.id ?? ""
  } else {
    centerLogId = `cand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // 2. Create control command
  const command = await createControlCommand({
    sourceSiteId: input.sourceSiteCode,
    commandType: "cage_move_register",
    targetType: "cage",
    targetId: input.cageId,
    payload: {
      sourceSiteCode: input.sourceSiteCode,
      targetSiteCode: input.targetSiteCode,
      cageId: input.cageId,
      operator: input.operator,
      approvalStatus: input.approvalStatus,
    },
    requestedBy: input.operator,
    requestedIp: input.ip ?? "unknown",
  })

  // 3. Detect station-side move table
  const stationUrl =
    process.env.SITE_DATABASE_URL ??
    process.env.SOURCE_DATABASE_URL ??
    process.env.SITE_RESTORE_DATABASE_URL
  let blocker: string | undefined
  let status: CageMoveResult["status"] = "queued"
  if (!stationUrl) {
    blocker = "site_database_url_not_configured"
    status = "blocked_by_source_schema"
  } else {
    const client = new Client({ connectionString: stationUrl })
    try {
      await client.connect()
      const tbl = await findStationMoveTable(client)
      if (!tbl) {
        blocker = `none of [${CANDIDATE_TABLES.join(", ")}] available`
        status = "blocked_by_source_schema"
      }
    } catch (err) {
      blocker = err instanceof Error ? err.message : "station_unreachable"
      status = "blocked_by_source_schema"
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  await writeAudit({
    action: "cage_move_registered",
    targetTable: "unified_cage_move_log",
    targetId: centerLogId,
    after: {
      commandNo: command.commandNo,
      sourceSiteCode: input.sourceSiteCode,
      targetSiteCode: input.targetSiteCode,
      cageId: input.cageId,
      status,
    },
    actor: input.operator,
    siteCode: input.sourceSiteCode,
    result: status === "queued" ? "success" : "failed",
  })

  return {
    commandId: command.id,
    commandNo: command.commandNo,
    status,
    centerLogId,
    blocker,
    message:
      status === "queued"
        ? "Cage move command queued, 等待站点 Agent 执行"
        : `Cage move command queued but station write blocked: ${blocker}`,
  }
}
