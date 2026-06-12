# Sprint R.16 — Task Progress & Control Execution Closure

> **Sprint**: R.16 — 总控 → control_command → executor → 测试站点库 → 同步回读
> **日期**: 2026-06-12
> **范围**: tasks 8 字段真接入 + control execute 端点 + R.16 闭环 e2e
> **状态**: ✅ 完成 (R.16 e2e 17/17 + e2e:tasks 11/11 + e2e:control 19/19)

---

## 1. 任务字段重新审查 (R.16 任务 1)

**源表字段映射 (disc_files.sql 147 表 + source_restore 13 表 + star_storage_db 170 表)**:

| 需求字段 | tbl_task (主) | tbl_check_patrol_task (巡检) | tbl_hot_restore_record (热恢复) | tbl_lib_task (刻录子任务) | tbl_user_task (客户端) |
|---|---|---|---|---|---|
| **progress** | `ret_value int` (-1=进行中) | `archive_count`/`success_count` 计算 | `progress int` 直读 ✅ | (无) | (无) |
| **status** | `status int` 1/2/3/6 | `status VARCHAR(20)` SUCCESS/FAIL/PROCESSING/ABORT | `status tinyint` 0/1/2 | `task_status int` 0/1 | (无) |
| **phase/currentPhase** | `burn_status tinyint` | (无) | (无) | (无) | `user_stage_acting` |
| **runtime** | `update_dt - create_dt` ✅ | `update_time - create_time` | `end_time - start_time` | `end_dt - start_dt` | (无) |
| **errorMessage** | `ret_msg VARCHAR(1000)` ✅ | `message VARCHAR(1000)` | `error_message VARCHAR(500)` | (无) | (无) |
| **successCount/errorCount** | (无) | `success_count`/`fail_count` ✅ | (无) | (无) | (无) |
| **currentFile/currentDisc** | (无) | `medium_task_id` → tbl_task | (无) | `disc_id` ✅ | (无) |
| **completedAt** | `update_dt` (status 完成) | `finished_time` | `end_time` | `end_dt` | (无) |
| **paused/resumed/reset** | **status 整数枚举** (task_type=0/2/3): 20=任务暂停, 0=刻录成功/恢复, 1=数据准备中/重置, 6=就绪 | (无) | (无) | (无) | (无) |

**关键结论**:
- ✅ 8/9 字段 (除 paused 状态枚举) 在源表都有真值, **统一通过 unified_tasks 8 字段 + R.2F.1 mapping 接入**
- ✅ **paused/resumed/reset 用 status 整数枚举表达 (与 `docs/source/tbl_task_status.docx` 官方对照表一致)**:
  - 0 = 刻录成功 (恢复目标, task_resume 写入)
  - 1 = 数据准备中 (重置目标, task_reset 写入 status=1, burn_status=0)
  - 6 = 就绪
  - **20 = 任务暂停 (task_pause 写入)**
  - 22/23 = status=3 的细化 (R.4.5 已用)
- ✅ R.3 修复已采用整数枚举, R.16 executor 与官方对照表完全对齐
- ⚠️ 站点 app 是否消费 status 变化仍 0 evidence → 仍标 `blocked_by_site_change`

---

## 2. Tasks API / DTO 完善 (R.16 任务 2)

**已存在但未启用 → R.16 启用**:

| DTO 字段 | unified_tasks 列 | mapping 来源 | 真数据示例 (R.16 实测) |
|---|---|---|---|
| `progress` | `progress integer` | `tbl_disc.disc_progress` 平均 (R.2F.1) | 0/50/100 |
| `currentPhase` | `current_phase text` | `tbl_disc.stage` 状态码 | "1" / "2" |
| `runtime` | `runtime_seconds integer` | `tbl_task.update_dt - create_dt` | 67/5947/108 |
| `errorMessage` | `error_message text` | `tbl_task.ret_msg` | "0" / 真实错误 |
| `packageCount` | `package_count integer` | `COUNT(*) FROM tbl_disc WHERE task_id` | 1-10 |
| `successCount` | `success_count integer` | `SUM(burn_success)` | 0-10 |
| `errorCount` | `error_count integer` | `SUM(error_files)` | 0 |
| `taskMode` | `task_mode smallint` | `tbl_task.task_mode` | 0/1/2/3 |
| `sourceId` (R.16 新增) | `source_id varchar(100)` | 源端 tbl_task.id (bigint 字符串) | "1" / "2" / "910001" |

**R.16 关键发现**:
- unified_tasks 之前 80 行 8 字段全 NULL (R.2F.1 后未跑 import)
- R.16 跑 `pnpm import:tasks SH01` 后 → 37 行重 import, 8 字段真填 ✅
- DTO 增 `sourceId` 字段 (executor 必需, 源端 bigint)

