/**
 * 总控 → 站点近期限免登 ticket（与 MultimediumNw modules/crypto-util.js 算法对齐）
 * AES-256-GCM + Base64URL；payload 含 username / siteCode / returnUrl / iat
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { publicAbsoluteUrl, type OriginRequest } from "@/lib/http/public-origin"

const DEFAULT_TTL_SECONDS = 120

function toBase64Url(str: string): string {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/")
  while (s.length % 4) s += "="
  return s
}

function secretKeyBuffer(): Buffer {
  const hex = (
    process.env.SITE_SSO_SECRET ??
    process.env.SITE_AUTH_TOKEN_SECRET ??
    ""
  ).trim()
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "SITE_SSO_SECRET must be 64 hex chars (32-byte key), matching MultimediumNw authToken/unifiedDiscSso.secretKey",
    )
  }
  return Buffer.from(hex, "hex")
}

export interface SiteSsoTicketPayload {
  username: string
  siteCode: string
  returnUrl: string
  redirect?: string
  iat: number
  jti?: string
}

export function encryptSiteSsoTicket(
  data: Omit<SiteSsoTicketPayload, "iat"> & { iat?: number },
): string {
  const key = secretKeyBuffer()
  const enhanced = JSON.stringify({
    username: data.username,
    siteCode: data.siteCode,
    returnUrl: data.returnUrl,
    redirect: data.redirect,
    jti: data.jti ?? randomBytes(8).toString("hex"),
    iat: data.iat ?? Date.now(),
  })
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(enhanced, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  const rawPayload = `${iv.toString("hex")}.${encrypted}.${authTag}`
  return toBase64Url(Buffer.from(rawPayload).toString("base64"))
}

export function decryptSiteSsoTicket(
  ticket: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): SiteSsoTicketPayload | null {
  try {
    const key = secretKeyBuffer()
    const rawStr = Buffer.from(fromBase64Url(ticket), "base64").toString("utf8")
    const [ivHex, encryptedHex, authTagHex] = rawStr.split(".")
    if (!ivHex || !encryptedHex || !authTagHex) return null
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivHex, "hex"),
    )
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
    let decrypted = decipher.update(encryptedHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    const data = JSON.parse(decrypted) as SiteSsoTicketPayload
    if (!data.username || !data.siteCode) return null
    if (Date.now() - Number(data.iat) > ttlSeconds * 1000) return null
    return data
  } catch {
    return null
  }
}

export function buildSiteJumpUrl(input: {
  host: string
  port: number
  ticket: string
  https?: boolean
}): string {
  const scheme = input.https ? "https" : "http"
  const path = (process.env.SITE_SSO_CONSUME_PATH ?? "/unified-sso/consume").trim()
  const consumePath = path.startsWith("/") ? path : `/${path}`
  return `${scheme}://${input.host}:${input.port}${consumePath}?ticket=${encodeURIComponent(input.ticket)}`
}

/** 退出回跳总控 /sites：与登录/OIDC 共用对外 Origin。 */
export function resolveCentralPortalSitesUrl(req?: OriginRequest): string {
  return publicAbsoluteUrl("/sites", req)
}

export function isSiteSsoSecretConfigured(): boolean {
  const hex = (
    process.env.SITE_SSO_SECRET ??
    process.env.SITE_AUTH_TOKEN_SECRET ??
    ""
  ).trim()
  return /^[0-9a-fA-F]{64}$/.test(hex)
}
