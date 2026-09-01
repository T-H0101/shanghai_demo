import type { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { query, transaction } from "@/lib/db/postgres"
import { createJwt, getSessionTtlSeconds, verifyJwt, type AuthJwtPayload } from "./jwt"
import { hashPassword, verifyPassword } from "./password"
import type { MappedAccount } from "./account-mapping"

export const AUTH_COOKIE = "odp_session"
export let LOCK_THRESHOLD = 5
export let LOCK_MINUTES = 30

export function resolveAuthCookieSecure(request?: NextRequest): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase()
  if (raw === "false" || raw === "0" || raw === "no") return false
  if (raw === "true" || raw === "1" || raw === "yes") return true

  if (request) {
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
    if (forwarded === "https") return true
    if (forwarded === "http") return false
    try {
      return new URL(request.url).protocol === "https:"
    } catch {
      return false
    }
  }

  return false
}

/** Sprint R.27: 从 auth_system_config 读取可配置锁定阈值 */
async function loadLockConfig(): Promise<void> {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM auth_system_config WHERE key IN ('login.lock_threshold', 'login.lock_minutes')`,
    )
    for (const row of rows.rows) {
      const v = Number.parseInt(row.value, 10)
      if (Number.isFinite(v) && v > 0) {
        if (row.key === "login.lock_threshold") LOCK_THRESHOLD = v
        if (row.key === "login.lock_minutes") LOCK_MINUTES = v
      }
    }
  } catch {
    // Table may not exist yet, use defaults
  }
}

export type AuthRole = "group_admin" | "site_admin" | "auditor" | "operator" | "viewer"
export type AuthProvider = "local" | "adfs" | "oidc"

export interface AuthUser {
  id: string
  username: string
  displayName: string | null
  role: string
  department: string | null
  accessibleSites: string[]
  siteCode: string
  permissions: string[]
  provider: AuthProvider
  employeeId?: string | null
  email?: string | null
}

interface AccountRow {
  id: string
  username: string
  display_name: string | null
  password_hash: string
  role: string
  department: string | null
  accessible_sites: string[] | null
  status: string
  locked_until: string | null
  employee_id?: string | null
  email?: string | null
  auth_provider?: string | null
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
  ('group_admin', 'dashboard:read'),
  ('group_admin', 'sites:list'),
  ('group_admin', 'sites:read'),
  ('group_admin', 'search:read'),
  ('group_admin', 'sync:read'),
  ('group_admin', 'sync:operate'),
  ('group_admin', 'tasks:read'),
  ('group_admin', 'control:submit'),
  ('group_admin', 'task:create'),
  ('group_admin', 'racks:read'),
  ('group_admin', 'volumes:read'),
  ('group_admin', 'cage_moves:read'),
  ('group_admin', 'racks:operate'),
  ('group_admin', 'early_warning:read'),
  ('group_admin', 'users:read'),
  ('group_admin', 'users:write'),
  ('group_admin', 'user:manage'),
  ('group_admin', 'audit:read'),
  ('group_admin', 'platform:operate'),
  ('site_admin', 'dashboard:read'),
  ('site_admin', 'sites:list'),
  ('site_admin', 'sites:read'),
  ('site_admin', 'search:read'),
  ('site_admin', 'sync:read'),
  ('site_admin', 'sync:operate'),
  ('site_admin', 'tasks:read'),
  ('site_admin', 'control:submit'),
  ('site_admin', 'task:create'),
  ('site_admin', 'racks:read'),
  ('site_admin', 'volumes:read'),
  ('site_admin', 'cage_moves:read'),
  ('site_admin', 'racks:operate'),
  ('site_admin', 'early_warning:read'),
  ('site_admin', 'users:read'),
  ('operator', 'dashboard:read'),
  ('operator', 'search:read'),
  ('operator', 'tasks:read'),
  ('operator', 'control:submit'),
  ('operator', 'task:create'),
  ('operator', 'racks:read'),
  ('operator', 'volumes:read'),
  ('operator', 'cage_moves:read'),
  ('operator', 'early_warning:read'),
  ('auditor', 'audit:read'),
  ('viewer', 'dashboard:read'),
  ('viewer', 'sites:list'),
  ('viewer', 'search:read'),
  ('viewer', 'sync:read'),
  ('viewer', 'tasks:read'),
  ('viewer', 'racks:read'),
  ('viewer', 'volumes:read'),
  ('viewer', 'cage_moves:read'),
  ('viewer', 'early_warning:read')
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
CREATE TABLE IF NOT EXISTS auth_system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO auth_system_config(key, value, description)
VALUES ('login.lock_threshold', '5', '连续失败登录锁定阈值')
ON CONFLICT (key) DO NOTHING;
INSERT INTO auth_system_config(key, value, description)
VALUES ('login.lock_minutes', '30', '锁定持续时间（分钟）')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(200);
ALTER TABLE auth_accounts ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(30) NOT NULL DEFAULT 'local';
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_employee_id_unique
  ON auth_accounts (employee_id)
  WHERE employee_id IS NOT NULL AND employee_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_accounts_email_unique
  ON auth_accounts (lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE TABLE IF NOT EXISTS auth_site_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id VARCHAR(100),
  email VARCHAR(200),
  auth_account_id UUID REFERENCES auth_accounts(id) ON DELETE SET NULL,
  site_code VARCHAR(50) NOT NULL,
  site_local_username VARCHAR(200) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_site_local
  ON auth_site_user_mappings (site_code, lower(site_local_username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_employee_site
  ON auth_site_user_mappings (employee_id, site_code)
  WHERE employee_id IS NOT NULL AND employee_id <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_email_site
  ON auth_site_user_mappings (lower(email), site_code)
  WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_site_map_account_site
  ON auth_site_user_mappings (auth_account_id, site_code)
  WHERE auth_account_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth_oidc_id_tokens (
  account_id UUID PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  id_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS auth_roles (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO auth_roles(code, name, description, builtin) VALUES
  ('group_admin', '集团管理员', '管理全部站点与平台配置，拥有最高操作权限。', TRUE),
  ('site_admin', '站点管理员', '管理授权站点内的同步、任务控制与盘笼移位等。', TRUE),
  ('operator', '操作员', '在授权站点内提交任务控制与创建相关操作。', TRUE),
  ('auditor', '审计员', '仅查看审计日志，不参与业务读写。', TRUE),
  ('viewer', '只读用户', '只读查看业务数据，不可写操作。', TRUE)
ON CONFLICT (code) DO NOTHING;
-- 自定义角色：去掉仅允许 5 个内置角色的 CHECK
ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_role_check;
`

let schemaReady: Promise<void> | null = null

/**
 * 一次性将内置角色权限矩阵同步到细粒度菜单权限（中期 RBAC）。
 * 仅在 flag 未写入时执行，之后管理员在 UI 上的修改不会被覆盖。
 */
async function migrateBuiltinRolePermissionsV1(): Promise<void> {
  const {
    BUILTIN_ROLE_PERMISSIONS,
    RBAC_MIGRATION_FLAG,
  } = await import("./permissions-catalog")

  const flag = await query<{ value: string }>(
    `SELECT value FROM auth_system_config WHERE key = $1 LIMIT 1`,
    [RBAC_MIGRATION_FLAG],
  )
  if (flag.rows[0]?.value === "1") return

  await transaction(async (client) => {
    for (const [role, perms] of Object.entries(BUILTIN_ROLE_PERMISSIONS)) {
      await client.query(`DELETE FROM auth_role_permissions WHERE role = $1`, [role])
      for (const permission of perms) {
        await client.query(
          `INSERT INTO auth_role_permissions(role, permission) VALUES ($1, $2)
           ON CONFLICT (role, permission) DO NOTHING`,
          [role, permission],
        )
      }
    }
    await client.query(
      `INSERT INTO auth_system_config(key, value, description)
       VALUES ($1, '1', '内置角色已迁移到菜单级细粒度权限；此后不再自动覆写')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [RBAC_MIGRATION_FLAG],
    )
  })
}

/**
 * 一次性清除残留 platform:read。
 * 该码不在角色编辑勾选列表中，但 hasPermission 会展开为全部业务 *:read，
 * 导致「下方勾选不全、上方可访问菜单全亮」；保存时又会被 normalize 丢掉。
 */
async function stripLegacyPlatformReadV1(): Promise<void> {
  const { RBAC_STRIP_PLATFORM_READ_FLAG } = await import("./permissions-catalog")

  const flag = await query<{ value: string }>(
    `SELECT value FROM auth_system_config WHERE key = $1 LIMIT 1`,
    [RBAC_STRIP_PLATFORM_READ_FLAG],
  )
  if (flag.rows[0]?.value === "1") return

  await transaction(async (client) => {
    await client.query(
      `DELETE FROM auth_role_permissions WHERE permission = 'platform:read'`,
    )
    await client.query(
      `INSERT INTO auth_system_config(key, value, description)
       VALUES ($1, '1', '已清除角色权限中的残留 platform:read')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [RBAC_STRIP_PLATFORM_READ_FLAG],
    )
  })
}

export function ensureAuthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(SCHEMA_SQL)
      .then(() => migrateBuiltinRolePermissionsV1())
      .then(() => stripLegacyPlatformReadV1())
      .then(() => undefined)
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
  provider?: AuthProvider
}) {
  await query(
    `INSERT INTO auth_login_audit (
       username, account_id, site_code, ip_address, user_agent, result, failure_reason, provider
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      normalizeUsername(input.username),
      input.accountId ?? null,
      input.siteCode ?? null,
      getIp(input.request),
      input.request.headers.get("user-agent"),
      input.result,
      input.failureReason ?? null,
      input.provider ?? "local",
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

async function permissionsFor(role: string): Promise<string[]> {
  const result = await query<{ permission: string }>(
    `SELECT permission FROM auth_role_permissions WHERE role = $1 ORDER BY permission`,
    [role],
  )
  return result.rows.map((row) => row.permission)
}

/** 角色码是否存在于 auth_roles（启用） */
export async function roleExists(roleCode: string): Promise<boolean> {
  await ensureAuthSchema()
  const result = await query<{ code: string }>(
    `SELECT code FROM auth_roles WHERE code = $1 AND status = 'active' LIMIT 1`,
    [roleCode],
  )
  return Boolean(result.rows[0])
}

async function accountFor(username: string): Promise<AccountRow | null> {
  const result = await query<AccountRow>(
    `SELECT id::text, username, display_name, password_hash, role, department,
            accessible_sites, status, locked_until::text, employee_id, email, auth_provider
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

export type AvailableSiteOption = { code: string; label: string }

/**
 * 登录页：按账号权限返回可选站点（不校验密码）。
 * - accessible_sites 含 * → 中心已启用 sync_sites 全量
 * - 否则 → 账号权限站点列表（名称优先取 sync_sites）
 * - 账号不存在 → 空列表（不区分“无账号/无权限”，减少枚举）
 */
export async function listAvailableSitesForUsername(
  rawUsername: string,
): Promise<AvailableSiteOption[]> {
  await ensureAuthSchema()
  const username = normalizeUsername(rawUsername)
  if (!username) return []

  const account = await accountFor(username)
  if (!account || account.status === "disabled") return []

  const registered = await query<{ site_code: string; site_name: string | null }>(
    `SELECT site_code, site_name
     FROM sync_sites
     WHERE enabled = TRUE
     ORDER BY site_code`,
  )
  const registeredMap = new Map(
    registered.rows.map((r) => [r.site_code, (r.site_name?.trim() || r.site_code)]),
  )

  const accessible = account.accessible_sites ?? []
  if (accessible.includes("*")) {
    return registered.rows.map((r) => ({
      code: r.site_code,
      label: r.site_name?.trim() || r.site_code,
    }))
  }

  const codes = accessible.map(String).filter((c) => c && c !== "*")
  return codes.map((code) => ({
    code,
    label: registeredMap.get(code) ?? code,
  }))
}

export async function loginWithPassword(input: {
  username: string
  password: string
  siteCode?: string
  request: NextRequest
}): Promise<{ ok: true; user: AuthUser; token: string } | { ok: false; status: number; code: string; message: string }> {
  await ensureAuthSchema()
  await loadLockConfig()
  const username = normalizeUsername(input.username)
  const siteCode = (input.siteCode ?? "").trim()

  if (!username || !input.password) {
    return { ok: false, status: 400, code: "AUTH_BAD_REQUEST", message: "username and password are required" }
  }

  if ((await recentFailureCount(username)) >= LOCK_THRESHOLD) {
    await recordLoginAudit({ username, siteCode, request: input.request, result: "locked", failureReason: "recent failure threshold reached" })
    return { ok: false, status: 423, code: "AUTH_LOCKED", message: "account is temporarily locked" }
  }

  const account = await accountFor(username)
  if (!account) {
    await recordLoginAudit({ username, siteCode, request: input.request, result: "failed", failureReason: "account not found" })
    return { ok: false, status: 401, code: "AUTH_INVALID_CREDENTIALS", message: "invalid username or password" }
  }

  if (account.status !== "active" || accountLocked(account)) {
    await recordLoginAudit({ username, accountId: account.id, siteCode, request: input.request, result: "locked", failureReason: "account disabled or locked" })
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
    await recordLoginAudit({ username, accountId: account.id, siteCode, request: input.request, result: "failed", failureReason: "password mismatch" })
    return { ok: false, status: 401, code: "AUTH_INVALID_CREDENTIALS", message: "invalid username or password" }
  }

  // 站点仅作登录后默认视图偏好，不作为登录准入条件（无站点 / 无站点权限均可登录）

  await query(
    `UPDATE auth_accounts
     SET failed_attempts = 0, locked_until = NULL, status = 'active', last_login_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [account.id],
  )
  await recordLoginAudit({ username, accountId: account.id, siteCode, request: input.request, result: "success" })

  const permissions = await permissionsFor(account.role)
  const user: AuthUser = {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role,
    department: account.department,
    accessibleSites: account.accessible_sites ?? [],
    siteCode,
    permissions,
    provider: "local",
    employeeId: account.employee_id ?? null,
    email: account.email ?? null,
  }
  const token = createJwt({ sub: account.id, username: account.username, role: account.role, siteCode })
  return { ok: true, user, token }
}

function toAuthProvider(value: string | null | undefined): AuthProvider {
  if (value === "adfs" || value === "oidc") return value
  return "local"
}

function toAuthUser(account: AccountRow, siteCode: string, permissions: string[]): AuthUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role,
    department: account.department,
    accessibleSites: account.accessible_sites ?? [],
    siteCode,
    permissions,
    provider: toAuthProvider(account.auth_provider),
    employeeId: account.employee_id ?? null,
    email: account.email ?? null,
  }
}

export async function sessionFromPayload(payload: AuthJwtPayload): Promise<AuthUser | null> {
  await ensureAuthSchema()
  const result = await query<AccountRow>(
    `SELECT id::text, username, display_name, password_hash, role, department,
            accessible_sites, status, locked_until::text, employee_id, email, auth_provider
     FROM auth_accounts
     WHERE id = $1
     LIMIT 1`,
    [payload.sub],
  )
  const account = result.rows[0]
  if (!account || account.status !== "active" || accountLocked(account)) return null
  const permissions = await permissionsFor(account.role)
  return toAuthUser(account, payload.siteCode, permissions)
}

export async function sessionFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  const payload = verifyJwt(token)
  if (!payload) return null
  return sessionFromPayload(payload)
}

export async function recordLogout(
  request: NextRequest,
  username = "unknown",
  provider: AuthProvider = "local",
) {
  await ensureAuthSchema()
  await recordLoginAudit({ username, request, result: "logout", provider })
}

async function findAccountForAdIdentity(mapped: MappedAccount): Promise<AccountRow | null> {
  if (mapped.employeeId) {
    const byEmp = await query<AccountRow>(
      `SELECT id::text, username, display_name, password_hash, role, department,
              accessible_sites, status, locked_until::text, employee_id, email, auth_provider
       FROM auth_accounts WHERE employee_id = $1 LIMIT 1`,
      [mapped.employeeId],
    )
    if (byEmp.rows[0]) return byEmp.rows[0]
  }
  if (mapped.email) {
    const byEmail = await query<AccountRow>(
      `SELECT id::text, username, display_name, password_hash, role, department,
              accessible_sites, status, locked_until::text, employee_id, email, auth_provider
       FROM auth_accounts WHERE lower(email) = lower($1) LIMIT 1`,
      [mapped.email],
    )
    if (byEmail.rows[0]) return byEmail.rows[0]
  }
  return accountFor(mapped.username)
}

export async function completeAdfsLogin(input: {
  mapped: MappedAccount
  request: NextRequest
  idToken: string
  siteCode?: string
}): Promise<
  | { ok: true; user: AuthUser; token: string }
  | { ok: false; status: number; code: string; message: string }
> {
  await ensureAuthSchema()
  const siteCode = (input.siteCode ?? "").trim()
  const mapped = input.mapped

  let account = await findAccountForAdIdentity(mapped)
  if (account && (account.status !== "active" || accountLocked(account))) {
    await recordLoginAudit({
      username: account.username,
      accountId: account.id,
      siteCode,
      request: input.request,
      result: "locked",
      failureReason: "account disabled or locked",
      provider: "adfs",
    })
    return { ok: false, status: 423, code: "AUTH_LOCKED", message: "account is temporarily locked" }
  }

  if (!account) {
    const unusableHash = await hashPassword(randomBytes(32).toString("hex"))
    const inserted = await query<AccountRow>(
      `INSERT INTO auth_accounts (
         username, display_name, password_hash, role, department, accessible_sites, status,
         employee_id, email, auth_provider
       ) VALUES ($1, $2, $3, 'viewer', $4, ARRAY[]::TEXT[], 'active', $5, $6, 'adfs')
       RETURNING id::text, username, display_name, password_hash, role, department,
                 accessible_sites, status, locked_until::text, employee_id, email, auth_provider`,
      [
        mapped.username,
        mapped.displayName,
        unusableHash,
        mapped.department,
        mapped.employeeId,
        mapped.email,
      ],
    )
    account = inserted.rows[0]
  } else {
    await query(
      `UPDATE auth_accounts
       SET display_name = COALESCE($2, display_name),
           department = COALESCE($3, department),
           employee_id = COALESCE($4, employee_id),
           email = COALESCE($5, email),
           auth_provider = CASE WHEN auth_provider = 'local' THEN auth_provider ELSE 'adfs' END,
           failed_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [account.id, mapped.displayName, mapped.department, mapped.employeeId, mapped.email],
    )
    const refreshed = await query<AccountRow>(
      `SELECT id::text, username, display_name, password_hash, role, department,
              accessible_sites, status, locked_until::text, employee_id, email, auth_provider
       FROM auth_accounts WHERE id = $1 LIMIT 1`,
      [account.id],
    )
    account = refreshed.rows[0] ?? account
  }

  if (!account) {
    await recordLoginAudit({
      username: mapped.username,
      siteCode,
      request: input.request,
      result: "failed",
      failureReason: "jit_account_failed",
      provider: "adfs",
    })
    return { ok: false, status: 500, code: "AUTH_JIT_FAILED", message: "failed to provision account" }
  }

  await query(
    `UPDATE auth_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [account.id],
  )
  await query(
    `INSERT INTO auth_oidc_id_tokens (account_id, id_token, expires_at, updated_at)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, NOW())
     ON CONFLICT (account_id) DO UPDATE SET
       id_token = EXCLUDED.id_token,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [account.id, input.idToken, String(getSessionTtlSeconds())],
  )
  await recordLoginAudit({
    username: account.username,
    accountId: account.id,
    siteCode,
    request: input.request,
    result: "success",
    provider: "adfs",
  })

  const permissions = await permissionsFor(account.role)
  const user = toAuthUser(account, siteCode, permissions)
  const token = createJwt({ sub: account.id, username: account.username, role: account.role, siteCode })
  return { ok: true, user, token }
}

export async function takeOidcIdToken(accountId: string): Promise<string | null> {
  await ensureAuthSchema()
  const result = await query<{ id_token: string }>(
    `DELETE FROM auth_oidc_id_tokens
     WHERE account_id = $1::uuid AND expires_at > NOW()
     RETURNING id_token`,
    [accountId],
  )
  return result.rows[0]?.id_token ?? null
}

export async function recordAdfsLoginFailure(input: {
  request: NextRequest
  username?: string
  reason: string
}) {
  await ensureAuthSchema()
  await recordLoginAudit({
    username: input.username || "unknown",
    request: input.request,
    result: "failed",
    failureReason: input.reason,
    provider: "adfs",
  })
}

export function setSessionCookie(response: NextResponse, token: string, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveAuthCookieSecure(request),
    path: "/",
    maxAge: getSessionTtlSeconds(),
  })
}

export function clearSessionCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveAuthCookieSecure(request),
    path: "/",
    maxAge: 0,
  })
}
