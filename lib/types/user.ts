import type { AccountStatus, SyncStatus } from "./common"

export type RoleType = "super_admin" | "site_admin" | "operator" | "auditor" | "viewer"

export interface PermissionNode {
  id: string
  label: string
  checked: boolean
  children?: PermissionNode[]
}

export interface UserPermission {
  sites: boolean[]
  siteLabels: string[]
  devices: PermissionNode[]
  volumes: PermissionNode[]
  tasks: PermissionNode[]
  logs: PermissionNode[]
  allSiteNotify: boolean
  hasConflict: boolean
  conflictMessage?: string
}

export interface User {
  id: string
  username: string
  displayName: string
  department: string
  role: RoleType
  roleLabel: string
  accessibleSites: string[]
  status: AccountStatus
  lastLoginAt: string
  permissionSyncStatus: SyncStatus
  email: string
  phone?: string
  permissions: UserPermission
}

export interface UserStats {
  total: number
  active: number
  locked: number
  syncPending: number
  roleDistribution: { role: string; count: number }[]
}
