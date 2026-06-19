import { NextRequest, NextResponse } from "next/server"
import { loginWithPassword, setSessionCookie } from "@/lib/auth/server"

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string; siteCode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ code: "AUTH_BAD_JSON", message: "invalid json" }, { status: 400 })
  }

  const result = await loginWithPassword({
    username: body.username ?? "",
    password: body.password ?? "",
    siteCode: body.siteCode ?? "",
    request,
  })

  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: result.status })
  }

  const response = NextResponse.json({
    code: 200,
    message: "authenticated",
    data: {
      provider: result.user.provider,
      user: result.user,
      permissions: result.user.permissions,
    },
  })
  setSessionCookie(response, result.token)
  return response
}
