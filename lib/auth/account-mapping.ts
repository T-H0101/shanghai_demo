/**
 * lib/auth/account-mapping.ts
 * Sprint R.65 — map OIDC/LDAP claims to auth_accounts fields.
 *
 * Disabled by default. Returns implemented_candidate when the
 * upstream provider is not configured.
 */

import { oidcStatus } from "./oidc-provider"
import { ldapStatus } from "./ldap-provider"

export interface MappedAccount {
  username: string
  displayName: string | null
  department: string | null
  role: string | null
  accessibleSites: string[]
  linkedUnifiedUserId: string | null
}

export interface MappingResult {
  status: "implemented_candidate" | "mapped" | "failed"
  blocker?: string
  missing?: string[]
  account?: MappedAccount
}

export function mapOidcClaimsToAccount(
  claims: Record<string, unknown>
): MappingResult {
  if (oidcStatus().status !== "active") {
    return {
      status: "implemented_candidate",
      blocker: "oidc_not_configured",
      missing: oidcStatus().missing,
    }
  }
  const account: MappedAccount = {
    username: String(claims.preferred_username ?? claims.sub ?? ""),
    displayName: typeof claims.name === "string" ? claims.name : null,
    department: typeof claims.department === "string" ? claims.department : null,
    role: Array.isArray(claims.groups)
      ? String(claims.groups[0] ?? "viewer")
      : typeof claims.role === "string"
        ? claims.role
        : "viewer",
    accessibleSites: Array.isArray(claims.accessible_sites)
      ? claims.accessible_sites.map(String)
      : [],
    linkedUnifiedUserId:
      typeof claims.linked_unified_user_id === "string"
        ? claims.linked_unified_user_id
        : null,
  }
  return { status: "mapped", account }
}

export function mapLdapEntryToAccount(
  entry: Record<string, unknown>
): MappingResult {
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
    department:
      typeof entry.department === "string" ? entry.department : null,
    role: "viewer",
    accessibleSites: [],
    linkedUnifiedUserId: null,
  }
  return { status: "mapped", account }
}
