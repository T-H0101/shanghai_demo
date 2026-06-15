import { NextRequest, NextResponse } from "next/server"
import { resolveTaskCreateNavigation } from "@/lib/site-navigation/task-create"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const siteCode = request.nextUrl.searchParams.get("siteCode")?.trim() ?? ""
  const traceId = `api-${Date.now()}`

  if (!siteCode || !/^[A-Za-z0-9_-]{1,32}$/.test(siteCode)) {
    return NextResponse.json(
      {
        code: 400,
        message: "invalid siteCode",
        data: null,
        dataSource: "configuration",
        traceId,
      },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json({
      code: 0,
      message: "ok",
      data: resolveTaskCreateNavigation(siteCode),
      dataSource: "environment_key_ref",
      traceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        code: 500,
        message:
          error instanceof Error
            ? error.message
            : "invalid task create navigation configuration",
        data: null,
        dataSource: "error",
        traceId,
      },
      { status: 500 }
    )
  }
}
