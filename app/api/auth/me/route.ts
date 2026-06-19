import { NextRequest, NextResponse } from "next/server"
import { sessionFromRequest } from "@/lib/auth/server"

export async function GET(request: NextRequest) {
  const user = await sessionFromRequest(request)
  if (!user) {
    return NextResponse.json({ code: "AUTH_UNAUTHENTICATED", message: "unauthenticated" }, { status: 401 })
  }

  return NextResponse.json({
    code: 200,
    message: "ok",
    data: {
      user,
      permissions: user.permissions,
    },
  })
}
