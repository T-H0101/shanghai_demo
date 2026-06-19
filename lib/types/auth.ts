export type UserRole = "group_admin" | "site_admin" | "auditor" | "operator" | "viewer"

export interface AuthSession {
  id: string
  username: string
  displayName: string | null
  role: UserRole
  department: string | null
  accessibleSites: string[]
  siteCode: string
  permissions: string[]
  provider: "local"
}

export interface MockUser {
  username: string
  password: string
  name: string
  role: string
  roleLevel: Exclude<UserRole, "viewer">
  department: string
  defaultSite: string
  allowedSites: string[]
}

export interface LoginSiteOption {
  id: string
  label: string
}
