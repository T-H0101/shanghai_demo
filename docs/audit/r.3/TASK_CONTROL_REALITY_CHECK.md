# Sprint R.3 — Task Control 6 Atoms Reality Check (任务控制 6 原子真实度)

> **日期**: 2026-06-10
> **方法**: 5 维度 (UI/API/DB/Exec/Req) × 7 原子 (新建/暂停/恢复/重置/巡检/恢复任务/优先恢复) 矩阵
> **原则**: requirements.md §4.2 真实验收条件 (4 条件全部满足才算 complete)

---

## 0. 7 原子真实验收条件 (R.1 §4)

| # | 条件 | 含义 |
|---|---|---|
| 1 | 总控提交命令 | UI 按钮真接通 → POST /api/control/commands → control_command 写入 |
| 2 | 站点 app poll/读新行 | 站点应用代码 evidence (我们没有) |
| 3 | 站点执行, 状态回写 | `tbl_task.paused` / `priority` 字段被改 (我们没有 paused 字段) |
| 4 | 总控 audit + UI 展示 | audit_log 写入 + UI 显示最终状态 |

**4 条件全部满足 = complete**, 任一缺失 = partial / blocked。

---

## 1. 7 原子 × 5 维度矩阵

| 原子 | UI | API | DB 字段 | Exec 真改 | Req 真实 | 综合 |
|---|---|---|---|---|---|---|
| **新建 (Create)** | 0% | 0% | 0% | 0% | 0% | **0%** |
| **暂停 (Pause)** | 100% | 100% | 0% (站) | 0% | 0% | **40% (audit only)** |
| **恢复 (Resume)** | 100% | 100% | 0% | 0% | 0% | **40%** |
| **重置 (Reset)** | 100% | 100% | 0% | 0% | 0% | **40%** |
| **巡检 (Inspect)** | 0% | 100% | 0% (tbl 0 行) | 0% | 0% | **20%** |
| **恢复任务 (Recovery)** | 0% | 100% | 0% | 0% | 0% | **20%** |
| **优先恢复 (Priority)** | 0% | 0% | 0% | 0% | 0% | **0%** |

**加权平均**: (0+40+40+40+20+20+0) / 7 = **22.9%**

---

## 2. 每个原子详细分析

### 2.1 新建 (Create) — 0%

**REQ 4.2.1: 1. 新建备份/恢复任务**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 0% | `app/tasks/page.tsx:358` onClick 调 `showApiWriteUnavailable("新建任务")` 返回 toast, **不打开 dialog** |
| API | 0% | `/api/tasks` 只有 GET, 无 POST |
| DB | 0% | `unified_tasks` 87 行无 POST 写入路径 |
| Exec | 0% | — |
| Req | 0% | 条件 1 不满足 |

**4 条件**: 0/4

**真实状态**: ❌ **not_started (完全未实现)**

**Sprint 4.8.2-R / R.2 标 partial 错误**, 实际 not_started。

### 2.2 暂停 (Pause) — 40% (audit only)

**REQ 4.2.2: 2.任务暂停**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 100% | Sprint 4.8.2-R 加按钮 (Tasks 表格 + 抽屉各 1 个), 按 phase 显示 |
| API | 100% | POST /api/control/commands 写入 control_command, 37 行中 14 行 task_pause |
| DB 字段 | 0% | `tbl_task` 无 paused 字段 (170 表 0 命中) |
| Exec 真改 | 0% | executor.ts L342 用 centralQuery 假执行; 8 行 paused 是历史 (Sprint 2F.1 之前) |
| Req | 0% | 条件 1 ✅, 条件 2 ❌, 条件 3 ❌, 条件 4 ❌ |

**4 条件**: 1/4 (只有"提交"满足)

**真实状态**: ⚠️ **partial (audit + simulator, 不真改源表)**

### 2.3 恢复 (Resume) — 40% (audit only)

**REQ 4.2.2: 2.任务恢复**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 100% | Play 按钮 (phase='paused' 时显示) |
| API | 100% | POST /api/control/commands task_resume |
| DB 字段 | 0% | 同 Pause |
| Exec | 0% | DRY_RUN 模拟, 0 success / 2 failed (target_id=ui-sim) |
| Req | 0% | 同 Pause |

**4 条件**: 1/4

**真实状态**: ⚠️ **partial**

### 2.4 重置 (Reset) — 40% (audit only)

