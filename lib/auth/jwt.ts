import { createHmac, timingSafeEqual } from "node:crypto"

const ALG = "HS256"
const TYP = "JWT"

export interface AuthJwtPayload {
  sub: string
  username: string
  role: string
  siteCode: string
  iat: number
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url")
}

export function getAuthSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SYNC_PACKAGE_SECRET ||
    "local-development-auth-secret-change-me"
  )
}

export function getSessionTtlSeconds(): number {
  const value = Number.parseInt(process.env.AUTH_SESSION_TTL_SECONDS || "7200", 10)
  return Number.isFinite(value) && value > 0 ? value : 7200
}

export function createJwt(payload: Omit<AuthJwtPayload, "iat" | "exp">, ttlSeconds = getSessionTtlSeconds()): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: ALG, typ: TYP }))
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }))
  const unsigned = `${header}.${body}`
  return `${unsigned}.${sign(unsigned, getAuthSecret())}`
}

export function verifyJwt(token: string): AuthJwtPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [headerPart, bodyPart, signaturePart] = parts
  const expected = sign(`${headerPart}.${bodyPart}`, getAuthSecret())
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signaturePart)
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null
  }

  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as { alg?: string; typ?: string }
  if (header.alg !== ALG || header.typ !== TYP) return null

  const payload = JSON.parse(Buffer.from(bodyPart, "base64url").toString("utf8")) as AuthJwtPayload
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}
