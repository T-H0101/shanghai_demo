/**
 * 站点在线状态 — 以总控对 sync_sites.db_host:db_port 的主动 TCP 探测为准。
 *
 * 不同步：最近推过包 ≠ 业务还在跑；无数据变化关闭推送时仍应可探测为在线。
 * Agent 心跳仅作辅助说明，不再单独决定「在线」。
 */

import type { TcpProbeResult } from "./probe-tcp"
import { isProbeableEndpoint } from "./probe-tcp"

export type ReachabilitySource =
  | "disabled"
  | "tcp_probe"
  | "no_address"
  | "probe_error"

export type SiteReachabilityStatus = "online" | "offline"

export interface SiteReachability {
  status: SiteReachabilityStatus
  source: ReachabilitySource
  note: string
}

export function deriveSiteReachability(input: {
  enabled: boolean
  dbHost?: string | null
  dbPort?: number | null
  /** 已完成的 TCP 探测结果；有真实地址时应传入 */
  probe?: TcpProbeResult | null
}): SiteReachability {
  if (!input.enabled) {
    return {
      status: "offline",
      source: "disabled",
      note: "站点已在总控禁用",
    }
  }

  if (!isProbeableEndpoint(input.dbHost, input.dbPort)) {
    return {
      status: "offline",
      source: "no_address",
      note: "未登记真实管理 IP/端口（db_host），无法主动探测；请站点推送 db_host/db_port",
    }
  }

  const host = input.dbHost.trim()
  const port = input.dbPort as number

  if (!input.probe) {
    return {
      status: "offline",
      source: "probe_error",
      note: `未执行对 ${host}:${port} 的探测`,
    }
  }

  if (input.probe.ok) {
    return {
      status: "online",
      source: "tcp_probe",
      note: `管理端口 ${host}:${port} TCP 可达（${input.probe.latencyMs}ms）`,
    }
  }

  return {
    status: "offline",
    source: "tcp_probe",
    note: `管理端口 ${host}:${port} 不通（${input.probe.error ?? "connect_failed"}，${input.probe.latencyMs}ms）`,
  }
}

/** 与 /api/sync/sites/status 的 agentStatus 字段对齐（同步中心展示用，非站点列表在线） */
export function deriveAgentProbeStatus(input: {
  agentReportedAt?: string | null
  agentDatabaseReachable?: boolean | null
  now?: number
}): "not_registered" | "online" | "degraded" | "stale" | "offline" {
  const AGENT_ONLINE_MS = 5 * 60 * 1000
  const AGENT_STALE_MS = 15 * 60 * 1000
  if (!input.agentReportedAt) return "not_registered"
  const ageMs = (input.now ?? Date.now()) - Date.parse(input.agentReportedAt)
  if (Number.isNaN(ageMs)) return "offline"
  if (ageMs <= AGENT_ONLINE_MS) {
    return input.agentDatabaseReachable ? "online" : "degraded"
  }
  if (ageMs <= AGENT_STALE_MS) return "stale"
  return "offline"
}
