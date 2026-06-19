import { NextRequest, NextResponse } from "next/server"
import { clearSessionCookie, recordLogout, sessionFromRequest } from "@/lib/auth/server"

export async function POST(request: NextRequest) {
  const user = await sessionFromRequest(request)
  await recordLogout(request, user?.username ?? "unknown")

  const response = NextResponse.json({ code: 200, message: "logged out", data: null })
  clearSessionCookie(response)
  return response
}
