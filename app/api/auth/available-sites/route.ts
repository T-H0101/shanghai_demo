/**
 * GET /api/auth/available-sites?username=xxx
 *
 * 登录前按账号返回可选站点列表（权限站点 ∩/含全站权限时取已启用 sync_sites）。
 * 公开只读：不返回是否存在账号以外的敏感信息；无匹配时 sites=[]。
 */

import { NextRequest, NextResponse } from "next/server"
import { listAvailableSitesForUsername } from "@/lib/auth/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? ""
  if (!username) {
    return NextResponse.json({
      code: 0,
      message: "ok",
      data: { sites: [] as Array<{ code: string; label: string }> },
    })
  }

  try {
    const sites = await listAvailableSitesForUsername(username)
    return NextResponse.json({
      code: 0,
      message: "ok",
      data: { sites },
    })
  } catch (error) {
    console.error("[API Error] /api/auth/available-sites:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        data: { sites: [] },
      },
      { status: 500 },
    )
  }
}
