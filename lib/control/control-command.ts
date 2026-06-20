/**
 * Sprint 4.5 - control_command 服务层
 *
 * 职责:
 *  - 创建控制命令 (Sprint 4.2-C 方案 2 落地)
 *  - 列表/详情查询
 *  - 站点拉取标记 (markCommandPulled)
 *  - 站点回写结果 (markCommandResult)
 *
 * 严格边界 (CLAUDE.md + Sprint 4.2 收敛):
 *  - **不直接改 unified_tasks 状态** (不是控制器, 只是命令队列)
 *  - **不伪造执行结果** (站点没回写就是 pending/pulled)
 *  - **不读 HMAC 协议** (Sprint 2G.1 已定型)
 *  - **参数化 SQL** (不信任前端输入)
 */

import { query, transaction } from "@/lib/db/postgres"
import { randomBytes } from "crypto"

// ============================================================
// 类型定义
// ============================================================

export const COMMAND_TYPES = [
  "task_pause",
  "task_resume",
  "task_reset",
  "inspect_start",
  "recovery_start",
  // Sprint R.4 Bug 5: 新增 task_priority_restore (优先恢复)
  // 真执行需 tbl_task.priority 字段, R.4 已加 schema 检测, 缺字段返回 unsupported + blocked_by_source_schema
  "task_priority_restore",
  // Sprint R.39: 同步策略闭环
  "sync_full",
  "sync_incremental",
  // Sprint R.58: 总控创建站点任务
  "task_create",
  // Sprint R.64: 笼位移动注册
  "cage_move_register",
  // Sprint R.66: 权限同步候选
  "permission_sync",
] as const
export type CommandType = (typeof COMMAND_TYPES)[number]

export const TARGET_TYPES = ["task", "device", "volume", "media", "site", "cage", "user"] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export const COMMAND_STATUSES = [
  "pending",
  "pulled",
  "running",
  "success",
  "failed",
  "cancelled",
  // Sprint R.4 Bug 4 新增: 缺字段 / 缺源端支持
  "unsupported",
  // Sprint R.4 Bug 4 新增: DRY_RUN 模式显式区分
  "dry_run_success",
] as const
export type CommandStatus = (typeof COMMAND_STATUSES)[number]

export interface CreateControlCommandInput {
  sourceSiteId: string
  commandType: CommandType
  targetType: TargetType
  targetId: string
  payload?: Record<string, unknown>
  requestedBy?: string | null
  requestedIp?: string | null
}

export interface ControlCommandRow {
  id: string
  commandNo: string
  sourceSiteId: string
  commandType: CommandType
  targetType: TargetType
  targetId: string
  payload: Record<string, unknown>
  status: CommandStatus
  requestedBy: string | null
  requestedIp: string | null
  requestedAt: string
  pulledAt: string | null
  completedAt: string | null
  result: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ListControlCommandFilter {
  sourceSiteId?: string
  commandType?: CommandType
  status?: CommandStatus
  limit?: number
  offset?: number
}

// ============================================================
// 工具
// ============================================================

function genCommandNo(sourceSiteId: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14) // YYYYMMDDHHmmss
  const rand = randomBytes(2).toString("hex").toUpperCase()
  return `CTRL-${sourceSiteId}-${ts}-${rand}`
}

function rowToCommand(r: any): ControlCommandRow {
  return {
    id: r.id,
    commandNo: r.command_no,
    sourceSiteId: r.source_site_id,
    commandType: r.command_type,
    targetType: r.target_type,
    targetId: r.target_id,
    payload: r.payload ?? {},
    status: r.status,
    requestedBy: r.requested_by,
    requestedIp: r.requested_ip,
    requestedAt: r.requested_at?.toISOString?.() ?? r.requested_at,
    pulledAt: r.pulled_at?.toISOString?.() ?? r.pulled_at ?? null,
    completedAt: r.completed_at?.toISOString?.() ?? r.completed_at ?? null,
    result: r.result ?? null,
    errorMessage: r.error_message ?? null,
    createdAt: r.created_at?.toISOString?.() ?? r.created_at,
    updatedAt: r.updated_at?.toISOString?.() ?? r.updated_at,
  }
}

