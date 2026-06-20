/**
 * POST /api/sync/trigger - 手动同步触发
 * GET  /api/sync/trigger - 查询同步请求列表
 *
 * Sprint R.39 - REQ-2.3.2, REQ-1.2.1, REQ-6.1.3
 *
 * 流程:
 *   1. 管理员点击 "手动同步"
 *   2. 创建 control_command (sync_full/sync_incremental)
 *   3. 创建 sync_request_log 记录
 *   4. Agent poll /api/site-control/commands 获取任务
 *   5. Agent 执行同步, POST /api/sync/package 推送数据
 *   6. Agent POST /api/site-control/commands/[id]/result 回写结果
 *   7. sync_request_log 更新状态为 completed/failed
 *
 * 不允许:
 *   - 不直接 toast "同步成功"
 *   - 不伪造 Agent 执行
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { createControlCommand } from "@/lib/control/control-command"
import { createSyncRequest, listSyncRequests } from "@/lib/sync/sync-request"
import { writeAudit } from "@/lib/control/audit"

export async function POST(req: NextRequest) {
  // Auth
  try {
    const session = await requireSession(req)
    requirePermission(session, "sync:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: any
  try { body = await req.json() } catch { body = {} }

  const siteCode = body.siteCode ?? "SH01"
  const syncType: "full" | "incremental" = body.syncType === "incremental" ? "incremental" : "full"

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  try {
    // Step 1: Create control command
    const commandType = syncType === "full" ? "sync_full" : "sync_incremental"
    const command = await createControlCommand({
      sourceSiteId: siteCode,
      commandType,
      targetType: "site",
      targetId: siteCode,
      payload: {
        syncType,
        protocol: "pg_dump_table_backup",
        transport: "agent_poll",
        source: "site_db",
        tables: [
          "tbl_task",
          "tbl_disc_lib",
          "tbl_magzines",
          "tbl_slots",
          "tbl_hd_info",
          "tbl_lib_task",
          "tbl_disc",
          "tbl_logical_volume",
          "tbl_volume_slot",
          "tbl_user_task",
          "tbl_user",
          "tbl_site",
          "tbl_platform",
        ],
        forbiddenTables: ["tbl_file", "tbl_folder"],
        triggeredAt: new Date().toISOString(),
      },
      requestedBy: null,
      requestedIp: ip,
    })

    // Step 2: Create sync request log
    const syncRequest = await createSyncRequest({
      sourceSiteId: siteCode,
      syncType,
      commandId: command.id,
      requestedIp: ip,
    })

    // Step 3: Audit
    await writeAudit({
      action: `sync_${syncType}_triggered`,
      targetTable: "sync_request_log",
      targetId: syncRequest.id,
      after: { requestNo: syncRequest.request_no, commandNo: command.commandNo, syncType, siteCode },
      actor: "admin",
      siteCode,
      result: "success",
    })

    return NextResponse.json({
      ok: true,
      message: `${syncType === "full" ? "全量" : "增量"}同步命令已提交, 等待站点 Agent 拉取执行`,
      request: {
        requestNo: syncRequest.request_no,
        commandNo: command.commandNo,
        siteCode,
        syncType,
        status: "command_sent",
      },
      timing: {
        submittedAt: new Date().toISOString(),
        note: "同步命令已进入控制队列, Agent 将在下次 poll 时拉取",
      },
    }, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  // Auth
  try {
    const session = await requireSession(req)
    requirePermission(session, "sync:operate")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const siteCode = url.searchParams.get("siteCode") ?? undefined
  const status = url.searchParams.get("status") ?? undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200)
  const offset = Number(url.searchParams.get("offset") ?? 0)

  try {
    const result = await listSyncRequests({ sourceSiteId: siteCode, status, limit, offset })
    return NextResponse.json({
      ok: true,
      data: {
        items: result.rows,
        total: result.total,
        limit,
        offset,
      },
      dataSource: "database",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
