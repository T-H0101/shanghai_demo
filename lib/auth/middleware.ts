/**
 * Auth middleware for API routes
 *
 * Sprint R.29 - REQ-6.2.4: 防越权
 *
 * 提供 3 个守卫函数:
 *   requireSession(req)           → 返回 AuthUser 或抛 401
 *   requirePermission(session, p) → 检查权限或抛 403
 *   requireSiteAccess(session, s) → 检查站点访问或抛 403
 *
 * 使用方式:
 *   const session = await requireSession(req)
 *   requirePermission(session, "platform:read")
 *   requireSiteAccess(session, siteCode)
 */

import { NextRequest, NextResponse } from "next/server"
import { sessionFromRequest, type AuthUser } from "./server"

export class AuthError extends NextResponse {
  constructor(status: number, code: string, message: string) {
    super(JSON.stringify({ error: code, message }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
}

/**
 * 从请求中提取 session, 未登录返回 401
 */
export async function requireSession(request: NextRequest): Promise<AuthUser> {
  const session = await sessionFromRequest(request)
  if (!session) {
    throw new AuthError(401, "AUTH_UNAUTHENTICATED", "请先登录")
  }
  return session
}

/**
 * 检查 session 是否拥有指定权限, 无权限返回 403
 */
export function requirePermission(session: AuthUser, permission: string): void {
  if (!session.permissions.includes(permission)) {
    throw new AuthError(403, "AUTH_FORBIDDEN", `缺少权限: ${permission}`)
  }
}

/**
 * 检查 session 是否有权访问指定站点
 * group_admin 可访问所有站点 (accessibleSites 包含 "*")
 * 其他角色只能访问 accessibleSites 中列出的站点
 */
export function requireSiteAccess(session: AuthUser, siteCode: string | null | undefined): void {
  // 如果没有指定 siteCode, 允许通过 (查询所有站点)
  if (!siteCode) return

  const sites = session.accessibleSites ?? []
  if (sites.includes("*") || sites.includes(siteCode)) {
    return
  }

  throw new AuthError(403, "AUTH_SITE_DENIED", `无权访问站点: ${siteCode}`)
}

/**
 * 获取 session 的可见站点列表 (用于 SQL WHERE 过滤)
 * group_admin 返回 null (不过滤)
 * 其他角色返回 accessibleSites 数组
 */
export function getVisibleSites(session: AuthUser): string[] | null {
  const sites = session.accessibleSites ?? []
  if (sites.includes("*")) return null // group_admin: 不过滤
  return sites
}

/**
 * 辅助函数: 安全执行守卫, 返回 NextResponse 或 null (通过)
 * 用法: const err = await guardSession(req); if (err) return err;
 */
export async function guardSession(request: NextRequest): Promise<NextResponse | null> {
  try {
    await requireSession(request)
    return null
  } catch (e) {
    if (e instanceof NextResponse) return e
    return new NextResponse(JSON.stringify({ error: "AUTH_ERROR" }), { status: 500 })
  }
}

/**
 * 包装器: 为 API route 添加 auth 守卫
 *
 * 用法:
 *   export async function GET(req: NextRequest) {
 *     const session = await requireSession(req)
 *     requirePermission(session, "platform:read")
 *     // ... 正常逻辑
 *   }
 *
 * 或用 withAuth 包装:
 *   export const GET = withAuth("platform:read")(async (req, session) => {
 *     // session 已验证, 正常逻辑
 *   })
 */
export function withAuth(...permissions: string[]) {
  return function handler(
    fn: (req: NextRequest, session: AuthUser) => Promise<NextResponse>,
  ) {
    return async function wrapped(req: NextRequest): Promise<NextResponse> {
      try {
        const session = await requireSession(req)
        for (const perm of permissions) {
          requirePermission(session, perm)
        }
        return await fn(req, session)
      } catch (e) {
        if (e instanceof NextResponse) return e
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        )
      }
    }
  }
}
