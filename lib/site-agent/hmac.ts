import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { getSiteAgentSecret } from "./config"

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000

export interface VerifySiteAgentRequestInput {
  siteCode: string | null
  timestamp: string | null
  nonce: string | null
  signature: string | null
  method: string
  path: string
  rawBody: string
  payloadSiteCode: string | null
  now?: number
}

export type SiteAgentAuthCode =
  | "OK"
  | "AUTH_NOT_CONFIGURED"
  | "MISSING_HEADER"
  | "INVALID_TIMESTAMP"
  | "EXPIRED_TIMESTAMP"
  | "SITE_CODE_MISMATCH"
  | "INVALID_SIGNATURE"

export interface SiteAgentAuthResult {
  ok: boolean
  code: SiteAgentAuthCode
  message: string
}

export function buildSiteAgentSigningString(input: {
  siteCode: string
  timestamp: string
  nonce: string
  method: string
  path: string
  rawBody: string
}): string {
  const bodyHash = createHash("sha256").update(input.rawBody, "utf8").digest("hex")
  return [
    input.siteCode,
    input.timestamp,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    bodyHash,
  ].join("\n")
}

export function verifySiteAgentRequest(
  input: VerifySiteAgentRequestInput
): SiteAgentAuthResult {
  const secret = getSiteAgentSecret()
  if (!secret) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is not configured",
    }
  }

  if (!input.siteCode || !input.timestamp || !input.nonce || !input.signature) {
    return {
      ok: false,
      code: "MISSING_HEADER",
      message:
        "x-site-code, x-agent-timestamp, x-agent-nonce and x-agent-signature are required",
    }
  }

  const timestamp = Number(input.timestamp)
  if (!Number.isFinite(timestamp)) {
    return {
      ok: false,
      code: "INVALID_TIMESTAMP",
      message: "x-agent-timestamp must be a Unix millisecond timestamp",
    }
  }
  if (Math.abs((input.now ?? Date.now()) - timestamp) > TIMESTAMP_WINDOW_MS) {
    return {
      ok: false,
      code: "EXPIRED_TIMESTAMP",
      message: "x-agent-timestamp is outside the allowed window",
    }
  }
  if (!input.payloadSiteCode || input.siteCode !== input.payloadSiteCode) {
    return {
      ok: false,
      code: "SITE_CODE_MISMATCH",
      message: "x-site-code must match payload.siteCode",
    }
  }

  const signingString = buildSiteAgentSigningString({
    siteCode: input.siteCode,
    timestamp: input.timestamp,
    nonce: input.nonce,
    method: input.method,
    path: input.path,
    rawBody: input.rawBody,
  })
  const expected = createHmac("sha256", secret)
    .update(signingString, "utf8")
    .digest("hex")
  const actualBuffer = Buffer.from(input.signature, "utf8")
  const expectedBuffer = Buffer.from(expected, "utf8")
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "invalid site agent signature",
    }
  }

  return { ok: true, code: "OK", message: "ok" }
}