// ============================================================
// 5 个核心函数
// ============================================================

/**
 * 创建一条控制命令
 * - 自动生成 command_no
 * - status 默认 'pending'
 * - 不修改 unified_tasks
 */
export async function createControlCommand(
  input: CreateControlCommandInput
): Promise<ControlCommandRow> {
  if (!COMMAND_TYPES.includes(input.commandType)) {
    throw new Error(`invalid command_type: ${input.commandType}`)
  }
  if (!TARGET_TYPES.includes(input.targetType)) {
    throw new Error(`invalid target_type: ${input.targetType}`)
  }
  if (!input.sourceSiteId || input.sourceSiteId.length > 32) {
    throw new Error("invalid sourceSiteId")
  }
  if (!input.targetId || input.targetId.length > 64) {
    throw new Error("invalid targetId")
  }

  const commandNo = genCommandNo(input.sourceSiteId)
  const result = await query<any>(
    `INSERT INTO control_command
       (command_no, source_site_id, command_type, target_type, target_id,
        payload, status, requested_by, requested_ip)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', $7, $8)
     RETURNING *`,
    [
      commandNo,
      input.sourceSiteId,
      input.commandType,
      input.targetType,
      input.targetId,
      JSON.stringify(input.payload ?? {}),
      input.requestedBy ?? null,
      input.requestedIp ?? null,
    ]
  )
  return rowToCommand(result.rows[0])
}

/**
 * 列表查询 (总控侧 + 站点侧都用)
 */
