export type AuthMode = "disabled" | "local" | "oidc" | "ldap"

export interface SafeAuthConfig {
  mode: AuthMode
  issuerUrlConfigured: boolean
  clientIdConfigured: boolean
  clientSecretKeyRef: string
  jwksUrlConfigured: boolean
  ldapUrlConfigured: boolean
  ldapBaseDnConfigured: boolean
}

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

export function getSafeAuthConfig(): SafeAuthConfig {
  const rawMode = process.env.AUTH_MODE?.trim().toLowerCase() ?? "disabled"
  const mode: AuthMode =
    rawMode === "local" || rawMode === "oidc" || rawMode === "ldap" ? rawMode : "disabled"
  const configuredRef =
    process.env.AUTH_CLIENT_SECRET_REF?.trim() || "AUTH_CLIENT_SECRET"
  const clientSecretKeyRef = /^[A-Z][A-Z0-9_]{0,127}$/.test(configuredRef)
    ? configuredRef
    : "AUTH_CLIENT_SECRET"

  return {
    mode,
    issuerUrlConfigured: configured("AUTH_ISSUER_URL"),
    clientIdConfigured: configured("AUTH_CLIENT_ID"),
    clientSecretKeyRef,
    jwksUrlConfigured: configured("AUTH_JWKS_URL"),
    ldapUrlConfigured: configured("AUTH_LDAP_URL"),
    ldapBaseDnConfigured: configured("AUTH_LDAP_BASE_DN"),
  }
}
