import { randomBytes } from "node:crypto"
import { signSiteAgentRequest } from "../hmac"
import type { AgentControlCommand, SiteActionResult } from "./types"

export interface ControlTransport {
  poll(limit: number): Promise<AgentControlCommand[]>
  ack(commandId: string): Promise<void>
  result(commandId: string, result: SiteActionResult): Promise<void>
}

export class ControlHttpTransport implements ControlTransport {
  constructor(
    private readonly platformUrl: string,
    private readonly siteCode: string,
    private readonly secret: string
  ) {}

  async poll(limit: number): Promise<AgentControlCommand[]> {
    const path = `/api/site-control/commands?siteCode=${encodeURIComponent(
      this.siteCode
    )}&limit=${Math.max(1, Math.min(limit, 100))}`
    const response = await this.request("GET", path, "")
    const body = (await response.json()) as {
      commands?: AgentControlCommand[]
    }
    return body.commands ?? []
  }

  async ack(commandId: string): Promise<void> {
    const path = `/api/site-control/commands/${encodeURIComponent(
      commandId
    )}/ack`
    const rawBody = JSON.stringify({ siteCode: this.siteCode })
    await this.request("POST", path, rawBody)
  }

  async result(
    commandId: string,
    result: SiteActionResult
  ): Promise<void> {
    const path = `/api/site-control/commands/${encodeURIComponent(
      commandId
    )}/result`
    const rawBody = JSON.stringify({
      siteCode: this.siteCode,
      status: result.status,
      result,
      errorMessage:
        result.status === "success"
          ? undefined
          : result.reason ?? result.blocker ?? result.status,
    })
    await this.request("POST", path, rawBody)
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    rawBody: string
  ): Promise<Response> {
    const timestamp = String(Date.now())
    const nonce = randomBytes(16).toString("hex")
    const signature = signSiteAgentRequest({
      siteCode: this.siteCode,
      timestamp,
      nonce,
      method,
      path,
      rawBody,
      secret: this.secret,
    })
    const response = await fetch(`${this.platformUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-site-code": this.siteCode,
        "x-agent-timestamp": timestamp,
        "x-agent-nonce": nonce,
        "x-agent-signature": signature,
      },
      body: method === "POST" ? rawBody : undefined,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
        error?: string
        code?: string
      }
      throw new Error(
        `control request failed: HTTP ${response.status} ${
          body.code ?? body.error ?? body.message ?? ""
        }`.trim()
      )
    }
    return response
  }
}
