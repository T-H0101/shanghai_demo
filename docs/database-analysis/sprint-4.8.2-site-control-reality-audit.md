# Sprint 4.8.2 — 站点控制机制真相审计 (重审版 · 完整 170 张表)

> **状态**: 完成
> **日期**: 2026-06-09
> **数据库**: `star_storage_db` (170 张表, `/Users/tian/Desktop/20260601` PG 物理备份恢复)
> **审计方法**: `information_schema.columns` 全表扫描 + 候选表深度字段分析
> **目标**: 客观判定站点侧是否有"被总控控制"的能力, 评估前端控制按钮的恢复条件

---

## 0. 结论先行

**核心结论**:

| 维度 | 结论 |
|---|---|
| 是否存在 `paused` / `priority` / `control_command` / `dispatch` 字段? | **❌ 0 命中** (170 张表全扫确认) |
| 是否有进度 (`progress`) 跟踪字段? | ✅ **7 张表, 7 字段** (含 `tbl_hot_backup_record`, `tbl_hot_restore_record`, `tbl_interface_task.job_progress` 等) |
| 是否有状态 (`status`) 字段? | ✅ **79 张表, 91 字段** (state machine 基础) |
| 是否有调度 (`cron` / `enable`) 字段? | ✅ **3 张表, 5 cron 字段** (`tbl_schedule_job`, `tbl_check_patrol_strategy`, `tbl_data_receive_list`) |
| 是否有 `pause` / `resume` / `reset` 字段? | ❌ **0 命中** |
| 站点应用是否 poll/读这些表的新行? | ⚠️ **无 evidence** (无应用代码) |
| 是否有 control/command/queue 命名表? | ❌ **0 命中** (只有 `tbl_interface_task` 算"准 control", 命名是 task) |
| 真实结论 | **A + B + C 部分支持** — 进度/状态/调度基础设施在, 但"暂停"等实时控制字段全库无 |

**前端按钮可恢复策略**:
- ✅ **暂停 / 恢复 / 重置 按钮可恢复显示**, 但只走 **audit/simulator** 路径 (`control_command` 队列, 不直接改 `unified_tasks`)
- ⚠️ **前端文案必须明确**"已提交到控制队列, 等待站点拉取", 不能给用户"已暂停"的误导
- ✅ 按钮触发后通过 `POST /api/control/commands` 写入 `control_command` 表, 由 Site Worker 后续拉取
- ❌ **不能改写** `tbl_task` 字段 (170 张表都无 `paused` 字段)

---

## 1. 数据库基础信息

| 指标 | 值 |
|---|---|
| 数据库名 | `star_storage_db` (65 MB) |
| 表总数 | **170** (vs source_restore 13 张) |
| 恢复源 | `/Users/tian/Desktop/20260601/` (pg_basebackup) |
| 容器 | `site_restore_full_postgres` (port 5434) |
| 角色 | `unified` (容器内 trust 模式) |

**与 source_restore 13 张白名单表的差异**:
- 13 张白名单 (Sprint 2B.4): tbl_task / tbl_disc_lib / tbl_magzines / tbl_slots / tbl_hd_info / tbl_lib_task / tbl_disc / tbl_logical_volume / tbl_volume_slot / tbl_user_task / tbl_user / tbl_site / tbl_platform
- 完整站点库新增 157 张表, 覆盖: **调度/巡检/热备/热恢复/数据接收/可信验证/任务证书/任务验收/ISO 同步**

---

## 2. 全库字段扫描 (Phase 1)

### 2.1 候选控制关键词统计 (170 张表, 全部 `public` schema)