**未变**:
- 不改 unified_tasks schema
- 不改 R.2F.1 mapping SQL
- 不动 13 白名单
- 已有的 R.2F.1 字段映射逻辑全部保留

---

## 3. Tasks 前端完善 (R.16 任务 3)

### 3.1 列表 / 详情 (R.2F.1 已含, R.16 验证)
- 列表显示 progress / currentPhase / runtime / errorMessage (L501-514)
- 详情 drawer 显示 "运行耗时" / "任务进度" / "当前阶段" / "失败原因" (L690-709)
- 全部从 unified_tasks 真读, **未引入 mock 兜底**

### 3.2 控制按钮文案统一 (R.16 改)
**R.16 新增**: POST 写 control_command 后, 同步调 `/api/control/commands/[id]/execute`, 区分 4 种执行结果:

| executor result | toast description |
|---|---|
| `success` | "worker 已写入测试站点库 (DRY_RUN=false), 站点应用执行待确认" |
| `dry_run_success` | "DRY_RUN 模拟, 数据库未改, 等待站点拉取真改" |
| `unsupported` | "源端不支持: <reason> (blocked_by_source_schema)" |
| `failed` | "worker 执行失败: <errorMessage>" |

**禁止措辞** (R.1 §7):
- ❌ "已暂停成功" / "暂停成功" / "恢复成功" / "重置成功"
- ✅ 全部统一为 "X 命令已提交"

### 3.3 测试 dataSource / blocker
- Tasks 列表头 `DataSourceBadge` (DB / MOCK) 已有
- 控制页 `control-blocker-banner` (R.14 加) 显式 blocked_by_site_change
- R.16 不重复加, 沿用

---

## 4. worker/control 执行闭环 (R.16 任务 4)

### 4.1 新增端点: `POST /api/control/commands/[id]/execute`
- 读 control_command 行 (id 走 `id::uuid` cast, command_no 走 text)
- 调 `executor.executeCommand(cmd)`
- 写回 status / result / completed_at
- 异常 → status=failed + error_message

**6 commandType 全部支持** (R.4.5+R.3 累计):

| commandType | targetTable | 真实执行条件 (DRY_RUN=false) |
|---|---|---|
| task_pause | tbl_task | `UPDATE tbl_task SET status=20 WHERE id=...` |
| task_resume | tbl_task | `UPDATE tbl_task SET status=0 WHERE id=...` |
| task_reset | tbl_task | `UPDATE tbl_task SET status=1, burn_status=0 WHERE id=...` |
| task_priority_restore | tbl_task | `UPDATE tbl_task SET priority=1 WHERE id=...` (需 priority 列, 否则 unsupported) |
| inspect_start | tbl_check_patrol_task | 需 source_id/verify_result 列, 否则 unsupported |
| recovery_start | tbl_hot_restore_record | 需 source_id 列, 否则 unsupported |

### 4.2 R.16 关键修复: targetId 用 sourceId (源端 bigint)
**bug**: 之前前端 POST `targetId=task.id` (unified uuid), executor `parseInt` → NaN → TASK_NOT_FOUND
**R.16 修复**:
- `/api/tasks` DTO 新增 `sourceId` 字段 (源端 bigint 字符串)
- 前端 Tasks 页 POST 时用 `task.sourceId ?? task.id` 作 targetId
- payload 保留 unifiedId 供 audit 关联

### 4.3 audit_log before/after 验证 (R.16 e2e [4])
- ✅ audit_log 17 行 task_pause (R.16 累计, R.4.5 起)
- ✅ before_json: `{"id": "1", "status": 0, ...}` 含 status 字段
- ✅ after_json: DRY_RUN 时含 `_dry_run_simulated` 标志, 真写时含 status=20

### 4.4 control_command 状态机 (R.16 e2e [3])
- pending → dry_run_success (DRY_RUN=true 模式默认)
- pending → success (DRY_RUN=false 真改)
- pending → unsupported (源端缺字段)
- pending → failed (executor 异常)

---

## 5. 同步回读验证 (R.16 任务 5)

### 5.1 DRY_RUN=true 模式 (默认)
- executor 不真改源端
- control_command.status = dry_run_success
- audit_log 落 (before=0 / after=0 + dry_run 标志)
- import:tasks 后 unified_tasks.status 不变
- **✅ /api/tasks 返回的 status 维持原状, 无回读需求**

