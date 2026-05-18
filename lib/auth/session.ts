/**
 * Mock Enterprise Authentication Demo — 浏览器会话（localStorage）。
 *
 * 非真实 JWT 签发/校验，不包含 OAuth / LDAP / ADFS / SSO Federation。
 */

import type { MockSession, MockUser } from "@/lib/types/auth"

export const MOCK_STORAGE_KEYS = {
  token: "mock_token",
  user: "mock_user",
  role: "mock_role",
  roleLevel: "mock_role_level",
  site: "mock_site",
  displayName: "mock_display_name",
  department: "mock_department",
  loginTime: "mock_login_time",
} as const

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(localStorage.getItem(MOCK_STORAGE_KEYS.token))
}

export function getSession(): MockSession | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(MOCK_STORAGE_KEYS.token)
  if (!token) return null
  return {
    token,
    user: localStorage.getItem(MOCK_STORAGE_KEYS.user) ?? "",
    role: localStorage.getItem(MOCK_STORAGE_KEYS.role) ?? "",
    roleLevel: (localStorage.getItem(MOCK_STORAGE_KEYS.roleLevel) as MockSession["roleLevel"]) ?? "site_admin",
    site: localStorage.getItem(MOCK_STORAGE_KEYS.site) ?? "",
    displayName: localStorage.getItem(MOCK_STORAGE_KEYS.displayName) ?? "",
    department: localStorage.getItem(MOCK_STORAGE_KEYS.department) ?? "",
    loginTime: localStorage.getItem(MOCK_STORAGE_KEYS.loginTime) ?? "",
  }
}

/** 写入演示会话并返回 token（非真实 JWT）。 */
export function saveMockSession(user: MockUser, siteLabel: string): string {
  const token = `mock_demo_${user.username}_${Date.now()}`
  localStorage.setItem(MOCK_STORAGE_KEYS.token, token)
  localStorage.setItem(MOCK_STORAGE_KEYS.user, user.username)
  localStorage.setItem(MOCK_STORAGE_KEYS.role, user.role)
  localStorage.setItem(MOCK_STORAGE_KEYS.roleLevel, user.roleLevel)
  localStorage.setItem(MOCK_STORAGE_KEYS.site, siteLabel)
  localStorage.setItem(MOCK_STORAGE_KEYS.displayName, user.name)
  localStorage.setItem(MOCK_STORAGE_KEYS.department, user.department)
  localStorage.setItem(MOCK_STORAGE_KEYS.loginTime, new Date().toISOString())
  return token
}

export function clearMockSession(): void {
  Object.values(MOCK_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key)
  })
}
