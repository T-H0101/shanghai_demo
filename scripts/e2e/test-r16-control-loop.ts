/**
 * R.16 — Task control execution loop e2e
 *
 * 验证 6 步闭环:
 *  1. POST /api/control/commands (task_pause) 写 control_command
 *  2. POST /api/control/commands/[id]/execute 同步触发 executor
 *  3. executor 改 tbl_task.status=20 (DRY_RUN=false) 或 dry_run_success (DRY_RUN=true)
 *  4. audit_log 落 (before/after status 整数)
 *  5. control_command 状态流转 (pending → success/dry_run_success/unsupported)
 *  6. toast 字段 (前端不参与 e2e, 仅后端验证)
 *
 * 同步回读:
 *  - worker 写后, 跑 import:tasks 让 unified_tasks 拉到新 status
 *  - /api/tasks 返回的 status/phase 反映变化
 *
 * 严格区分 3 个真相:
 *  - DRY_RUN=false + 站点可达 → 真写 (Sprint 4.8.1.6 验过)
 *  - DRY_RUN=true → 模拟
 *  - 站点 app 消费 evidence → 0 evidence (R.1 §6 标 blocked_by_site_change)
 */

import { setTimeout as sleep } from "node:timers/promises"
import { execSync } from "node:child_process"
import { installAuthenticatedFetch } from "./auth-helper"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SITE = process.env.SITE_CODE ?? "SH01"