| 关键词组 | 命中字段数 | 命中表数 | 典型表 |
|---|---|---|---|
| **PAUSE/RESUME/PRIORITY/CONTROL_COMMAND/DISPATCH** | **0** | **0** | — (全库无) |
| **STATUS** | 91 | 79 | `tbl_task.status`, `tbl_hot_backup_record.status`, `tbl_check_patrol_task.status` |
| **VERIFY** | 12 | 8 | `tbl_credible_verify.verify_status`, `tbl_disc.verify_dt`, `tbl_task.verify_mode` |
| **STAGE** | 8 | 3 | `tbl_user_task.user_stage_acting`, `tbl_disc.stage`, `tbl_interface_task.job_stage` |
| **ENABLE** | 7 | 7 | `tbl_schedule_job.enable`, `tbl_check_patrol_strategy.enable`, `tbl_data_receive_list.schedule_enable` |
| **PROGRESS** | 7 | 7 | `tbl_disc.disc_progress`, `tbl_hot_backup_record.progress`, `tbl_interface_task.job_progress` |
| **JOB** | 6 | 5 | `tbl_interface_task.job_type`, `tbl_schedule_job.func_name`, `tbl_lib_task.task_status` |
| **CRON** | 5 | 3 | `tbl_schedule_job.cron`, `tbl_data_receive_list.schedule_cron`, `tbl_check_patrol_strategy.cron` |
| **INSPECT** | 5 | 1 | `tbl_disc_inspect.{inspect_mode,inspect_type,inspector,inspect_start_time,inspect_stop_time}` |
| **RECOVER** | 2 | 2 | `tbl_hot_restore_record`, `tbl_hot_backup_record` |
| **COMMAND** | 1 | 1 | `tbl_lib_task.command` (驱动命令, **非用户控制**) |
| **QUEUE** | 0 | 0 | — |
| **NOTIFY/ALARM** | 0 | 0 | — |

**关键发现**:
- `paused` / `priority` / `control_command` / `dispatch` 在 170 张表里**全部 0 命中**
- 状态/进度/调度基础设施**完整存在**, 79 张表有 `status` 字段, 7 张表有 `progress`, 3 张表有 `cron`
- 没有任何 `control_*` / `command_*` 命名表 (只有 `tbl_lib_task.command` 是驱动命令字符串)

### 2.2 调度基础设施 (3 张表)

| 表 | 关键字段 | 用途 |
|---|---|---|
| `tbl_schedule_job` | `task_name`, `func_name`, `func_sign`, `func_param`, `cron`, `cron_desc`, `enable` | 站点内部 cron 调度器 |
| `tbl_data_receive_list` | `schedule_cron`, `schedule_cron_desc`, `schedule_enable`, `status` | 数据接收任务 + 调度 |
| `tbl_check_patrol_strategy` | `cron`, `template_id`, `enable`, `effective_date`, `terminated_date` | 巡检策略 + cron |

### 2.3 进度/状态机 (7 + 79 张表)

| 表 | 进度字段 | 状态字段 | 错误字段 | 起止时间 |
|---|---|---|---|---|
| `tbl_hot_backup_record` | `progress (int)` | `status (smallint)` | `error_message` | `start_time`, `end_time` |
| `tbl_hot_restore_record` | `progress (int)` | `status (smallint)` | `error_message` | `start_time`, `end_time` |
| `tbl_interface_task` | `job_progress (smallint)` | `job_status (smallint)`, `job_stage (smallint)`, `processing` | `err_code`, `err_str` | `create_time` |
| `tbl_check_patrol_task` | `archive_count`, `success_count`, `fail_count` | `status (text)`, `del_status` | `message` | `start_time`, `finished_time` |
| `tbl_disc` | `disc_progress` | `iso_status`, `stage` | `burn_errors` | — |
| `tbl_backup_db` | `progress (smallint)` | `status (smallint)` | — | `create_dt` |
| `tbl_task` | — | `status (int)`, `burn_status` | — | `start_time` (派生) |

---

## 3. 原生控制机制判断 (Phase 2)

### 3.1 唯一结论: **A + B + C 部分支持** (混合, 但**仍缺关键件**)

| 选项 | 证据 | 结论 |
|---|---|---|
| A. 原生控制命令表 | `tbl_interface_task` 有 `job_type`/`job_stage`/`job_status`/`job_progress`/`err_code`/`err_str` — **结构等同于 control_command** (只是命名不同) | ✅ 部分存在 |
| B. 状态字段驱动 (改 status 后站点会执行) | `tbl_hot_backup_record.status`, `tbl_hot_restore_record.status`, `tbl_check_patrol_task.status` 均存在; 但**无应用代码证据**说明这些表被外部 poll/读取; 全部 0 行 (系统未运行) | ⚠️ 表存在, 但无 evidence of external response |
| C. 定时任务 / 调度 | `tbl_schedule_job`, `tbl_data_receive_list.schedule_cron`, `tbl_check_patrol_strategy.cron` — **3 张表有 cron**; 但**站点内部调度**, 由站点 app 自驱, 不是外部控制入口 | ⚠️ 调度存在, 但由站点 app 自驱 |
| D. 完全没有控制机制 | 推翻: 多张表有完整状态/进度/调度字段 | ❌ 不成立 (但应用层 evidence 缺失) |

