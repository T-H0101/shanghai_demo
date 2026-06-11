/**
 * Next.js Response 适配器 (Sprint R.13)
 *
 * 把 ExportResult 翻译为 NextResponse:
 *  - status=200 + body + headers (含 x-* + Content-Disposition)
 *  - status=501 (xlsx 等未接入) + JSON 错误体
 *
 * Route handler 只需:
 *   const result = buildExport({...})
 *   await recordExport(result.manifest)  // 可选, 失败不阻断
 *   return toNextResponse(result)
 */

import { NextResponse } from "next/server"
import { exportHeaders, type ExportResult } from "./index"

export function toNextResponse(result: ExportResult): NextResponse {
  if (result.code === "not_implemented") {
    return new NextResponse(result.body, {
      status: 501,
      headers: { "content-type": result.contentType },
    })
  }
  return new NextResponse(result.body, {
    status: 200,
    headers: exportHeaders(result),
  })
}