**REQ 4.2.2: 2.任务重置**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 100% | RotateCcw 按钮 (phase≠completed/failed/paused 时显示) |
| API | 100% | POST /api/control/commands task_reset |
| DB 字段 | 0% | 同 Pause |
| Exec | 0% | executor.ts reset SQL: `UPDATE tbl_task SET status=1, burn_status=0` (但 centralQuery 假执行) |
| Req | 0% | 同 Pause |

**4 条件**: 1/4

**真实状态**: ⚠️ **partial**

### 2.5 巡检 (Inspect) — 20%

**REQ 4.2.3: 数据巡检任务**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 0% | **无 UI 按钮** (Sprint 4.8.2-R 未加) |
| API | 100% | POST /api/control/commands inspect_start (10 success) |
| DB 字段 | 0% | `tbl_check_patrol_task` schema 完整, 但 0 行 |
| Exec | 0% | executor.ts 模拟, 不真写 tbl_check_patrol_task |
| Req | 0% | 4 条件全不满足 |

**4 条件**: 1/4 (条件 1 满足, 因有 commandType)

**真实状态**: ⚠️ **partial (audit only, 无 UI, 无源表行)**

### 2.6 恢复任务 (Recovery) — 20%

**REQ 4.2.3: 数据巡检 / 恢复任务**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 0% | **无 UI 按钮** |
| API | 100% | POST /api/control/commands recovery_start (9 success) |
| DB 字段 | 0% | `tbl_hot_restore_record` schema 完整, 但 0 行 |
| Exec | 0% | executor.ts 模拟, 不真写 |
| Req | 0% | 4 条件全不满足 |

**4 条件**: 1/4

**真实状态**: ⚠️ **partial (audit only, 无 UI, 无源表行)**

### 2.7 优先恢复 (Priority) — 0% 🔴

**REQ 4.2.2: 2.支持优先执行恢复任务**

| 维度 | 真实度 | 证据 |
|---|---|---|
| UI | 0% | **🔴 完全未实现 — 无 priority 按钮** |
| API | 0% | **🔴 COMMAND_TYPES 列表无 priority** (只有 5 个) |
| DB 字段 | 0% | `tbl_task` 无 priority 字段 (170 表 0 命中) |
| Exec | 0% | — |
| Req | 0% | 4 条件全不满足 |

**4 条件**: 0/4

**真实状态**: ❌ **not_started (完全未实现)**

**这是 R.3 发现的重大遗漏**: R.2 矩阵把 REQ-4.2.2 暂停/恢复/重置/优先 4 个原子合并, 没单独列优先恢复; 实际**优先恢复 0%**。

---

## 3. 8 行 unified_tasks.status='paused' 来源追查

R.3 关键验证: 8 行 paused 与 Sprint 4.8.2-R 无关。

### 3.1 SQL 验证

```sql
SELECT id, task_no, source_site_id, status, updated_at
FROM unified_tasks WHERE status='paused';
```

| id | task_no | source_site_id | updated_at |
|---|---|---|---|
| bc8f7e15-dc61-4b9d-9c0b-dc812890581d | TEST_CLEAN-36 | TEST_CLEAN | (历史) |
| 1a20a91e-d56c-44c7-9290-bdefca37dd53 | SH01-36 | SH01 | (历史) |
| 819f4c9a-4e88-49b9-85da-d4dedb9a1328 | TEST_CLEAN-33 | TEST_CLEAN | (历史) |
| cf4761a5-27a0-41e1-b3c5-ee19ebdfd934 | SH01-35 | SH01 | (历史) |
| 46b69065-ef0c-42c8-b93a-39caee95d08f | TEST_CLEAN-35 | TEST_CLEAN | (历史) |
| 5c120098-8b5b-4def-9f70-5ca9b77259da | SH01-33 | SH01 | (历史) |
| 84d1676d-e3f1-477a-b175-6962c5236d78 | SH01-3 | SH01 | (历史) |
| 2be0f9c0-22ec-465d-a38c-26f04bd4c47d | TEST_CLEAN-3 | TEST_CLEAN | (历史) |

### 3.2 与 Sprint 4.8.2-R 的 3 个 success 区分

```sql
SELECT command_no, target_id, status, result
FROM control_command cc
LEFT JOIN audit_log al ON al.command_no=cc.command_no
WHERE cc.command_type='task_pause' AND cc.status='success';
```

