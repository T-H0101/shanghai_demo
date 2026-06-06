# Sprint 2F.1 - 任务域 P0 字段补全

> **日期**: 2026-06-06
> **范围**: unified_tasks 增加 8 个运行时/统计字段
> **前置**: Sprint 2E.1 任务域审查 + Sprint 2E.3 站点域放弃

---

## 一、源字段验证结果

| 字段 | 来源表 | 字段 | 状态 | 适合 |
|---|---|---|---|---|
| `task_mode` | tbl_task | task_mode (smallint) | ✅ 字段存在 (1 行 > 0) | ✅ |
| `error_message` | tbl_task | ret_msg (text) | ✅ 28 行有值 (但 "0" 普遍) | ✅ |
| `runtime_seconds` | tbl_task | update_dt - create_dt | ✅ 29 行可计算 | ✅ |
| `package_count` | tbl_disc | COUNT(*) WHERE task_id = ? | ✅ 真实数据 | ✅ |
| `success_count` | tbl_disc | SUM(burn_success) WHERE task_id = ? | ✅ 真实数据 | ✅ |
| `error_count` | tbl_disc | SUM(error_files) WHERE task_id = ? | ✅ 真实数据 | ✅ |
| `progress` | tbl_disc | AVG(disc_progress) | ✅ 真实值 (100, 33, 50, 0) | ✅ |
| `current_phase` | tbl_disc | MAX(stage) | ✅ 真实值 (2) | ✅ |
| ~~volumeId~~ | tbl_task | ❌ 不在 tbl_task | 在 tbl_task_items/tbl_task_folder | ❌ 不补 |
| ~~sm3Status~~ | tbl_task_certif_status | ❌ 表不在 source_restore | - | ❌ 不补 |

**Sprint 2E.1 文档修正**:
- `volume_id` **不在 tbl_task**, 而在 `tbl_task_items` 和 `tbl_task_folder` (新表, ROI 低, 不在本 Sprint 范围)
- `tbl_interface_task` 不在 source_restore, 不接入
- `tbl_task_certif_status` 不在 source_restore, 不接入

---

## 二、修改文件清单 (8 个)

**新增**:
- `databases/sprint-2f1/unified-task-runtime-fields.sql` — schema patch
- `databases/sprint-2f1/README.md`
- `lib/import/task-runtime-aggregator.ts` — tbl_disc 聚合 + runtime 计算

**修改**:
- `lib/sync/types.ts` — UnifiedTaskRecord 新增 8 字段
- `lib/sync/field-mapper.ts` — mapTask 默认 null
- `lib/sync/upsert.ts` — upsertTasksInTransaction 新增列
- `lib/ingest/tasks-ingest.ts` — mapTaskForIngest 默认 null
- `lib/api/dto/index.ts` — TaskDTO 新增 taskMode/runtime/currentPhase + progress: number | null
- `app/api/tasks/route.ts` — TaskRow 新增 8 字段, SQL 新增 SELECT, mapTaskToDTO 输出新字段

---

## 三、Schema patch (databases/sprint-2f1/unified-task-runtime-fields.sql)

```sql
ALTER TABLE unified_tasks
  ADD COLUMN IF NOT EXISTS task_mode SMALLINT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS runtime_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS package_count INTEGER,
  ADD COLUMN IF NOT EXISTS success_count INTEGER,
  ADD COLUMN IF NOT EXISTS error_count INTEGER,
  ADD COLUMN IF NOT EXISTS progress INTEGER,
  ADD COLUMN IF NOT EXISTS current_phase TEXT;
```

**应用结果**: 8 字段全部已存在 unified_tasks (DBA 验证)。

## 四、Mapper/Importer 变化

### task-runtime-aggregator.ts (新)
- `aggregateTaskDisc(taskId)`: 聚合 tbl_disc 输出 `DiscAggregate { packageCount, successCount, errorCount, progress, currentPhase }`
- `computeRuntimeSeconds(createDt, updateDt)`: 计算秒数
- 单任务查询, 不批量调用 sourceQuery (避免大表扫描)

### real-field-mapper.ts: mapRealTask
- 新参数: `aggregate?: DiscAggregate`
- 新字段: task_mode, error_message, runtime_seconds, package_count, success_count, error_count, progress, current_phase
- progress 规则: `status === 'completed' ? 100 : (aggregate?.progress ?? null)` — 不伪造 0

