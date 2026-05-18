/**
 * Mock Enterprise Authentication Demo — 类型定义。
 * 非真实 JWT / OAuth / LDAP / ADFS 凭证结构。
 *
 * 用于模拟企业级 Site 维度权限模型：
 * - 集团管理员可访问所有站点
 * - 站点管理员仅可访问被分配的站点
 * - 审计人员仅可访问被分配的站点
 */

export type UserRole = "group_admin" | "site_admin" | "auditor" | "operator"

export interface MockUser {
  username: string
  password: string
  name: string
  role: string
  roleLevel: UserRole
  department: string
  defaultSite: string
  /** 允许登录的站点列表。集团管理员可访问所有站点。 */
  allowedSites: string[]
}

export interface MockSession {
  token: string
  user: string
  role: string
  roleLevel: UserRole
  site: string
  displayName: string
  department: string
  loginTime: string
}

export interface LoginSiteOption {
  id: string
  label: string
}