### 3.2 关键修正: Sprint 4.8.2 (初版) 的"没有 paused/priority 字段"在 170 张表下仍然成立

| 字段 | source_restore (13 张) | star_storage_db (170 张) | 一致性 |
|---|---|---|---|
| `paused` | 0 | 0 | ✅ 一致 |
| `priority` | 0 | 0 | ✅ 一致 |
| `pause` / `resume` / `reset` | 0 | 0 | ✅ 一致 |
| `control_command` (表/字段) | 0 | 0 | ✅ 一致 |
| `dispatch` | 0 | 0 | ✅ 一致 |

**结论**: **暂停/恢复/重置/优先级 字段, 在完整站点库中也不存在**. 站点表没有"被外部实时控制"的设计.

### 3.3 `tbl_lib_task.command` 是什么?

| 值 | 含义 |
|---|---|
| `StartOneMakeIso` | 启动 ISO 制作 |
| `CopyHdDrive` | 复制硬盘 |
| `BurnOneDrive` | 刻录单盘 |

**驱动命令** (application → lib driver). 由站点应用写入, 光驱控制器读取执行. **总控无法通过改这个字段来控制站点**.

---

## 4. Site Worker 去留判断 (Phase 3)

### 4.1 Sprint 4.8.1 现状回顾

- **Site Worker 角色**: 框架 + audit + simulator (非执行器)
- **5 个 commandType** 全部走 `control_command` 队列, 由 `/api/control/commands` 创建, 由 Site Worker `worker-site.ts` 拉取
- **Sprint 4.8.1.8 安全修正**: DRY_RUN=true 时只模拟, 不连真站点; DRY_RUN=false + 无 SITE_DATABASE_URL → fail-closed

### 4.2 重审结论: **保留 + 角色升级** (从 simulator → 调度编排 + 审计监控)

**5 个 commandType 重新映射**:

| Sprint 4.8.1 原始 | Sprint 4.8.2 (170 张表) 重审 | 行动 |
|---|---|---|
| `task_pause` | **保留 + audit/simulator** — 站点表无 `paused` 字段, 真实执行需领导确认 | 不直接改 `tbl_task`, 走 `control_command` 队列 |
| `task_resume` | **保留 + audit/simulator** — 同上 | 同上 |
| `task_reset` | **保留 + audit/simulator** — 站点表 `tbl_task.status` 语义不明, 改后无 evidence 站点会响应 | 同上 |
| `inspect_start` | **重定向 (待领导确认)**: 改写为 INSERT INTO `tbl_check_patrol_task` 或 `tbl_data_receive_list` (而非 `tbl_task`) | 当前维持 audit, Sprint 4.9+ 决定 |
| `recovery_start` | **重定向 (待领导确认)**: 改写为 INSERT INTO `tbl_hot_restore_record` (而非 `tbl_task`) | 当前维持 audit, Sprint 4.9+ 决定 |

**新候选表 (需领导确认)**: 是否让 worker 直接写这些表?
- `tbl_hot_restore_record` (recovery_start 目标)
- `tbl_hot_backup_record` (热备目标)
- `tbl_check_patrol_task` (inspect_start 目标)
- `tbl_data_receive_list` (数据接收/巡检入口)

---

## 5. 前端按钮恢复策略 (Phase 4) — **本审计的核心建议**

### 5.1 当前状态回顾 (Sprint 4.8.1.4 之后)

Sprint 4.8.1.4 (Post-Review) 把 Tasks 页面的 暂停/恢复/重置 3 个按钮**删除**, 原因是"审计后判断无真实控制机制, 按钮会误导用户".

### 5.2 重审后建议: **恢复按钮显示, 但只走 audit/simulator**

