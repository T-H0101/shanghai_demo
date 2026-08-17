/**
 * 站点管理端口可达性探测（总控主动 TCP 连接 db_host:db_port）
 * 不依赖同步推送时间；无真实地址则无法探测。
 */

import { connect as netConnect, type Socket } from "node:net"

export interface TcpProbeResult {
  ok: boolean
  latencyMs: number
  error?: string
}

/**
 * 尝试 TCP 连接 host:port。连通即视为管理端口在线（不等待应用层响应）。
 */
export function probeTcpHost(
  host: string,
  port: number,
  timeoutMs = 2_000,
): Promise<TcpProbeResult> {
  const started = Date.now()
  return new Promise((resolve) => {
    let settled = false
    let socket: Socket | null = null

    const finish = (result: TcpProbeResult) => {
      if (settled) return
      settled = true
      try {
        socket?.destroy()
      } catch {
        /* ignore */
      }
      resolve(result)
    }

    if (!host || host === "—" || host === "site-agent") {
      finish({ ok: false, latencyMs: 0, error: "no_host" })
      return
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      finish({ ok: false, latencyMs: 0, error: "invalid_port" })
      return
    }

    try {
      socket = netConnect({ host, port }, () => {
        finish({ ok: true, latencyMs: Date.now() - started })
      })
      socket.setTimeout(timeoutMs)
      socket.on("timeout", () => {
        finish({ ok: false, latencyMs: Date.now() - started, error: "timeout" })
      })
      socket.on("error", (err: NodeJS.ErrnoException) => {
        finish({
          ok: false,
          latencyMs: Date.now() - started,
          error: err.code || err.message || "connect_error",
        })
      })
    } catch (err) {
      finish({
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : "connect_error",
      })
    }
  })
}

export function isProbeableEndpoint(
  host: string | null | undefined,
  port: number | null | undefined,
): host is string {
  const h = host?.trim()
  if (!h || h === "site-agent" || h === "—") return false
  return typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535
}
