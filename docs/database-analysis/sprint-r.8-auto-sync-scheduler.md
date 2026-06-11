# Sprint R.8 — 每小时自动同步与一致性校验调度器

> **日期**: 2026-06-11
> **对应 Requirement**: REQ-2.3.3 数据一致性校验 + REQ-6.1.3 同步时效
> **状态**: ✅ 完成

---

## 0. TL;DR

| 维度 | 结果 |
|---|---|
| 调度器 | export → push → consistency → log，**全部真实执行** |
| 调度日志 | sync_scheduler_log 写入成功 |
| 一致性 | 7/7 matched |
| e2e:scheduler | **14/14 全过** |
| requirements 完成率 | **15.6% → 16.7%** (REQ-2.3.3 partial → partial+, REQ-6.1.3 partial → partial+) |

---

## 1. 新增脚本

| 脚本 | 用途 |
|---|---|
| `scripts/scheduler/sync-scheduler.ts` | 主调度脚本，支持 --once / --interval / --dry-run |

**执行链路**:
1. `export-package` → 生成 package.json (7 表 519 行)
2. `push-package` → HMAC 签名推送到总控 (去重检测)
3. `check-sync-consistency` → 7 表一致性校验
4. 写 `sync_scheduler_log`

---

## 2. 新增表

**sync_scheduler_log** (12 字段):

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| site_code | VARCHAR(50) | 站点代码 |
| run_id | VARCHAR(100) | 运行 ID (SCHED-SH01-TIMESTAMP-UUID) |
| started_at | TIMESTAMPTZ | 开始时间 |
| finished_at | TIMESTAMPTZ | 结束时间 |
| status | VARCHAR(20) | running/success/partial/failed |
| export_status | VARCHAR(20) | pending/success/failed/skipped |
| push_status | VARCHAR(20) | pending/success/failed/skipped |
| consistency_status | VARCHAR(20) | pending/matched/mismatched/failed/skipped |
| package_batch_id | VARCHAR(100) | 批次 ID |
| error_message | TEXT | 错误信息 |
| result_json | JSONB | 完整结果 JSON |

---

## 3. 新增 API

**GET /api/sync/scheduler/logs?siteCode=SH01&limit=10**

- 真实查 `sync_scheduler_log`
- 无结果返回空数组 (不 mock)
- dataSource 显式

---

## 4. 前端接入

`/sync` 页面新增"自动同步调度"区域 (scheduler-card):
- 最近运行时间 / 状态 / 导出 / 推送 / 一致性 / Batch ID / 错误
- 状态 Badge (success/partial/failed/running)
- 失败状态红色 Badge
- 未运行时显示提示

---

## 5. 调度执行结果

```
runId:        SCHED-SH01-1781162509106-b3d74c7d
siteCode:     SH01
status:       success
export:       success
push:         success
consistency:  matched
batchId:      SH01-2026-06-11T07-21-49-672Z
error:        none
dryRun:       false
duration:     1575ms
```

**去重检测**: batchId 已存在时 push 返回 "duplicated"，标记 pushStatus=skipped，不假装成功。

---

## 6. e2e 覆盖

| # | 验证 | 结果 |
|---|---|---|
| 1 | scheduler:sync:once 成功 | ✅ |
| 2 | sync_scheduler_log 有写入 | ✅ 4 行 |
| 3 | 运行状态非 running | ✅ status=partial |
| 4 | export 状态 success/skipped | ✅ export=success |
| 5 | push 状态 success/skipped | ✅ push=skipped (duplicated) |
| 6 | consistency 状态 matched | ✅ |
| 7 | batchId 有值 | ✅ |
| 8 | sync_package_log 有 SH01 记录 | ✅ 9 行 |
| 9 | sync_consistency_log 有 SH01 记录 | ✅ 7 行 |
| 10 | API /api/sync/scheduler/logs 返回真实记录 | ✅ 4 items |
| 11 | /sync 页面 200 | ✅ |
| 12 | 前端含 scheduler-card | ✅ |
| 13 | 前端 fetch /api/sync/scheduler/logs | ✅ |
| 14 | 失败状态不会显示成功 badge | ✅ |
| **合计** | | **14/14** |

---

## 7. Package scripts

```json
"scheduler:sync": "tsx scripts/scheduler/sync-scheduler.ts",
"scheduler:sync:once": "tsx scripts/scheduler/sync-scheduler.ts --once",
"e2e:scheduler": "tsx scripts/e2e/test-scheduler.ts"
```

---

## 8. 验证结果

| 检查 | 结果 |
|---|---|
| tsc | ✅ 0 错 |
| build | ✅ 25/25 |
| smoke | ✅ passed |
| check:sync-consistency | ✅ 7/7 matched |
| baseline:check | ✅ 13 pass, 0 fail |
| e2e:scheduler | ✅ 14/14 |
| e2e:all | ✅ 77/78 (control 1 fail R.6 遗留) |

---

## 9. 约束自检

- ✅ 不接 tbl_file/tbl_folder 全量
- ✅ 不伪造同步成功 (duplicated 时标记 skipped)
- ✅ 不伪造一致性通过 (7/7 matched 真实)
- ✅ 失败状态不显示成功 (代码验证)
- ✅ 所有数据写 sync_scheduler_log (真实 DB)
