# Sprint R.7A — 一致性差异修复 + 控制真执行 Post-Review

> **日期**: 2026-06-10
> **范围**: 不新增功能/页面/表，只修/查真实性问题
> **状态**: ✅ 完成

---

## 0. TL;DR

| 维度 | 结论 |
|---|---|
| 3 个一致性异常 | **全部历史测试数据污染，非 bug** |
| status=20 真控制 | **降级为"数据库字段写入可行，真实执行未证实"** |
| requirements 完成率 | **15.6% 不变** |

---

## 1. 一致性差异分析

### 1.1 tbl_task (src=37, unified SH01=44, diff=+7)

| 维度 | 值 |
|---|---|
| source count | 37 (id 1-37) |
| unified SH01 count | 44 |
| extra source_id | `100, 101, 200, 300, 8888, TASK_2026_001, TASK_2026_002` |
| missing source_id | 0 |
| 产生原因 | **历史测试数据** — 这些 ID 不在 source tbl_task 中，是测试过程中写入 unified_tasks 的 MOCK/测试数据 |
| 是否 bug | **否** — 非同步逻辑错误 |
| 是否修复 | **不修** — 标记为 `accepted_difference` |
| 清理方案 | `DELETE FROM unified_tasks WHERE source_site_id='SH01' AND source_id IN ('100','101','200','300','8888','TASK_2026_001','TASK_2026_002');` (需领导确认) |

### 1.2 tbl_disc_lib (src=4, unified SH01=8, diff=+4)

| 维度 | 值 |
|---|---|
| source count | 4 (lib_id 1-4) |
| unified SH01 count | 8 |
| extra source_id | `5001, 5002, DEV_001, DEV_002` |
| missing source_id | 0 |
| 产生原因 | **历史测试数据** — DEV_001/002 是 Sprint 测试写入 |
| 是否 bug | **否** |
| 清理方案 | `DELETE FROM unified_devices WHERE source_site_id='SH01' AND source_id IN ('5001','5002','DEV_001','DEV_002');` |

### 1.3 tbl_logical_volume (src=3, unified SH01=5, diff=+2)

| 维度 | 值 |
|---|---|
| source count | 3 (volume_id 1-3) |
| unified SH01 count | 5 |
| extra source_id | `VOL_001, VOL_002` |
| missing source_id | 0 |
| 产生原因 | **历史测试数据** |
| 是否 bug | **否** |
| 清理方案 | `DELETE FROM unified_volumes WHERE source_site_id='SH01' AND source_id IN ('VOL_001','VOL_002');` |

### 1.4 其余 4 表 (完全一致)

| 表 | src | unified | diff |
|---|---|---|---|
| tbl_magzines → unified_magazines | 6 | 6 | 0 ✅ |
| tbl_slots → unified_slots | 396 | 396 | 0 ✅ |
| tbl_hd_info → unified_hard_disks | 8 | 8 | 0 ✅ |
| tbl_disc → unified_disc_media | 65 | 65 | 0 ✅ |

---

## 2. 控制真执行 Post-Review

### 2.1 status=20 证据链

| # | 问题 | 答案 |
|---|---|---|
| 1 | status=20 的证据来自哪里? | `real-field-mapper.ts` TASK_STATUS_0_2_3[20] = 'paused' — **我们项目自己定义的映射** |
| 2 | tbl_task.status 是否文档化支持 20? | **否** — 站点库没有文档说明 status=20 = paused |
| 3 | 站点程序是否会读取 status=20 并暂停? | **无证据** — 我们没有站点应用代码 |
| 4 | task_resume/reset 是否有对应真实语义? | **status=0** = burn_success, **status=1** = data_preparing — 同样是我们定义，不是站点文档 |
| 5 | 改 source_restore 是否只是测试库修改? | **是** — 改的是 star_storage_db (5434 测试恢复库)，不是生产库 |
| 6 | 是否存在误导性"真控制可行"说法? | **是** — 需要降级 |

### 2.2 降级

**原说法**: "暂停/恢复/重置真控制可行"

**修正**: "数据库字段写入可行 (status=20/0/1)，但真实执行未证实 — 无站点程序消费 evidence"

**原因**:
- executor 连站点库改 `status` 字段 ✅ 可行
- 但**站点程序是否读 status=20 并暂停** ❌ 无证据
- Sprint 4.8 设计文档: "不假设站点有 paused 字段" + "站点没回写 success 之前 task 状态保持原样"
- 改的是测试库，不是生产

### 2.3 影响

| 文档 | 修改 |
|---|---|
| PROJECT_STATUS.md | "真控制可行" → "数据库字段写入可行，真实执行未证实" |
| ROADMAP.md | 同上 |
| requirements-traceability.md | 任务控制 6 原子状态不变 (仍 partial) |
| R.3 修复记忆 | 已更新 |

---

## 3. requirements 完成率

**15.6% 不变** — R.7A 不改任何需求状态。

---

## 4. 真实性结论

| 维度 | R.7A 前 | R.7A 后 |
|---|---|---|
| 一致性差异 | 4 匹配 / 3 异常 (原因不明) | 4 匹配 / 3 异常 (**历史测试数据，非 bug**) |
| 暂停/恢复/重置 | "真控制可行" | **降级**: "数据库字段写入可行，真实执行未证实" |
| 巡检/恢复任务 | "需站点配合" | 不变 |
| 优先恢复 | "需 priority 字段" | 不变 |
| requirements 完成率 | 15.6% | 15.6% (不变) |

---

## 5. 约束自检

- ✅ 不新增功能
- ✅ 不新增页面
- ✅ 不新增表
- ✅ 不修改现有同步/控制协议
- ✅ 只修/查真实性问题
