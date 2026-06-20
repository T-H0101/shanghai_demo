/**
 * GET /api/search
 * 跨维度检索 API — R.48 重写
 *
 * 数据来源: star_storage_db tbl_file_* 分区表 (直接查询, 不全量导入 PG17)
 * 限制: LIMIT 200, 不支持千万级全文检索 (需 ES/ClickHouse)
 *
 * REQ-4.1.1: 跨维度检索 (名称/后缀/部门/卷/盘) — partial
 * REQ-4.1.2: 检索性能 ≤3 秒 (千万级) — blocked_by_external_system
 */

import { NextRequest, NextResponse } from "next/server"
import { searchFileIndex } from "@/lib/source/file-index-source"

export async function GET(request: NextRequest) {
  try {
    const keyword = request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("keyword") ?? undefined
    const suffix = request.nextUrl.searchParams.get("suffix") ?? undefined
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? "50"), 200)

    const result = await searchFileIndex({
      keyword,
      suffix,
      limit,
    })

    return NextResponse.json({
      code: 0,
      data: {
        items: result.items,
        total: result.items.length,
        source: result.source,
        limitations: result.limitations,
        missingDimensions: result.missingDimensions,
      },
      meta: {
        keyword: keyword ?? null,
        suffix: suffix ?? null,
        limit,
        source: result.source,
        blocker: result.source === "blocked_by_external_system" ? "blocked_by_external_system" : null,
        note: result.source === "site_restore_db"
          ? "直接查询 star_storage_db tbl_file_* 分区, LIMIT 保护. 千万级检索需 ES."
          : "数据源不可用",
        requirements: {
          "REQ-4.1.1": result.items.length > 0 ? "partial" : result.source,
          "REQ-4.1.2": "blocked_by_external_system (需 ES/ClickHouse)",
        },
      },
    })
  } catch (error) {
    console.error("[API Error] /api/search:", error)
    return NextResponse.json(
      { code: -1, message: (error as Error).message },
      { status: 500 },
    )
  }
}
