/**
 * GET /api/search
 * 全文检索 API — Sprint R.4 Bug 2 修复
 *
 * 修复前: 路由 404, /search 页面 100% mock
 * 修复后: 路由返回 not_implemented 状态, 不允许伪造, 不允许 404
 *
 * 阻塞原因: REQ-4.1.1/4.1.2 千万级检索 ≤3 秒需 ES/ClickHouse
 * 状态: blocked_by_external_system (R.1 模板 8 选 1)
 * 真实数据: unified_file_index 4 行 (TEST_CLEAN 测试残留, 任务级索引非跨站)
 *
 * R.4 范围: 0 业务功能, 仅修 404 bug + 显式标记 blocker
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const keyword = request.nextUrl.searchParams.get("q") ?? request.nextUrl.searchParams.get("keyword")
    const siteCode = request.nextUrl.searchParams.get("siteCode")

    return NextResponse.json(
      {
        code: 501,
        message: "Search API not implemented",
        source: "not_implemented",
        blocker: "blocked_by_external_system",
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
        meta: {
          keyword: keyword ?? null,
          siteCode: siteCode ?? null,
          reason: "全文检索需 ES/ClickHouse, 当前未接入",
          requirement: {
            id: "REQ-4.1.1",
            text: "跨维度检索 (名称/后缀/部门/卷/盘)",
            priority: "P1",
            status: "blocked_by_external_system",
          },
          relatedRequirements: [
            "REQ-4.1.1 跨维度检索",
            "REQ-4.1.2 检索性能 ≤3 秒 (千万级)",
            "REQ-5.2.1 索引范围 (按盘笼 + 校验码)",
          ],
          currentReality: {
            taskLevelFileIndex: 4, // unified_file_index 行数 (任务级, 非跨站)
            sourceTable: "unified_file_index",
            note: "任务级索引已有 4 行 (TEST_CLEAN 测试残留), 但跨站千万级检索需 ES 集群",
          },
          nextStep: "领导决策: 引入 ES 集群 (估时 8d ES + 8d 项目)",
        },
        traceId: `api-${Date.now()}`,
      },
      { status: 501 }
    )
  } catch (error) {
    console.error("[API Error] /api/search:", error)
    return NextResponse.json(
      {
        code: 500,
        message: "Internal server error",
        source: "not_implemented",
        error: error instanceof Error ? error.message : String(error),
        traceId: `api-${Date.now()}`,
      },
      { status: 500 }
    )
  }
}