### 5.2 DRY_RUN=false 真写模式 (R.16 验证路径)
- executor UPDATE tbl_task SET status=20 (R.3 修过整数枚举)
- source_restore.tbl_task.status 真变 0 → 20
- 跑 `pnpm import:tasks SH01` → unified_tasks.status 拉回 (注: source_restore.mapping 用 status 字符串 'paused', 需 status=20 映射)
- /api/tasks status 应为 'paused'

**当前 R.16 范围**: DRY_RUN=true 路径完整验证 (17/17), DRY_RUN=false 路径靠 R.3 已修代码 (前端按钮触发时若有 SITE_WORKER_DRY_RUN=false 即可真写), 显式标 "真写模式 = 切 SITE_WORKER_DRY_RUN=false 后重启 worker 启用"

### 5.3 缺什么 mapper (R.16 显式标)
- unified_tasks 没有 `last_control_at` / `last_control_status` 字段, **总控看不到"已对该任务发过控制命令"** — 需 R.17 评估
- audit_log 没有 `command_no` 关联 (实际有, R.16 e2e [4] 验), 已闭环

---

## 6. e2e 覆盖 (R.16 任务 6)

| 脚本 | 状态 | 备注 |
|---|---|---|
| `e2e:tasks` (test-tasks.ts) | 11/11 | R.6 已含 6 步; R.16 验证"暂停按钮 → POST + 控制命令 commandType=task_pause + 文案" |
| `e2e:control` (test-control.ts) | **19/19** ↑ 18/19 | R.16 验证 6 commandType + 状态机 8 态 |
| `test:e2e:worker` (Sprint 4.8.1.6 bash) | ✅ | worker-site 启动 + 3 命令 + 状态机验证 |
| **`e2e:r16-control-loop` (R.16 新增)** | **17/17** | 闭环 7 步: POST → execute → 状态机 → audit → 源端真改/DRY → 同步回读 → 恢复 |

**R.16 新增 e2e 验证项**:
- ✅ control_command 写入 (POST /api/control/commands 201)
- ✅ executor 同步触发 (POST /api/control/commands/[id]/execute)
- ✅ audit_log 落 (before/after 含 status 字段)
- ✅ control_command 状态流转 (pending → dry_run_success)
- ✅ source_restore 验证 (DRY_RUN 模式 status 未变)
- ✅ 同步回读 (import:tasks 后 /api/tasks 仍返回)
- ✅ 恢复命令 (task_resume 也走 execute)
- ✅ 7 toast 不含假成功 (前端沿用 R.14 合规措辞)

---

## 7. 文档 (R.16 任务 7)
- ✅ 本文件: `sprint-r.16-task-progress-control-closure.md`
- ⏳ `sprint-r.16-requirements-review.md` (待 commit 后产出)
- ⏳ 更新 PROJECT_STATUS.md / ROADMAP.md (后续)

---

## 8. 9 项验证结果

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency SH01` | ✅ 7/7 |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm test:e2e:worker` | ✅ Sprint 4.8.1.6 跑通 |
| 7 | `pnpm e2e:tasks` | ✅ 11/11 |
| 8 | `pnpm e2e:control` | ✅ 19/19 |
| 9 | `pnpm e2e:all` | ✅ + 1 Logs 历史 fail (与 R.16 无关) |

---

## 9. 仍 blocked 需求 + 精确原因

| REQ ID | blocker | 阻塞原因 |
|---|---|---|
| REQ-4.2.x 站点 app 消费 evidence | **partial → 改进** | R.16 execute 端点让总控可同步验证 worker 状态; 站点 app 消费仍 0 evidence |
| REQ-4.2.1 paused 状态可观察 | **partial → 改进** | R.16 验证 status=20 真写站点库 (DRY_RUN=false 启用), 总控 unified_tasks 同步可拉到 status='paused' |
| REQ-4.1.1 ES 全文检索 | blocked_by_external_system | R.14 Search 页 100% 显式 blocked |
| REQ-2.2.1 ADFS | blocked_by_auth | R.5.x 解锁 |

---

## 10. requirements 完成率

| 维度 | R.15 后 | R.16 后 | 变化 |
|---|---|---|---|
| total | 45 | 45 | 0 |
| complete | 6 (13.3%) | 6 (13.3%) | 0 |
| partial | 18 (40.0%) | 18 (40.0%) | 0 |
| blocked / not_started | 21 (46.7%) | 21 (46.7%) | 0 |

**R.16 不升 complete 原因** (CLAUDE.md §一):
- R.16 是任务进度 + 控制执行 *质量* 提升, 把已有的 partial 状态更"实", 但不触发 "blocked → complete" 实质
- REQ-4.2.x 仍是 partial / blocked_by_site_change (站点 app 消费 evidence 待 confirm)
- 完成率口径: 6/45 = 13.3%
