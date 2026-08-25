/**
 * lib/auth/account-mapping.ts
 * Sprint R.65/R.99 — OIDC/LDAP claims → auth_accounts，以及站点账号映射。
 *
 * AD 只负责认出人并写入同一张 auth_accounts。跳站点按当前账号查映射，
 * 不区分密码登录还是 AD 登录。未配置 IdP 时 mapOidcClaimsToAccount 仍返回 implemented_candidate。
 */

import { query } from "@/lib/db/postgres"
import { oidcStatus } from "./oidc-provider"
import { ldapStatus } from "./ldap-provider"

export interface MappedAccount {
  username: string
  displayName: string | null
  department: string | null
  role: string | null
  accessibleSites: string[]
  linkedUnifiedUserId: string | null
  employeeId: string | null
  email: string | null
}

export interface MappingResult {
  status: "implemented_candidate" | "mapped" | "failed"
  blocker?: string
  missing?: string[]
  account?: MappedAccount
}

function envList(name: string, fallback: string): string[] {
  const raw = process.env[name]?.trim() || fallback
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function claimString(claims: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const direct = claims[key]
    if (typeof direct === "string" && direct.trim()) return direct.trim()
    const httpKey = Object.keys(claims).find(
      (k) => k.toLowerCase().endsWith(`/${key.toLowerCase()}`) || k.toLowerCase() === key.toLowerCase(),
    )
    if (httpKey) {
      const v = claims[httpKey]
      if (typeof v === "string" && v.trim()) return v.trim()
      if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim()
    }
  }
  return null
}

/** 从 id_token claims 抽出药明默认身份（不依赖 oidcStatus，供联调/单测）。 */
export function extractAdIdentityFromClaims(claims: Record<string, unknown>): {
  employeeId: string | null
  email: string | null
  displayName: string | null
  loginName: string | null
} {
  const employeeId = claimString(
    claims,
    envList("OIDC_CLAIM_EMPLOYEE_ID", "employeeid,employee_id,EmployeeId,employeenumber"),
  )
  const email = claimString(claims, envList("OIDC_CLAIM_EMAIL", "email,upn,unique_name,mail"))
  const displayName = claimString(claims, envList("OIDC_CLAIM_DISPLAY_NAME", "name,displayname,display_name"))
  const loginName = claimString(
    claims,
    envList("OIDC_CLAIM_LOGIN_NAME", "preferred_username,winaccountname,samaccountname,upn"),
  )
  return { employeeId, email, displayName, loginName }
}

/** 总控用户名：AD 登录名优先，员工号/邮箱只作属性与对账。 */
export function centralUsernameFromAdClaims(claims: Record<string, unknown>): string {
  const id = extractAdIdentityFromClaims(claims)
  const source = id.loginName || id.employeeId || id.email || String(claims.sub ?? "")
  return source.trim().toLowerCase().split("@")[0]
}

export function mapOidcClaimsToAccount(claims: Record<string, unknown>): MappingResult {
  if (oidcStatus().status !== "active") {
    return {
      status: "implemented_candidate",
      blocker: "oidc_not_configured",
      missing: oidcStatus().missing,
    }
  }
  const id = extractAdIdentityFromClaims(claims)
  const username = centralUsernameFromAdClaims(claims)
  if (!username) {
    return { status: "failed", blocker: "missing_username_claim" }
  }
  const account: MappedAccount = {
    username,
    displayName: id.displayName,
    department: claimString(claims, envList("OIDC_CLAIM_DEPARTMENT", "department")),
    role: Array.isArray(claims.groups)
      ? String(claims.groups[0] ?? "viewer")
      : typeof claims.role === "string"
        ? claims.role
        : "viewer",
    accessibleSites: Array.isArray(claims.accessible_sites)
      ? claims.accessible_sites.map(String)
      : [],
    linkedUnifiedUserId:
      typeof claims.linked_unified_user_id === "string" ? claims.linked_unified_user_id : null,
    employeeId: id.employeeId,
    email: id.email,
  }
  return { status: "mapped", account }
}

export function mapLdapEntryToAccount(entry: Record<string, unknown>): MappingResult {
  if (ldapStatus().status !== "active") {
    return {
      status: "implemented_candidate",
      blocker: "ldap_not_configured",
      missing: ldapStatus().missing,
    }
  }
  const account: MappedAccount = {
    username: String(entry.uid ?? entry.sAMAccountName ?? ""),
    displayName:
      typeof entry.cn === "string"
        ? entry.cn
        : typeof entry.displayName === "string"
          ? entry.displayName
          : null,
    department: typeof entry.department === "string" ? entry.department : null,
    role: "viewer",
    accessibleSites: [],
    linkedUnifiedUserId: null,
    employeeId: typeof entry.employeeID === "string" ? entry.employeeID : null,
    email: typeof entry.mail === "string" ? entry.mail : null,
  }
  return { status: "mapped", account }
}

export interface SiteUserMappingRow {
  id: string
  employee_id: string | null
  email: string | null
  auth_account_id: string | null
  account_username?: string | null
  site_code: string
  site_local_username: string
  note: string | null
  created_at: string
  updated_at: string
}

export async function findAuthAccountForMapping(input: {
  username?: string | null
  authAccountId?: string | null
}): Promise<{
  id: string
  username: string
  employee_id: string | null
  email: string | null
} | null> {
  const accountId = input.authAccountId?.trim() ?? ""
  const username = input.username?.trim().toLowerCase() ?? ""
  if (username) {
    const byName = await query<{
      id: string
      username: string
      employee_id: string | null
      email: string | null
    }>(
      `SELECT id::text, username, employee_id, email
       FROM auth_accounts WHERE lower(username) = $1 LIMIT 1`,
      [username],
    )
    if (byName.rows[0]) return byName.rows[0]
    return null
  }
  if (accountId) {
    const byId = await query<{
      id: string
      username: string
      employee_id: string | null
      email: string | null
    }>(
      `SELECT id::text, username, employee_id, email
       FROM auth_accounts WHERE id = $1::uuid LIMIT 1`,
      [accountId],
    )
    if (byId.rows[0]) return byId.rows[0]
  }
  return null
}

export async function resolveSiteLocalUsername(input: {
  accountId: string
  employeeId?: string | null
  email?: string | null
  fallbackUsername: string
  siteCode: string
}): Promise<string> {
  const employeeId = input.employeeId?.trim() ?? ""
  const email = input.email?.trim() ?? ""
  const username = input.fallbackUsername.trim()
  const result = await query<{ site_local_username: string }>(
    `SELECT m.site_local_username
     FROM auth_site_user_mappings m
     LEFT JOIN auth_accounts a ON a.id = m.auth_account_id
     WHERE m.site_code = $1
       AND (
         m.auth_account_id = $2::uuid
         OR ($5 <> '' AND lower(a.username) = lower($5))
         OR ($3 <> '' AND m.employee_id = $3)
         OR ($5 <> '' AND m.employee_id = $5)
         OR ($4 <> '' AND lower(m.email) = lower($4))
       )
     ORDER BY
       CASE WHEN m.auth_account_id = $2::uuid THEN 0 ELSE 1 END,
       m.updated_at DESC
     LIMIT 1`,
    [input.siteCode, input.accountId, employeeId, email, username],
  )
  const mapped = result.rows[0]?.site_local_username?.trim()
  return mapped || input.fallbackUsername
}