| 按钮 | 行为 | 文案 | 是否可安全恢复? |
|---|---|---|---|
| **暂停** | `POST /api/control/commands` (commandType=`task_pause`, targetType=`task`, targetId=task.id) | "已提交到控制队列, 等待站点拉取执行" | ✅ **可恢复** (audit/simulator, 不直接改表) |
| **恢复** | `POST /api/control/commands` (commandType=`task_resume`, ...) | 同上 | ✅ **可恢复** |
| **重置** | `POST /api/control/commands` (commandType=`task_reset`, ...) | 同上 | ✅ **可恢复** |
| 推进进度 (SkipForward) | 本地 UI state (mock only) | "推进下一阶段" | ✅ 保留 (UI demo, 不误导) |
| 标记完成 (CheckCheck) | 本地 UI state (mock only) | "标记为完成" | ✅ 保留 |
| 标记失败 (XCircle) | 本地 UI state (mock only) | "标记为失败" | ✅ 保留 |
| 导出 (Download) | 本地导出 | "导出任务" | ✅ 保留 |
| 详情 (Eye) | 打开 drawer | "查看详情" | ✅ 保留 |
| 新建任务 | POST `/api/tasks` (非 control_command) | "创建任务" | ✅ 保留 (真实业务) |

### 5.3 按钮显示条件 (按任务 phase)

- **暂停 (Pause)**: phase ∈ `{scanning, preparing, splitting, packaging, verifying, writing}` (运行中)
- **恢复 (Play)**: phase === `paused`
- **重置 (RotateCcw)**: phase ∈ `{pending, scanning, preparing, splitting, packaging, verifying, writing, paused}` (未完成)

### 5.4 实现位置 (Sprint 4.8.2-R 落地)

| 位置 | 现有按钮 | 新增按钮 |
|---|---|---|
| `app/tasks/page.tsx` 表格操作列 (line 470+) | Eye / SkipForward / CheckCheck / XCircle / Download | **新增** Pause / Play / RotateCcw |
| `app/tasks/page.tsx` 详情抽屉 "任务操作" section (line 696+) | 推进 / 标记完成 / 标记失败 / 导出 | **新增** 暂停 / 恢复 / 重置 |

### 5.5 核心实现: `handleControlCommand()` handler

```ts
const handleControlCommand = async (task, commandType, label, e?) => {
  e?.stopPropagation()
  if (!isApiMode) {
    toast({ title: "Mock 模式不支持", description: "请切换到 API 模式提交控制命令", variant: "destructive" })
    return
  }
  try {
    const res = await fetch("/api/control/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceSiteId: task.siteCode,
        commandType,
        targetType: "task",
        targetId: task.id,
        payload: { taskNo: task.taskNo, name: task.name, phase: task.phase },
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "提交失败")
    toast({ title: `${label}命令已提交`, description: `「${task.name}」${label}命令已记录到控制队列, 等待站点拉取执行` })
  } catch (err) {
    toast({ title: "提交失败", description: ..., variant: "destructive" })
  }
}
```

### 5.6 文案合规性 (避免用户误解)

- ✅ Toast 必须含 "**等待站点拉取执行**", 不能说 "暂停成功"
- ✅ 按钮 title 保持简洁 ("暂停" / "恢复" / "重置")
- ✅ Toast title 含 "**已提交**" (不是"已暂停")
- ✅ 命令可在 `/control` 页面查看 (5s 自动刷新)

---

## 6. 低风险修正 (Phase 5) — Sprint 4.8.2-R 已执行

