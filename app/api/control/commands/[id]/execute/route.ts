/**
 * POST /api/control/commands/[id]/execute - 同步执行控制命令
 *
 * R.16 新增: 让前端在 POST /api/control/commands 之后可同步触发 executor
 *
 * 行为:
 *   - 读 control_command 行
 *   - 调 executor.executeCommand (DRY_RUN 由 SITE_WORKER_DRY_RUN 环境变量控制)
 *   - 写回 control_command.status + result + completed_at
 *   - audit_log 自动落 (executor 内部 writeAudit)
 *
 * 状态:
 *   - success: 真改测试站点库 (DRY_RUN=false)
 *   - dry_run_success: 模拟, 未真改 (DRY_RUN=true)
 *   - unsupported: 源端缺字段, 给出 blocker
 *   - failed: 执行异常
 *
 * 注意: 此端点仅是 worker 同步触发器, 不替代真正的轮询 (worker-site.ts)。
 * 真实完成 (站点应用消费 evidence) 仍需 blocked_by_site_change 解除。
 */

import { NextRequest, NextResponse } from "next/server"
import { getControlCommand } from "@/lib/control/control-command"
import { executeCommand } from "@/lib/control/executor"
import { query } from "@/lib/db"

const ALLOWED_EXEC_STATUSES = [
  "pending", "pulled", "running", "failed", "dry_run_success", "unsupported",
] as const

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 })
  }
  const cmd = await getControlCommand(id)
  if (!cmd) {
    return NextResponse.json({ ok: false, error: "command not found" }, { status: 404 })
  }
  try {
    const result = await executeCommand(cmd)
    // 直接 UPDATE: 含 dry_run_success/unsupported 状态
    const finalStatus = ALLOWED_EXEC_STATUSES.includes(result.status as any) ? result.status : "failed"
    await query(
      `UPDATE control_command
       SET status = $2,
           completed_at = now(),
           result = COALESCE($3::jsonb, result),
           error_message = $4
       WHERE id = $1`,
      [
        cmd.id,
        finalStatus,
        JSON.stringify(result.result),
        result.errorMessage ?? null,
      ]
    )
    return NextResponse.json({
      ok: true,
      commandNo: cmd.commandNo,
      result: {
        status: result.status,
        affectedRows: result.result.affectedRows,
        dryRun: result.result.dryRun,
        targetTable: result.result.targetTable,
        targetId: result.result.targetId,
        before: result.result.before,
        after: result.result.after,
        blocker: result.result.blocker,
        reason: result.result.reason,
        errorMessage: result.errorMessage,
        durationMs: result.durationMs,
      },
    })
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    await query(
      `UPDATE control_command
       SET status = 'failed',
           completed_at = now(),
           error_message = $2
       WHERE id = $1`,
      [cmd.id, err]
    )
    return NextResponse.json({ ok: false, error: err }, { status: 500 })
  }
}
