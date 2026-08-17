/**
 * 总控直调站点业务 HTTP 执行任务控制（暂停 / 重置并继续）。
 *
 * 部署前提：站点不装 Site Agent；与 SSO / 立即推送相同，
 * 用 sync_sites.db_host:db_port → MultimediumNw /unified-task-control
 * → Central 实时 status 预检 → 原 pauseTask / resetTask。
 *
 * control_command 仅作审计留痕，不再等待 Agent 拉取。
 */

import { query } from "@/lib/db"
import { writeAudit } from "@/lib/control/audit"
import {
  createControlCommand,
  type CommandType,
  type ControlCommandRow,
} from "@/lib/control/control-command"
import {
  callSiteTaskControl,
  commandTypeToSiteAction,
  resolveSiteTaskControlSecret,
  siteTaskControlPath,
  type SiteTaskControlResult,
} from "@/lib/control/site-task-control-client"
import { isProbeableEndpoint } from "@/lib/site/probe-tcp"

const DIRECT_COMMAND_TYPES = new Set<CommandType>([
  "task_pause",
  "task_resume",
  "task_reset",
])

export function isDirectSiteTaskControlType(
  commandType: string,
): commandType is "task_pause" | "task_resume" | "task_reset" {
  return DIRECT_COMMAND_TYPES.has(commandType as CommandType)
}

interface SyncSiteRow {
  site_code: string
  site_name: string
  db_host: string
  db_port: number
  enabled: boolean
}

export interface DispatchSiteTaskControlInput {
  sourceSiteId: string
  commandType: "task_pause" | "task_resume" | "task_reset"
  targetId: string
  payload?: Record<string, unknown>
  requestedBy?: string | null
  requestedIp?: string | null
}

export interface DispatchSiteTaskControlResult {
  ok: boolean
  command: ControlCommandRow
  site: SiteTaskControlResult | null
  message: string
  url: string | null
  httpStatus: number
}

function unifiedStatusFromSite(
  commandType: string,
  currentStatus: number | null,
): string | null {
  if (commandType === "task_pause") return "paused"
  if (currentStatus === 20) return "paused"
  if (currentStatus === 1) return "data_preparing"
  if (currentStatus === 19) return "make_task_done_backup_running"
  if (currentStatus === 9) return "running"
  if (commandType === "task_resume" || commandType === "task_reset") {
    return "data_preparing"
  }
  return null
}

async function reflectUnifiedTaskStatus(input: {
  siteCode: string
  sourceTaskId: string
  commandType: string
  currentStatus: number | null
}): Promise<void> {
  const status = unifiedStatusFromSite(input.commandType, input.currentStatus)
  if (!status) return
  const phase =
    status === "paused"
      ? "paused"
      : status === "data_preparing" || status === "make_task_done_backup_running"
        ? "running"
        : null
  await query(
    `UPDATE unified_tasks
     SET status = $3,
         phase = COALESCE($4, phase),
         updated_at = NOW()
     WHERE source_site_id = $1
       AND source_table = 'tbl_task'
       AND source_id = $2`,
    [input.siteCode, input.sourceTaskId, status, phase],
  )
}

/**
 * 写入审计命令并同步调用站点业务接口执行。
 */
