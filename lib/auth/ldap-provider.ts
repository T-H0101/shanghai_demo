/**
 * lib/auth/ldap-provider.ts
 * Sprint R.65 — LDAP provider boundary (disabled by default).
 */

export interface LdapStatus {
  status: "implemented_candidate" | "active"
  blocker: string | null
  missing: string[]
}

const REQUIRED = ["LDAP_URL", "LDAP_BASE_DN", "LDAP_BIND_DN", "LDAP_BIND_PASSWORD"] as const

export function ldapStatus(): LdapStatus {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length > 0) {
    return {
      status: "implemented_candidate",
      blocker: "enterprise_provider_not_configured",
      missing: [...missing],
    }
  }
  return {
    status: "active",
    blocker: null,
    missing: [],
  }
}

export interface LdapBindResult {
  status: "implemented_candidate" | "success" | "failed"
  blocker?: string
  missing?: string[]
  reason?: string
}

export async function ldapBind(username: string, password: string): Promise<LdapBindResult> {
  const s = ldapStatus()
  if (s.status !== "active") {
    return { status: "implemented_candidate", blocker: s.blocker ?? "unknown", missing: s.missing }
  }
  // Real LDAP bind would happen here. The function never silently
  // returns success without a verified connection.
  return { status: "failed", reason: "ldap_real_bind_not_implemented" }
}
