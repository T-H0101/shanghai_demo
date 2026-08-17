/**
 * 总控 → 站点近期限免登 ticket（与 MultimediumNw modules/crypto-util.js 算法对齐）
 * AES-256-GCM + Base64URL；payload 含 username / siteCode / returnUrl / iat
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

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

/** 监听地址 0.0.0.0 / :: 不能写入浏览器可打开的 returnUrl */
function isUnusableHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "")
  return h === "0.0.0.0" || h === "::" || h === ""
}

function sitesUrlFromBase(base: string): string | null {
  try {
    const u = new URL(base.includes("://") ? base : `http://${base}`)
    if (isUnusableHostname(u.hostname)) return null
    return `${u.protocol}//${u.host}/sites`
  } catch {
    return null
  }
}

/**
 * 退出回跳总控 /sites 的绝对地址。
 * 优先 PUBLIC_APP_URL；其次浏览器 Host / X-Forwarded-*（勿用 0.0.0.0 监听地址）。
 */
export function resolveCentralPortalSitesUrl(
  req?: { url?: string; headers?: Headers | { get(name: string): string | null } },
): string {
  const configured =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ""
  if (configured) {
    const fromEnv = sitesUrlFromBase(configured.replace(/\/+$/, ""))
    if (fromEnv) return fromEnv
  }

  const headers = req?.headers
  if (headers) {
    const xfProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const xfHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const host = xfHost || headers.get("host")?.trim()
    if (host && !isUnusableHostname(host.split(":")[0] ?? host)) {
      const proto =
        xfProto ||
        (req.url?.startsWith("https") ? "https" : "http")
      const fromHeader = sitesUrlFromBase(`${proto}://${host}`)
      if (fromHeader) return fromHeader
    }
  }

  if (req?.url) {
    try {
      const u = new URL(req.url)
      if (!isUnusableHostname(u.hostname)) {
        return `${u.origin}/sites`
      }
    } catch {
      /* fall through */
    }
  }

  return "http://127.0.0.1:3000/sites"
}

export function isSiteSsoSecretConfigured(): boolean {
  const hex = (
    process.env.SITE_SSO_SECRET ??
    process.env.SITE_AUTH_TOKEN_SECRET ??
    ""
  ).trim()
  return /^[0-9a-fA-F]{64}$/.test(hex)
}