### task-importer.ts
- 调用 aggregateTaskDisc (按 task_id 单查询)
- 缓存到 Map, 避免重复
- 传给 mapRealTask

### field-mapper.ts: mapTask (mock fallback)
- 新字段默认 null

### tasks-ingest.ts: mapTaskForIngest (legacy)
- 新字段默认 null

### upsert.ts: upsertTasksInTransaction
- SQL INSERT 加 8 列
- ON CONFLICT UPDATE 加 8 列
- 参数加 8 个

---

## 五、Package 是否变更

**否**。本 Sprint 字段补全只走 CLI import (任务相关所有表都在 ALLOWED_PACKAGE_TABLES 中, 但补全字段来自 tbl_task 和 tbl_disc 聚合, 站点推包时**站点可自行聚合**后通过 tbl_task records 推送)。

不增加新 package 白名单。tbl_interface_task / tbl_task_certif_status **仍不加入** package (源表不在 source_restore)。

## 六、API 返回字段

| 字段 | 类型 | 来源 | 测试结果 |
|---|---|---|---|
| `progress` | number \| null | completed=100, else aggregate.progress | ✅ 真实值 100 |
| `runtime` | number \| null | update_dt - create_dt 秒 | ✅ 864, 331, 147, etc |
| `packageCount` | number \| null | tbl_disc count | ✅ 1, 2, 3, 6 |
| `successCount` | number \| null | SUM(burn_success) | ✅ 同上 |
| `errorCount` | number \| null | SUM(error_files) | ✅ 0 (无错误) |
| `currentPhase` | string \| null | MAX(stage) | ✅ "2" |
| `taskMode` | number \| null | tbl_task.task_mode | ✅ 0 (默认顺序) |
| `errorMessage` | string \| null | tbl_task.ret_msg | ✅ "0" (无错误) |

**测试 (SH01 source_id=28)**: pkg=6, ok=6, err=0, progress=100, phase=2, runtime=331s, mode=0, errMsg=0

**无数据时**: 全部 null (e.g. TEST_CLEAN 没有 create_dt/update_dt, runtime=null)

## 七、前端展示变化

**零代码变更**。Tasks 页面 MiniStat (line 537-543) 已用 `selected.packageCount/successCount/errorCount`, 显示 `—` 当 null. progress 用 `selected.progress > 0 ? '${progress}%' : '—'`. 新增字段 (taskMode/runtime/currentPhase) 是 DTO 扩展, 现有页面**不主动展示**, 但 DTO 包含, 后续 Sprint 可选择性显示.

## 八、仍无法实现字段 (继续显示 `—`)

| 字段 | 原因 |
|---|---|
| `volumeId` | tbl_task 字段不存在, 在 tbl_task_items/tbl_task_folder (新表) |
| `sm3Status` | tbl_task_certif_status 不在 source_restore |
| `speed` | 源 schema 无持久化, 不可伪造 |
| `remainingTime` | 无计算依据, 不可伪造 |
| `currentFile` | 无源数据 |
| `recentLogs` | 无源数据 |
| `backupScope` | 源表无此字段 (用 task_type 推断是后续 Sprint) |
| `packagingMode` | 复用 task_mode 字段 (DTO 不再单独定义) |
| `packagingThreads` | 源表无多线程字段 |
| `retryCount` | 源表无此字段 |

## 九、tsc/build/smoke 结果

- `pnpm exec tsc --noEmit`: exit **0** ✅
- `pnpm build`: ✅ 成功 (24 路由)
- `pnpm smoke:sync`: success, duplicateDetected=true ✅
- `pnpm import:file-index` (无参): exit 1 guard 仍拒绝 ✅
- `pnpm import:tasks SH01`: 37 rows upserted, 11 tasks with disc aggregate ✅

## 十、固定统计

```
Sprint 2F.1 完成统计
=====================
本次新增统一表字段: 8 个 (task_mode/error_message/runtime_seconds/
                       package_count/success_count/error_count/progress/current_phase)
本次新增源表接入: 0 (复用已有 tbl_task + tbl_disc)
本次新增 API: 0 (扩展 /api/tasks)
本次新增前端页面: 0
本次影响 package: 否 (复用 ALLOWED_PACKAGE_TABLES, 不增加新表)
本次不伪造: speed/remainingTime/currentFile/recentLogs/sm3Status
本次影响登录: 否
本次影响 file-index: 否
```

## 十一、git status

- 已 commit, 已 push (见最终报告)