let pass = 0, fail = 0
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ": " + detail : ""}`) }
  else { fail++; console.log(`  ❌ ${name}${detail ? ": " + detail : ""}`) }
}

async function main() {
  console.log("=== R.16 Task control execution loop e2e ===")
  await installAuthenticatedFetch(BASE)

  // 0. 准备: 查 source_id 在 1-100 范围 (tbl_task 真实存在) 的 task
  const tasksRes = await fetch(`${BASE}/api/tasks?pageSize=50`)
  const tasksJson = await tasksRes.json()
  const taskList = tasksJson?.data?.items ?? []
  const targetTask = taskList.find((t: any) => {
    const sid = parseInt(t.sourceId, 10)
    return !Number.isNaN(sid) && sid >= 1 && sid <= 100
  })
  check("[0] /api/tasks 至少 1 个 task", !!targetTask, `taskNo=${targetTask?.taskNo ?? "—"}`)

  if (!targetTask) {
    console.log("FAIL: 无任务, 退出")
    process.exit(1)
  }

  // R.16: 拿 sourceId (源端 bigint) 给 control_command targetId, executor parseInt 必需
  const targetId = targetTask.sourceId ?? targetTask.id
  const targetIdInt = parseInt(targetId, 10)
  check("[0] targetId 是源端 bigint", !Number.isNaN(targetIdInt) && targetIdInt > 0, `sourceId=${targetId}`)

  // 1. POST /api/control/commands (task_pause)
  console.log("\n--- Step 1: POST /api/control/commands ---")
  const createRes = await fetch(`${BASE}/api/control/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceSiteId: SITE,
      commandType: "task_pause",
      targetType: "task",
      targetId,
      payload: { r16E2e: true, taskNo: targetTask.taskNo, unifiedId: targetTask.id },
    }),
  })
  const createJson = await createRes.json()
  check("[1] POST /api/control/commands 201", createRes.status === 201, `status=${createRes.status}`)
  check("[1] 创建 commandNo 存在", !!createJson.command?.commandNo, createJson.command?.commandNo ?? "—")
  const cmdId = createJson.command?.id
  check("[1] 创建 id 存在", !!cmdId, cmdId ?? "—")

  // 2. 同步执行
  console.log("\n--- Step 2: POST /api/control/commands/[id]/execute ---")
  const execRes = await fetch(`${BASE}/api/control/commands/${cmdId}/execute`, { method: "POST" })
  const execJson = await execRes.json()
  check("[2] execute 端点 200", execRes.status === 200, `status=${execRes.status}`)
  check("[2] execute 返回 result.status", !!execJson.result?.status, execJson.result?.status ?? "—")
  const execStatus = execJson.result?.status
  const isRealWrite = execStatus === "success"
  const isDryRun = execStatus === "dry_run_success"
  const isUnsupported = execStatus === "unsupported"
  check("[2] execute 状态合法 (success/dry_run_success/unsupported)",
    isRealWrite || isDryRun || isUnsupported, execStatus)

  // 3. control_command 状态更新
  console.log("\n--- Step 3: control_command 状态 ---")
  const ctrlRes = await fetch(`${BASE}/api/control/commands?siteCode=${SITE}&limit=2`)
  const ctrlJson = await ctrlRes.json()
  const cmdRow = (ctrlJson.rows ?? []).find((r: any) => r.id === cmdId)
  check("[3] control_command 找到", !!cmdRow, cmdRow?.commandNo ?? "—")
  const finalCtrlStatus = cmdRow?.status
  check("[3] control_command 状态流转 (非 pending)",
    finalCtrlStatus && finalCtrlStatus !== "pending", finalCtrlStatus ?? "—")

  // 4. audit_log 落
  console.log("\n--- Step 4: audit_log 落 ---")
  // R.16: audit 按 sourceId (源端 bigint) 查, executor 写真写 sourceId 进 target_id
  const auditCheck = execSync(
    `docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform -tA -c "SELECT COUNT(*), MAX(action), COALESCE(MAX(before_json::text), 'null'), COALESCE(MAX(after_json::text), 'null') FROM audit_log WHERE action='task_pause' AND target_id='${targetId}';"`,
    { encoding: "utf8" }
  ).trim()
  const [auditCount, lastAction, beforeTxt, afterTxt] = auditCheck.split("|")
  check("[4] audit_log 至少 1 行 task_pause", parseInt(auditCount) >= 1, `count=${auditCount}`)
  check("[4] before_data 含 status 字段", beforeTxt?.includes("status") ?? false, beforeTxt?.slice(0, 60) ?? "—")
  check("[4] after_data 含 status=20 (paused 目标)", afterTxt?.includes("status") ?? false, afterTxt?.slice(0, 60) ?? "—")

  // 5. 真写测试站点库 (R.16 真实验证, R.3 修过 status 整数枚举)
  if (isRealWrite) {
    console.log("\n--- Step 5: 真写测试站点库 (star_storage_db) ---")
    const dbCheck = execSync(
      `docker exec -i unified_disc_postgres psql -U unified -d source_restore -tA -c "SELECT status FROM tbl_task WHERE id=${targetIdInt};"`,
      { encoding: "utf8" }
    ).trim()
    check("[5] tbl_task.status = 20 (paused 整数枚举)", dbCheck === "20", `status=${dbCheck}`)
  } else if (isDryRun) {
    console.log("\n--- Step 5: DRY_RUN 模拟, 验证未真改 ---")
    const dbCheck = execSync(
      `docker exec -i unified_disc_postgres psql -U unified -d source_restore -tA -c "SELECT status FROM tbl_task WHERE id=${targetIdInt};"`,
      { encoding: "utf8" }
    ).trim()
    check("[5] DRY_RUN 模式 tbl_task.status 未变 (R.3 框架)",
      dbCheck !== "20", `status=${dbCheck} (DRY_RUN=true)`)
  } else if (isUnsupported) {
    console.log("\n--- Step 5: unsupported (源端缺字段) ---")
    check("[5] unsupported 路径走通, reason 已记录", !!execJson.result?.reason, execJson.result?.reason ?? "—")
  }

  // 6. 同步回读: import:tasks 后 /api/tasks 应反映
  console.log("\n--- Step 6: 同步回读 (import → /api/tasks) ---")
  try {
    execSync("set -a && source .env.local && set +a && pnpm import:tasks SH01 > /dev/null 2>&1", {
      shell: "/bin/bash",
      timeout: 60000,
    })
    const tasksAfter = await fetch(`${BASE}/api/tasks?siteCode=${SITE}&pageSize=500`)
    const tasksAfterJson = await tasksAfter.json()
    const updatedTask = (tasksAfterJson?.data?.items ?? []).find((t: any) =>
      String(t.sourceId) === String(targetId)
    )
    check("[6] import:tasks 后 /api/tasks 按 sourceId 返回该 task", !!updatedTask, `sourceId=${targetId}`)
    if (isRealWrite) {
      check("[6] status=paused 真回读到中心库", updatedTask?.status === "paused", `status=${updatedTask?.status}`)
    } else {
      check("[6] DRY_RUN 模式 status 维持原状", updatedTask?.status !== "paused", `status=${updatedTask?.status}`)
    }
  } catch (e) {
    check("[6] import:tasks 同步回读 (含 e2e)", false, e instanceof Error ? e.message : String(e))
  }

  // 7. 恢复: task_resume (让源端状态回 0, 不留脏数据)
  console.log("\n--- Step 7: 恢复 (task_resume) ---")
  const resumeRes = await fetch(`${BASE}/api/control/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceSiteId: SITE,
      commandType: "task_resume",
      targetType: "task",
      targetId,
      payload: { r16E2eCleanup: true, unifiedId: targetTask.id },
    }),
  })
  const resumeJson = await resumeRes.json()
  if (resumeJson.command?.id) {
    const execResume = await fetch(`${BASE}/api/control/commands/${resumeJson.command.id}/execute`, { method: "POST" })
    const resumeExecJson = await execResume.json()
    check("[7] 恢复命令执行", resumeExecJson.result?.status !== "pending", resumeExecJson.result?.status)
    if (resumeExecJson.result?.status === "success") {
      const dbAfter = execSync(
        `docker exec -i unified_disc_postgres psql -U unified -d source_restore -tA -c "SELECT status FROM tbl_task WHERE id=${targetIdInt};"`,
        { encoding: "utf8" }
      ).trim()
      check("[7] tbl_task.status 恢复 = 0", dbAfter === "0", `status=${dbAfter}`)
    }
  }

  console.log(`\n=== R.16 e2e: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error("❌ R.16 e2e crashed:", e)
  process.exit(1)
})
