/**
 * 经站点 MultimediumNw 调用任务控制：
 * POST /unified-task-control
 * Nw 验密钥后 TCP → Central center_task_*（实时 status 预检 + 原业务）
 *
 * 与 SSO / unified-sync/trigger 同一入口与密钥体系，不另开端口。
 * 总控侧请用 sync_sites.db_host:db_port 拼基址（见 dispatch-site-task-control）；
 * 本文件的 resolveSiteTaskControlBaseUrl 仅作本地/单站 env 兜底，非生产主路径。
 */

export type SiteTaskControlAction = "pause" | "reset" | "continue"

export type SiteTaskControlReasonCode =
  | "TASK_NOT_FOUND"
  | "TASK_ALREADY_FINISHED"
  | "ALREADY_PAUSED"
  | "NOT_ALLOWED"
  | "USE_RESET_INSTEAD"
  | "EXEC_FAILED"
  | "UNAUTHORIZED"
  | "CENTRAL_UNREACHABLE"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | string

export interface SiteTaskControlResult {
  ok: boolean
  httpStatus: number
  code: number
  accepted: boolean
  reasonCode: SiteTaskControlReasonCode | null
  message: string
  currentStatus: number | null
  raw: unknown
}

export interface SiteTaskControlCallInput {
  baseUrl: string
  secret: string
  taskId: string | number
  action: SiteTaskControlAction
  siteCode?: string | null
  requestedBy?: string | null
  fromBlue?: boolean
  timeoutMs?: number
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "")
}

/** 控制路径，与 Nw 路由一致 */
export function siteTaskControlPath(env: NodeJS.ProcessEnv = process.env): string {
  const p = (env.SITE_TASK_CONTROL_PATH ?? "/unified-task-control").trim()
  return p.startsWith("/") ? p : `/${p}`
}

/**
 * 解析 Nw 基址（默认站点业务 13000，与 SSO/立即推送一致）
 * 优先 SITE_TASK_CONTROL_BASE_URL[_SITE]，否则 SITE_DB_HOST:SITE_DB_PORT / 127.0.0.1:13000
 */
export function resolveSiteTaskControlBaseUrl(
  siteCode: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const code = siteCode.trim().toUpperCase()
  const perSite = env[`SITE_TASK_CONTROL_BASE_URL_${code}`]?.trim()
  if (perSite) return trimSlash(perSite)
  const shared = env.SITE_TASK_CONTROL_BASE_URL?.trim()
  if (shared) return trimSlash(shared)

  const host = (env.SITE_DB_HOST || env.SITE_NW_HOST || "127.0.0.1").trim()
  const portRaw = env.SITE_DB_PORT || env.SITE_NW_PORT || "13000"
  const port = Number(portRaw)
  if (!host || !Number.isFinite(port) || port <= 0) return null
  return `http://${host}:${port}`
}

/** 与 SSO / 立即推送共用密钥；CENTER_CONTROL_SECRET 仅作可选覆盖 */
export function resolveSiteTaskControlSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const s =
    env.CENTER_CONTROL_SECRET?.trim() ||
    env.SITE_SYNC_TRIGGER_SECRET?.trim() ||
    env.SITE_SSO_SECRET?.trim() ||
    ""
  return s || null
}

export async function callSiteTaskControl(
  input: SiteTaskControlCallInput,
): Promise<SiteTaskControlResult> {
  const base = trimSlash(input.baseUrl)
  const path = siteTaskControlPath()
  const url = `${base}${path}`
  const timeoutMs = input.timeoutMs ?? 30_000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-unified-task-control-secret": input.secret,
        "x-unified-sync-secret": input.secret,
        ...(input.siteCode ? { "x-site-code": input.siteCode } : {}),
      },
      body: JSON.stringify({
        action: input.action,
        taskId: input.taskId,
        siteCode: input.siteCode ?? null,
        requestedBy: input.requestedBy ?? null,
        fromBlue: input.fromBlue === true,
      }),
      signal: controller.signal,
    })
    let raw: unknown = null
    try {
      raw = await res.json()
    } catch {
      raw = null
    }
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const code = typeof body.code === "number" ? body.code : res.ok ? 0 : -1
    const accepted = body.accepted === true || code === 0
    return {
      ok: res.ok && accepted,
      httpStatus: res.status,
      code,
      accepted,
      reasonCode: (body.reasonCode as string) ?? (accepted ? null : "EXEC_FAILED"),
      message: typeof body.message === "string" ? body.message : res.statusText || "unknown",
      currentStatus:
        typeof body.currentStatus === "number"
          ? body.currentStatus
          : body.currentStatus == null
            ? null
            : Number(body.currentStatus),
      raw,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      httpStatus: 0,
      code: -1,
      accepted: false,
      reasonCode: "NETWORK_ERROR",
      message,
      currentStatus: null,
      raw: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

/** control_command 类型 → 站点 action */
export function commandTypeToSiteAction(
  commandType: string,
): SiteTaskControlAction | null {
  if (commandType === "task_pause") return "pause"
  if (commandType === "task_resume" || commandType === "task_reset") return "reset"
  return null
}
