import type { NextRequest, NextResponse } from "next/server"
import { query, transaction } from "@/lib/db/postgres"
import { createJwt, getSessionTtlSeconds, verifyJwt, type AuthJwtPayload } from "./jwt"
import { verifyPassword } from "./password"

export const AUTH_COOKIE = "odp_session"
export const LOCK_THRESHOLD = 5
export const LOCK_MINUTES = 30

export type AuthRole = "group_admin" | "site_admin" | "auditor" | "operator" | "viewer"

export interface AuthUser {
  id: string
  username: string
  displayName: string | null
  role: AuthRole
  department: string | null
  accessibleSites: string[]
  siteCode: string
  permissions: string[]
  provider: "local"
}

interface AccountRow {
  id: string
  username: string
  display_name: string | null
  password_hash: string
  role: AuthRole
  department: string | null
  accessible_sites: string[] | null
  status: string
  locked_until: string | null
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS auth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200),
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  department VARCHAR(100),
  accessible_sites TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  linked_unified_user_id UUID REFERENCES unified_users(id) ON DELETE SET NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS auth_login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL,
  account_id UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
  site_code VARCHAR(50),
  ip_address VARCHAR(100),
  user_agent TEXT,
  result VARCHAR(30) NOT NULL,
  failure_reason TEXT,
  provider VARCHAR(30) NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS auth_role_permissions (
  role VARCHAR(50) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission)
);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_username_created
  ON auth_login_audit(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_audit_result_created
  ON auth_login_audit(result, created_at DESC);
INSERT INTO auth_role_permissions(role, permission) VALUES
  ('group_admin', 'platform:read'),
  ('group_admin', 'platform:operate'),
  ('group_admin', 'users:read'),
  ('group_admin', 'users:write'),
  ('group_admin', 'sync:operate'),
  ('group_admin', 'control:submit'),
  ('group_admin', 'audit:read'),
  ('site_admin', 'platform:read'),
  ('site_admin', 'users:read'),
  ('site_admin', 'sync:operate'),
  ('site_admin', 'control:submit'),
  ('operator', 'platform:read'),
  ('operator', 'control:submit'),
  ('auditor', 'platform:read'),
  ('auditor', 'audit:read'),
  ('viewer', 'platform:read')
ON CONFLICT (role, permission) DO NOTHING;
INSERT INTO auth_accounts (
  username, display_name, password_hash, role, department, accessible_sites, status
) VALUES (
  'admin',
  '平台管理员',
  'scrypt$N=16384,r=8,p=1$MqzxIjkj5OZolvaiDTzfzw$v0W4xKxwsJhblVcHUVwfEPyUAxU-Vzr2DqZ2cSV5O43QEB8-Zy8jqnzttIs3jaFd4hxeHFpMBuE5F_LE0n9Phg',
  'group_admin',
  '信息技术部',
  ARRAY['*']::TEXT[],
  'active'
) ON CONFLICT (username) DO NOTHING;
`

let schemaReady: Promise<void> | null = null

export function ensureAuthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(SCHEMA_SQL).then(() => undefined)
  }
  return schemaReady
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().split("@")[0]
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

async function recordLoginAudit(input: {
  username: string
  accountId?: string | null
  siteCode?: string | null
  request: NextRequest
  result: "success" | "failed" | "locked" | "logout"
  failureReason?: string | null
}) {
  await query(
    `INSERT INTO auth_login_audit (
       username, account_id, site_code, ip_address, user_agent, result, failure_reason, provider
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'local')`,
    [
      normalizeUsername(input.username),
      input.accountId ?? null,
      input.siteCode ?? null,
      getIp(input.request),
      input.request.headers.get("user-agent"),
      input.result,
      input.failureReason ?? null,
    ],
  )
}

async function recentFailureCount(username: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM auth_login_audit
     WHERE username = $1
       AND result IN ('failed', 'locked')
       AND created_at > NOW() - INTERVAL '${LOCK_MINUTES} minutes'`,
    [normalizeUsername(username)],
  )
  return Number.parseInt(result.rows[0]?.count ?? "0", 10)
}

async function permissionsFor(role: AuthRole): Promise<string[]> {
  const result = await query<{ permission: string }>(
    `SELECT permission FROM auth_role_permissions WHERE role = $1 ORDER BY permission`,
    [role],
  )
  return result.rows.map((row) => row.permission)
}

async function accountFor(username: string): Promise<AccountRow | null> {
  const result = await query<AccountRow>(
    `SELECT id::text, username, display_name, password_hash, role, department,
            accessible_sites, status, locked_until::text
     FROM auth_accounts
     WHERE username = $1
     LIMIT 1`,
    [normalizeUsername(username)],
  )
  return result.rows[0] ?? null
}