export async function listControlCommands(
  filter: ListControlCommandFilter = {}
): Promise<{ rows: ControlCommandRow[]; total: number }> {
  const conds: string[] = []
  const params: any[] = []
  let i = 1
  if (filter.sourceSiteId) {
    conds.push(`source_site_id = $${i++}`)
    params.push(filter.sourceSiteId)
  }
  if (filter.commandType) {
    conds.push(`command_type = $${i++}`)
    params.push(filter.commandType)
  }
  if (filter.status) {
    conds.push(`status = $${i++}`)
    params.push(filter.status)
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""
  const limit = Math.min(filter.limit ?? 100, 500)
  const offset = filter.offset ?? 0

  const rowsRes = await query<any>(
    `SELECT * FROM control_command ${where}
     ORDER BY requested_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  )
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM control_command ${where}`,
    params
  )
  return {
    rows: rowsRes.rows.map(rowToCommand),
    total: parseInt(countRes.rows[0]?.count ?? "0", 10),
  }
}

/**
 * 单条查询
 */
export async function getControlCommand(
  id: string
): Promise<ControlCommandRow | null> {
  if (!id) return null
  // R.16 修复: id 是 uuid, command_no 是 text; 不能直接 $1 通用
  // 先按 id 查 (uuid cast), 没命中再按 command_no 查
  const byId = await query<any>(
    `SELECT * FROM control_command WHERE id = $1::uuid LIMIT 1`,
    [id]
  )
  if (byId.rows[0]) return rowToCommand(byId.rows[0])
  const byNo = await query<any>(
    `SELECT * FROM control_command WHERE command_no = $1 LIMIT 1`,
    [id]
  )
  return byNo.rows[0] ? rowToCommand(byNo.rows[0]) : null
}

/**
 * 站点拉取: pending → pulled
 * 一次只拉一条 (避免站点重复执行)
 */
export async function markCommandPulled(
  id: string
): Promise<ControlCommandRow | null> {
  const res = await query<any>(
    `UPDATE control_command
     SET status = 'pulled', pulled_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id]
  )
  return res.rows[0] ? rowToCommand(res.rows[0]) : null
}

export async function claimControlCommands(input: {
  sourceSiteId: string
  limit: number
  leaseMs: number
}): Promise<ControlCommandRow[]> {
  const limit = Math.max(1, Math.min(input.limit, 100))
  const leaseMs = Math.max(5_000, Math.min(input.leaseMs, 10 * 60 * 1000))
  return transaction(async (client) => {
    const result = await client.query(
      `WITH candidates AS (
         SELECT id
         FROM control_command
         WHERE source_site_id = $1
           AND (
             status = 'pending'
             OR (
               status = 'pulled'
               AND pulled_at < NOW() - ($3::integer * INTERVAL '1 millisecond')
             )
           )
         ORDER BY requested_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE control_command AS command
       SET status = 'pulled',
           pulled_at = NOW(),
           updated_at = NOW()
       FROM candidates
       WHERE command.id = candidates.id
       RETURNING command.*`,
      [input.sourceSiteId, limit, leaseMs]
    )
    return result.rows.map(rowToCommand)
  })
}

export async function markCommandRunning(
  id: string,
  sourceSiteId: string
): Promise<ControlCommandRow | null> {
  const result = await query(
    `UPDATE control_command
     SET status = 'running', updated_at = NOW()
     WHERE id = $1::uuid
       AND source_site_id = $2
       AND status = 'pulled'
     RETURNING *`,
    [id, sourceSiteId]
  )
  return result.rows[0] ? rowToCommand(result.rows[0]) : null
}

/**
 * 站点回写结果: pulled/running → success / failed / cancelled
 */
export async function markCommandResult(
  id: string,
  sourceSiteId: string,
  status: "success" | "failed" | "cancelled" | "unsupported",
  resultOrError: {
    result?: Record<string, unknown>
    errorMessage?: string
  }
): Promise<
  | { kind: "updated"; row: ControlCommandRow }
  | { kind: "idempotent"; row: ControlCommandRow }
  | { kind: "not_found" }
  | { kind: "invalid_state" }
  | { kind: "conflict" }
> {
  if (!["success", "failed", "cancelled", "unsupported"].includes(status)) {
    throw new Error(`invalid final status: ${status}`)
  }
  return transaction(async (client) => {
    const selected = await client.query(
      `SELECT * FROM control_command
       WHERE id = $1::uuid AND source_site_id = $2
       FOR UPDATE`,
      [id, sourceSiteId]
    )
    if (selected.rowCount === 0) return { kind: "not_found" as const }

    const current = rowToCommand(selected.rows[0])
    const finalStatuses: CommandStatus[] = [
      "success",
      "failed",
      "cancelled",
      "unsupported",
    ]
    const nextResult = resultOrError.result ?? null
    const nextError = resultOrError.errorMessage ?? null
    if (finalStatuses.includes(current.status)) {
      const comparison = await client.query<{ same: boolean }>(
        `SELECT
           $1::text = $2::text
           AND $3::jsonb IS NOT DISTINCT FROM $4::jsonb
           AND $5::text IS NOT DISTINCT FROM $6::text AS same`,
        [
          current.status,
          status,
          JSON.stringify(current.result ?? null),
          JSON.stringify(nextResult),
          current.errorMessage ?? null,
          nextError,
        ]
      )
      const same = comparison.rows[0]?.same === true
      return same
        ? { kind: "idempotent" as const, row: current }
        : { kind: "conflict" as const }
    }
    if (current.status !== "running") {
      return { kind: "invalid_state" as const }
    }

    const updated = await client.query(
      `UPDATE control_command
       SET status = $3,
           completed_at = NOW(),
           result = $4::jsonb,
           error_message = $5,
           updated_at = NOW()
       WHERE id = $1::uuid AND source_site_id = $2
       RETURNING *`,
      [id, sourceSiteId, status, JSON.stringify(nextResult), nextError]
    )
    const resultRecord =
      nextResult && typeof nextResult === "object"
        ? (nextResult as Record<string, unknown>)
        : {}
    await client.query(
      `INSERT INTO audit_log (
         command_no, action, target_table, target_id,
         before_json, after_json, actor, actor_ip,
         site_code, dry_run, result, error_message
       )
       VALUES (
         $1, $2, $3, $4,
         $5::jsonb, $6::jsonb, $7, $8,
         $9, FALSE, $10, $11
       )`,
      [
        current.commandNo,
        current.commandType,
        current.targetType === "task" ? "tbl_task" : current.targetType,
        current.targetId,
        JSON.stringify(resultRecord.before ?? null),
        JSON.stringify(resultRecord.after ?? null),
        "site-agent",
        null,
        sourceSiteId,
        status,
        nextError,
      ]
    )
    return {
      kind: "updated" as const,
      row: rowToCommand(updated.rows[0]),
    }
  })
}