| command_no | target_id | result | error |
|---|---|---|---|
| CTRL-SH01-...29F1 | **1** (真) | success | — |
| CTRL-SH01-...1B29 | **1** (真) | success | — |
| CTRL-SH01-...723B | **1** (真) | success | — |
| CTRL-SH01-...8C8C | ui-sim-... | failed | task not found |
| CTRL-SH01-...34F0 | audit-... | failed | task not found |

**结论**:
- 3 个 success (target_id=1) 是 Sprint 4.8.2 之前老数据 (audit 链路 OK 但 exec 假)
- 8 行 `unified_tasks.paused` **不是** Sprint 4.8.2-R 产物
- Sprint 4.8.2-R 3 个 UI 触发的 task_pause (ui-sim-*) 全部 failed

### 3.3 8 行 paused 真实来源

- Sprint 2F.1 加 `unified_tasks.status` 字段时, 通过 mock seed 写入了 8 行 paused 数据
- 可能是测试, 可能是迁移遗留
- 与 Sprint 4.8.2-R (2026-06-09) **无关** (R.2 报告误以为相关)

---

## 4. control_command 状态机完整性 (R.3 实测)

| 状态 | 数量 | 备注 |
|---|---|---|
| pending | 0 | 都被 worker 拉走 |
| pulled | 1 | task_pause, 卡在 pulled |
| running | 0 | **worker 没真跑中间态** (drift 现象) |
| success | 29 | inspect(10) + recovery(9) + task_pause(10) |
| failed | 7 | task_pause(3) + task_resume(2) + task_reset(2) |
| cancelled | 0 | — |

**6 状态机 (R.1 模板要求)**: 实测 4 状态命中, 缺 running/cancelled。

**drift 风险**: pulled 1 行未流转, running 0 行表明 worker 处理太快或没真跑中间态。

---

## 5. 真实控制完成度 总结

| 维度 | 完成度 |
|---|---|
| 链路 (control_command → worker → audit_log) | **100%** (37 行全流转) |
| 模拟完成 (DRY_RUN) | **100%** (5/5 commandType) |
| UI 按钮接通 | **43%** (3/7 原子有按钮) |
| 真控制 (改 `tbl_task.paused` / `priority` / `status`) | **0%** (executor.ts L342 假执行 + 站点表无字段) |
| **整体真实控制完成度** | **0%** |

**禁止措辞** (R.1 §7):
- ❌ "任务控制已完成" / "暂停已实现"
- ✅ "控制队列框架完成" + "DRY_RUN 模拟完成" + "等待站点 schema/app 配合"

---

## 6. Sprint 4.8.2-R 报告的"R.3 校验"

| 声明 | R.3 验证 | 结论 |
|---|---|---|
| 170 张表 0 paused 字段 | ✅ 0 命中 (含 ILIKE) | 准确 |
| 170 张表 0 priority 字段 | ✅ 0 命中 | 准确 |
| 5 commandType 全部 audit | ✅ 验证 | 准确 |
| 8 行 paused 真实存在 | ✅ 验证 | 准确 (但与 Sprint 4.8.2-R 无关) |
| toast 文案合规 | ✅ "已提交到控制队列, 等待站点拉取执行" | 准确 |
| 暂停/恢复/重置 按钮接通 | ✅ UI OK | 准确 |
| **executor.ts L342 假执行** | **❌ Sprint 4.8.2-R 未发现** | **R.3 新发现** |
| **优先恢复 commandType 缺失** | **❌ Sprint 4.8.2-R 未提** | **R.3 新发现** |

---

## 7. R.3 任务控制结论

| 维度 | 真实度 |
|---|---|
| 控制队列框架 (Sprint 4.5) | **95/100** |
| DRY_RUN 模拟 | **100/100** |
| UI 按钮 (Sprint 4.8.2-R) | **43/100** (3/7 原子) |
| 真控制 (Sprint 4.9+) | **0/100** (待站点配合) |

**总评分**: **60/100** (框架完整, 真控制为 0)

**R.3 推翻结论**:
- R.2 报告 "暂停/恢复/重置 100% complete" 是**错的** (真实 audit 100% + 真控制 0%)
- R.2 报告 "优先恢复 partial" 是**错的** (真实 not_started, 0% 全维度)

**下一 Sprint 唯一正确建议**: **R.4 修 4 个🔴 bug** (Tasks 详情 404, /api/search 404, /api/sites mock, executor L342) + **新增 priority commandType** (5 原子 → 6 原子)。