function accountLocked(account: AccountRow): boolean {
  return Boolean(account.locked_until && new Date(account.locked_until).getTime() > Date.now())
}

function siteAllowed(account: AccountRow, siteCode: string): boolean {
  const sites = account.accessible_sites ?? []
  return sites.includes("*") || sites.includes(siteCode)
}

export async function loginWithPassword(input: {
  username: string
  password: string
  siteCode: string
  request: NextRequest
}): Promise<{ ok: true; user: AuthUser; token: string } | { ok: false; status: number; code: string; message: string }> {
  await ensureAuthSchema()
  const username = normalizeUsername(input.username)

  if (!username || !input.password || !input.siteCode) {
    return { ok: false, status: 400, code: "AUTH_BAD_REQUEST", message: "username, password and siteCode are required" }
  }

  if ((await recentFailureCount(username)) >= LOCK_THRESHOLD) {
    await recordLoginAudit({ username, siteCode: input.siteCode, request: input.request, result: "locked", failureReason: "recent failure threshold reached" })
    return { ok: false, status: 423, code: "AUTH_LOCKED", message: "account is temporarily locked" }
  }

  const account = await accountFor(username)
  if (!account) {
    await recordLoginAudit({ username, siteCode: input.siteCode, request: input.request, result: "failed", failureReason: "account not found" })
    return { ok: false, status: 401, code: "AUTH_INVALID_CREDENTIALS", message: "invalid username or password" }
  }

  if (account.status !== "active" || accountLocked(account)) {
    await recordLoginAudit({ username, accountId: account.id, siteCode: input.siteCode, request: input.request, result: "locked", failureReason: "account disabled or locked" })
    return { ok: false, status: 423, code: "AUTH_LOCKED", message: "account is temporarily locked" }
  }

  const passwordOk = await verifyPassword(input.password, account.password_hash)
  if (!passwordOk) {
    await transaction(async (client) => {
      await client.query(
        `UPDATE auth_accounts
         SET failed_attempts = failed_attempts + 1,
             locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval ELSE locked_until END,
             status = CASE WHEN failed_attempts + 1 >= $2 THEN 'locked' ELSE status END,
             updated_at = NOW()
         WHERE id = $1`,
        [account.id, LOCK_THRESHOLD, LOCK_MINUTES],
      )
    })
    await recordLoginAudit({ username, accountId: account.id, siteCode: input.siteCode, request: input.request, result: "failed", failureReason: "password mismatch" })
    return { ok: false, status: 401, code: "AUTH_INVALID_CREDENTIALS", message: "invalid username or password" }
  }

  if (!siteAllowed(account, input.siteCode)) {
    await recordLoginAudit({ username, accountId: account.id, siteCode: input.siteCode, request: input.request, result: "failed", failureReason: "site denied" })
    return { ok: false, status: 403, code: "AUTH_SITE_DENIED", message: "site access denied" }
  }

  await query(
    `UPDATE auth_accounts
     SET failed_attempts = 0, locked_until = NULL, status = 'active', last_login_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [account.id],
  )
  await recordLoginAudit({ username, accountId: account.id, siteCode: input.siteCode, request: input.request, result: "success" })

  const permissions = await permissionsFor(account.role)
  const user: AuthUser = {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role,
    department: account.department,
    accessibleSites: account.accessible_sites ?? [],
    siteCode: input.siteCode,
    permissions,
    provider: "local",
  }
  const token = createJwt({ sub: account.id, username: account.username, role: account.role, siteCode: input.siteCode })
  return { ok: true, user, token }
}

export async function sessionFromPayload(payload: AuthJwtPayload): Promise<AuthUser | null> {
  await ensureAuthSchema()
  const result = await query<AccountRow>(
    `SELECT id::text, username, display_name, password_hash, role, department,
            accessible_sites, status, locked_until::text
     FROM auth_accounts
     WHERE id = $1
     LIMIT 1`,
    [payload.sub],
  )
  const account = result.rows[0]
  if (!account || account.status !== "active" || accountLocked(account)) return null
  const permissions = await permissionsFor(account.role)
  return {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role,
    department: account.department,
    accessibleSites: account.accessible_sites ?? [],
    siteCode: payload.siteCode,
    permissions,
    provider: "local",
  }
}

export async function sessionFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  const payload = verifyJwt(token)
  if (!payload) return null
  return sessionFromPayload(payload)
}

export async function recordLogout(request: NextRequest, username = "unknown") {
  await ensureAuthSchema()
  await recordLoginAudit({ username, request, result: "logout" })
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
