/**
 * POST /api/tasks/create
 * Sprint R.58 — center creates a station task via the control queue.
 *
 * The API:
 *   - requires auth + task:create permission
 *   - validates siteCode, taskName, taskType
 *   - enqueues a `task_create` control command
 *   - writes audit log
 *   - returns 202 with commandId, commandNo, and explicit
 *     "submitted to control queue, waiting for Site Agent" wording.
 *
 * Site Agent consumes the command, inserts a real row into station
 * `tbl_task`, and the next sync run imports it back into
 * `unified_tasks`. The API never directly writes `unified_tasks`.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { query } from "@/lib/db"
import {
  createCenterTaskCommand,
  type CenterTaskType,
  type CenterTaskSource,
} from "@/lib/control/task-create"

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "task:create")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  let body: {
    siteCode?: string
    taskName?: string
    taskType?: string
    priority?: number
    source?: string
    taskMode?: number
    fileRefs?: Array<{
      rootPath: string
      originalPath?: string
      itemName: string
      isFolder?: number
    }>
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json(
      { code: 400, error: "invalid_json" },
      { status: 400 }
    )
  }

  const siteCode = (body.siteCode ?? "").trim()
  if (!siteCode) {
    return NextResponse.json(
      { code: 400, error: "siteCode is required" },
      { status: 400 }
    )
  }
  const taskName = (body.taskName ?? "").trim()
  if (!taskName) {
    return NextResponse.json(
      { code: 400, error: "taskName is required" },
      { status: 400 }
    )
  }
  const taskType = body.taskType as CenterTaskType
  if (taskType !== "backup" && taskType !== "restore") {
    return NextResponse.json(
      { code: 400, error: "taskType must be 'backup' or 'restore'" },
      { status: 400 }
    )
  }

  // R.70 Task 2: validate siteCode against the sync_sites registry
  const siteResult = await query<{ site_code: string; enabled: boolean }>(
    "SELECT site_code, enabled FROM sync_sites WHERE site_code = $1 LIMIT 1",
    [siteCode]
  )
  if (siteResult.rows.length === 0 || siteResult.rows[0].enabled === false) {
    return NextResponse.json(
      { code: 400, error: "siteCode is not registered or disabled" },
      { status: 400 }
    )
  }
  const source = (body.source ?? "center_ui") as CenterTaskSource
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

  try {
    const result = await createCenterTaskCommand({
      siteCode,
      taskName,
      taskType,
      priority: body.priority,
      source,
      taskMode: body.taskMode,
      fileRefs: body.fileRefs,
      actor: "admin",
      ip,
    })

    return NextResponse.json(
      {
        code: 0,
        commandId: result.commandId,
        commandNo: result.commandNo,
        status: result.status,
        message: result.message,
      },
      { status: 202 }
    )
  } catch (err) {
    return NextResponse.json(
      { code: 500, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