### 6.1 实际执行的变更
- ✅ `app/tasks/page.tsx` — 新增 `handleControlCommand()` handler
- ✅ `app/tasks/page.tsx` — 表格操作列新增 暂停/恢复/重置 按钮 (按 phase 条件显示)
- ✅ `app/tasks/page.tsx` — 详情抽屉 "任务操作" section 新增 暂停/恢复/重置 按钮
- ✅ `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (本文件) — 覆盖到 170 张表扫描结果
- ✅ `docs/summary/PROJECT_STATUS.md` — 更新 Sprint 4.8.2 段落
- ✅ `docs/summary/ROADMAP.md` — 更新 Sprint 4.8.2 段落

### 6.2 禁止做的事 (CLAUDE.md + Sprint 4.2 收敛)
- ❌ 不直接修改 `unified_tasks` 状态 (Sprint 4.2 收敛: 单向 pull, 不反向写)
- ❌ 不直接修改 `tbl_task` 等站点表字段 (170 张表无 paused 字段)
- ❌ 不写新的同步协议 (Sprint 2G.1 已定型)
- ❌ 不写新的控制协议 (Sprint 4.5 已定型)
- ❌ 不在 Sprint 4.8.2-R 改 dispatch 映射 (推迟到 Sprint 4.9 等领导确认)

---

## 7. 下一步推荐 (Phase 6)

### 短期 (Sprint 4.9+)
1. **等领导确认**:
   - 是否允许 worker 写 `tbl_hot_restore_record` / `tbl_check_patrol_task` / `tbl_data_receive_list`?
   - 站点表能否加新字段 (paused/priority)?
   - 站点应用是否会 poll 这些表的新行?
   - 是否提供真 API 文档?
2. **如果**领导确认: worker 重写 5 dispatch, 改写目标表, 增加 cron 调度
3. **如果**领导不确认: 维持当前 audit + simulator, 仅总控侧跟踪

### 中期
- 真站点部署 worker, 验证 INSERT INTO 新表能否被站点应用响应
- 进度监控: GET FROM `tbl_hot_backup_record.progress` 写到 `unified_*`

### 长期
- 与站点运维建立 SLA: 命令从下发到执行的预期时长
- 异常告警: 进度卡死 > N 分钟触发告警

---

## 8. 文件清单

### 8.1 已变更
- `app/tasks/page.tsx` (Sprint 4.8.2-R)
  - 新增 `handleControlCommand()` handler
  - 表格操作列新增 3 按钮
  - 详情抽屉新增 3 按钮

### 8.2 已新增
- `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (本文件, 重写覆盖)

### 8.3 未变更 (保持现状)
- `lib/control/control-command.ts` (5 函数 + 5 commandType 不变)
- `app/api/control/commands/route.ts` (POST/GET 不变)
- `app/api/site-control/commands/route.ts` (GET 不变)
- `app/api/site-control/commands/[id]/{result,ack}/route.ts` (POST 不变)
- `lib/control/executor.ts` (5 dispatch 不变)
- `scripts/worker-site.ts` (主循环不变)
- `databases/sprint-4.8/audit-log.sql` (12 字段不变)

---

## 9. 总结

| 维度 | Sprint 4.8.2 初版 (13 张表) | Sprint 4.8.2 重审版 (170 张表) | 一致性 |
|---|---|---|---|
| 扫描范围 | source_restore (13 张白名单) | star_storage_db (170 张完整) | 重审更广 |
| 控制表 | 0 | 至少 **8 张候选** (schedule_job, interface_task, hot_*, check_patrol_*, data_receive_*, disc_inspect, task_check) | 重审发现新表 |
| 调度机制 (cron) | 0 | ✅ 3 张表有 cron | 重审发现 |
| 进度跟踪 (progress) | 1 (tbl_disc) | ✅ 7 张表 | 重审发现 |
| 状态机 (status) | 多 | ✅ 79 张表 | 重审统计 |
| **paused/priority 字段** | ❌ 0 | ❌ 0 (170 张也确认) | ✅ **一致** |
| **Site Worker 角色** | simulator | **调度编排 + 审计监控** (角色更广) | 重审升级 |
| **前端按钮恢复** | 不恢复 (4.8.1.4 删除) | **恢复** (audit/simulator, 不改真实字段) | 重审反转 |
| 5 dispatch 目标表 | tbl_task (无 paused) | tbl_task (audit) + 待定 (inspect/recovery) | 重审留 4.9+ |

**核心修正**:
- Sprint 4.8.2 初版 "D 完全没有控制机制" 在 170 张表下被推翻 (有 cron + progress + status 基础设施)
- 但 **暂停/恢复/重置 字段在 170 张表下仍 0 命中** — 真实执行的字段基础**不存在**
- 前端按钮**可恢复**, 但只能走 audit/simulator (control_command 队列) 路径, 不能直接改 `unified_tasks` 也不能改 `tbl_task`
- **5 dispatch 重映射**目标表 (`tbl_hot_restore_record`, `tbl_check_patrol_task`, `tbl_data_receive_list`) 推迟到 Sprint 4.9+ 等领导确认