export async function dispatchSiteTaskControl(
  input: DispatchSiteTaskControlInput,
): Promise<DispatchSiteTaskControlResult> {
  const siteCode = input.sourceSiteId.trim().toUpperCase()
  const action = commandTypeToSiteAction(input.commandType)
  if (!action) {
    throw new Error(`unsupported commandType for site HTTP: ${input.commandType}`)
  }

  const secret = resolveSiteTaskControlSecret()
  if (!secret || secret.length < 16) {
    throw new Error(
      "未配置 SITE_SSO_SECRET / SITE_SYNC_TRIGGER_SECRET，无法调用站点任务控制（须与 Nw unifiedDiscSso.secretKey 一致）",
    )
  }

  const siteRes = await query<SyncSiteRow>(
    `SELECT site_code, site_name, db_host, db_port, enabled
     FROM sync_sites
     WHERE site_code = $1
     LIMIT 1`,
    [siteCode],
  )
  const site = siteRes.rows[0]
  if (!site) {
    throw new Error(`站点未注册: ${siteCode}`)
  }
  if (!site.enabled) {
    throw new Error(`站点已在总控禁用: ${siteCode}`)
  }
  if (!isProbeableEndpoint(site.db_host, site.db_port)) {
    throw new Error(
      `站点未登记真实业务地址（db_host:db_port）: ${siteCode}`,
    )
  }

  const envOverride =
    process.env[`SITE_TASK_CONTROL_BASE_URL_${siteCode}`]?.trim() ||
    process.env.SITE_TASK_CONTROL_BASE_URL?.trim() ||
    ""
  const baseUrl = envOverride
    ? envOverride.replace(/\/+$/, "")
    : `http://${site.db_host.trim()}:${site.db_port}`
  const url = `${baseUrl}${siteTaskControlPath()}`

  const command = await createControlCommand({
    sourceSiteId: siteCode.slice(0, 32),
    commandType: input.commandType,
    targetType: "task",
    targetId: input.targetId.slice(0, 64),
    payload: {
      ...(input.payload ?? {}),
      protocol: "site-http-task-control",
      url,
      action,
    },
    requestedBy: input.requestedBy ?? null,
    requestedIp: input.requestedIp ?? null,
  })

  const siteResult = await callSiteTaskControl({
    baseUrl,
    secret,
    taskId: input.targetId,
    action,
    siteCode,
    requestedBy: input.requestedBy ?? null,
  })

  const finalStatus = siteResult.ok ? "success" : "failed"
  const errorMessage = siteResult.ok
    ? null
    : siteResult.message || siteResult.reasonCode || "站点任务控制失败"

  const updated = await query<{
    id: string
    command_no: string
    source_site_id: string
    command_type: string
    target_type: string
    target_id: string
    payload: Record<string, unknown>
    status: string
    requested_by: string | null
    requested_ip: string | null
    requested_at: Date | string
    pulled_at: Date | string | null
    completed_at: Date | string | null
    result: Record<string, unknown> | null
    error_message: string | null
    created_at: Date | string
    updated_at: Date | string
  }>(
    `UPDATE control_command
     SET status = $2,
         pulled_at = COALESCE(pulled_at, NOW()),
         completed_at = NOW(),
         result = $3::jsonb,
         error_message = $4,
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [
      command.id,
      finalStatus,
      JSON.stringify({
        protocol: "site-http-task-control",
        url,
        action,
        site: {
          ok: siteResult.ok,
          httpStatus: siteResult.httpStatus,
          code: siteResult.code,
          accepted: siteResult.accepted,
          reasonCode: siteResult.reasonCode,
          message: siteResult.message,
          currentStatus: siteResult.currentStatus,
        },
      }),
      errorMessage,
    ],
  )

  const row = updated.rows[0]
  const commandOut: ControlCommandRow = {
    id: row.id,
    commandNo: row.command_no,
    sourceSiteId: row.source_site_id,
    commandType: row.command_type as CommandType,
    targetType: row.target_type as ControlCommandRow["targetType"],
    targetId: row.target_id,
    payload: row.payload ?? {},
    status: row.status as ControlCommandRow["status"],
    requestedBy: row.requested_by,
    requestedIp: row.requested_ip,
    requestedAt:
      row.requested_at instanceof Date
        ? row.requested_at.toISOString()
        : String(row.requested_at),
    pulledAt:
      row.pulled_at instanceof Date
        ? row.pulled_at.toISOString()
        : row.pulled_at
          ? String(row.pulled_at)
          : null,
    completedAt:
      row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : row.completed_at
          ? String(row.completed_at)
          : null,
    result: row.result,
    errorMessage: row.error_message,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }

  if (siteResult.ok) {
    try {
      await reflectUnifiedTaskStatus({
        siteCode,
        sourceTaskId: input.targetId,
        commandType: input.commandType,
        currentStatus: siteResult.currentStatus,
      })
    } catch (e) {
      console.error("[dispatch-site-task-control] reflect unified_tasks failed:", e)
    }
  }

  await writeAudit({
    commandNo: command.commandNo,
    action: input.commandType,
    targetTable: "tbl_task",
    targetId: input.targetId,
    after: {
      protocol: "site-http-task-control",
      url,
      siteOk: siteResult.ok,
      reasonCode: siteResult.reasonCode,
      currentStatus: siteResult.currentStatus,
      message: siteResult.message,
    },
    actor: input.requestedBy ?? "center",
    siteCode,
    result: siteResult.ok ? "success" : "failed",
    errorMessage,
  })

  return {
    ok: siteResult.ok,
    command: commandOut,
    site: siteResult,
    message: siteResult.ok
      ? "请求成功"
      : siteResult.message || "站点任务控制失败",
    url,
    httpStatus: siteResult.httpStatus,
  }
}
