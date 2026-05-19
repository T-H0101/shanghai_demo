/**
 * Mock Enterprise Authentication Demo
 *
 * 演示用本地账号，非真实域账号、非 LDAP/ADFS 校验。
 * 禁止用于生产环境或声称已通过企业 IdP 认证。
 *
 * Site 权限模型：
 * - group_admin: 集团超级管理员，可访问所有站点
 * - site_admin: 站点管理员，仅可访问分配的站点
 * - auditor: 审计人员，仅可访问分配的站点
 * - operator: 操作员，仅可访问分配的站点
 */

import type { LoginSiteOption, MockUser, UserRole } from "@/lib/types/auth"

/** 登录页可选站点（下拉列表） */
export const loginSiteOptions: LoginSiteOption[] = [
  { id: "sh", label: "上海数据中心" },
  { id: "bj", label: "北京数据中心" },
  { id: "gz", label: "广州数据中心" },
  { id: "cd", label: "成都数据中心" },
  { id: "nj", label: "南京数据中心" },
  { id: "wh", label: "武汉数据中心" },
]

/**
 * Mock 用户列表
 *
 * 密码与用户名相同：admin/admin · ops/ops · audit/audit
 *
 * Site 权限说明：
 * - admin: 集团超级管理员，可登录所有 6 个站点
 * - ops: 运维管理员，仅可登录北京和广州数据中心
 * - audit: 审计人员，仅可登录南京和武汉数据中心
 */
export const mockUsers: MockUser[] = [
  {
    username: "admin",
    password: "admin",
    name: "张建国",
    role: "集团超级管理员",
    roleLevel: "group_admin",
    department: "信息技术部",
    defaultSite: "上海研发中心",
    allowedSites: [
      "上海研发中心",
      "北京总部机房",
      "广州生产基地",
      "成都研发基地",
      "南京中⼼",
      "武汉备份中心",
    ],
  },
  {
    username: "ops",
    password: "ops",
    name: "王芳",
    role: "运维管理员",
    roleLevel: "site_admin",
    department: "运维部",
    defaultSite: "北京总部机房",
    allowedSites: ["北京总部机房", "广州生产基地"],
  },
  {
    username: "audit",
    password: "audit",
    name: "刘审计",
    role: "审计管理员",
    roleLevel: "auditor",
    department: "内审部",
    defaultSite: "南京中⼼",
    allowedSites: ["南京中⼼", "武汉备份中心"],
  },
  {
    username: "operator",
    password: "operator",
    name: "陈操作",
    role: "站点操作员",
    roleLevel: "operator",
    department: "数据中心运保组",
    defaultSite: "成都研发基地",
    allowedSites: ["成都研发基地", "上海研发中心"],
  },
]

/**
 * 模拟域账号校验（仅比对 mockUsers，无网络请求）。
 * 不验证站点权限 — 站点权限由调用方在登录时验证。
 */
export function validateMockCredentials(
  username: string,
  password: string
): MockUser | null {
  const normalized = username.trim().toLowerCase().split("@")[0]
  return (
    mockUsers.find(
      (u) =>
        u.username.toLowerCase() === normalized && u.password === password
    ) ?? null
  )
}

/**
 * 验证用户是否有权访问指定站点。
 * 集团管理员（group_admin）可访问所有站点。
 */
export function validateSiteAccess(user: MockUser, siteLabel: string): boolean {
  if (user.roleLevel === "group_admin") {
    return true
  }
  return user.allowedSites.includes(siteLabel)
}
