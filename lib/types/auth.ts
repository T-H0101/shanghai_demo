export type UserRole = string

export interface AuthSession {
  id: string
  username: string
  displayName: string | null
  role: UserRole
  department: string | null
  accessibleSites: string[]
  siteCode: string
  permissions: string[]
  provider: "local" | "adfs" | "oidc"
  employeeId?: string | null
  email?: string | null
}

export interface MockUser {
  username: string
  password: string
  name: string
  role: string
  roleLevel: string
  department: string
  defaultSite: string
  allowedSites: string[]
}

export interface LoginSiteOption {
  id: string
  label: string
}
