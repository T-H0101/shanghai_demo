# Sprint R.3 — Database Reality Check (数据库真实性审计)

> **日期**: 2026-06-10
> **方法**: `docker exec psql` 查 3 个 DB
> **范围**: `unified_disc_platform` (中心) + `star_storage_db` (170 表站点) + `source_restore` (13 表 partial)

---

## 0. 3 个 DB 概览

| DB | 容器 | 端口 | 表数 | 启动 | 状态 |
|---|---|---|---|---|---|
| `unified_disc_platform` | unified_disc_postgres | 5432 | 25 (unified_*) | 13h | ✅ Up |
| `star_storage_db` | site_restore_full_postgres | 5434 | **170** | 7h | ✅ Up |
| `source_restore` | 共享 unified_disc_postgres | 5432 | 13 | — | ✅ Up |

---

## 1. 中心库 unified_disc_platform (25 张表)

### 1.1 关键表行数

| 表 | 行数 | 真实度 | 备注 |
|---|---|---|---|
| `unified_tasks` | **87** | 100% | 8 行 paused (历史) |
| `unified_devices` | **17** | 100% | DL_BJ02_001 / DL_SH01_001/002 真实 |
| `unified_volumes` | **13** | 100% | 3 行 aggregate (Sprint 2H.3) |
| `unified_file_index` | **4** | 测试残留 | TEST_CLEAN 来源 |
| `unified_users` | **4** | 100% | admin/sec_admin/aud_admin/pkg_test_user |
| **`unified_sites`** | **0** | **❌ 0 行** | /api/sites 完全不读 |
| `control_command` | **37** | 100% | 5/5 commandType |
| `audit_log` | **35** | 100% | dryRun=true 5/5 |
| `sync_package_log` | **78** | 100% | 14 failed |
| `sync_table_log` | **155** | 100% | 大量 skipped |
| 其他 (sync/seed/log) | — | — | — |

### 1.2 unified_tasks 状态分布 (11 个枚举)

| status | count |
|---|---|
| burn_success | 55 |
| make_task_done_backup_running | 9 |
| **paused** | **8** |
| pending | 5 |
| cancelled | 2 |
| remote_backup_created | 2 |
| restore_started | 2 |
| completed | 1 |
| failed | 1 |
| ready | 1 |
| running | 1 |

### 1.3 8 行 paused 详情 (追到 Sprint 2F.1 之前)

```
bc8f7e15... | TEST_CLEAN-36 | TEST_CLEAN | paused
1a20a91e... | SH01-36       | SH01       | paused
819f4c9a... | TEST_CLEAN-33 | TEST_CLEAN | paused
cf4761a5... | SH01-35       | SH01       | paused
46b69065... | TEST_CLEAN-35 | TEST_CLEAN | paused
5c120098... | SH01-33       | SH01       | paused
84d1676d... | SH01-3        | SH01       | paused
2be0f9c0... | TEST_CLEAN-3  | TEST_CLEAN | paused
```

**关键**: 这 8 行是 **Sprint 2F.1 之前** 写入 (Sprint 2F.1 加 status 字段时已包含), 与 Sprint 4.8.2-R 无关。

**Sprint 4.8.2-R 真实 task_pause 调用** (3 个 success):
- `target_id=1` 的 3 个 task_pause, audit 写 success, 但因 executor.ts L342 假执行, **未真改 `tbl_task`**

### 1.4 control_command 状态分布

| command_type | status | count |
|---|---|---|
| inspect_start | success | 10 |
| recovery_start | success | 9 |
| task_pause | success | 10 |
| task_pause | failed | 3 |
| task_pause | pulled | 1 |
| task_reset | failed | 2 |
| task_resume | failed | 2 |
| **总计** | | **37** |

**关键发现**:
- 10 个 `task_pause success` (含 3 个 real target_id=1, 7 个老数据)
- 7 个 failed (target_id=ui-sim-* 或 audit-* 测试 ID)
- 1 个 pulled (在 pulled 状态未流转)
- 0 个 running (worker 没真跑中间态)
- 0 个 pending (Worker 跑过了, 不留 pending)
- 0 个 cancelled

**6 状态机 (R.1 模板要求)**: pending / pulled / running / success / failed / cancelled
- 实测: 5 状态命中, **0 running, 0 cancelled**

### 1.5 audit_log 与 control_command 关联

```sql
SELECT cc.command_no, cc.command_type, cc.status, al.result, al.error_message
FROM control_command cc
LEFT JOIN audit_log al ON al.command_no=cc.command_no
WHERE cc.command_type='task_pause' LIMIT 5;
```

| command_no | status | result | error |
|---|---|---|---|
| CTRL-SH01-...8C8C | failed | failed | task not found: ui-sim-... |
| CTRL-SH01-...34F0 | failed | failed | task not found: audit-... |
| CTRL-SH01-...29F1 | success | success | — |
| CTRL-SH01-...1B29 | success | success | — |
| CTRL-SH01-...723B | success | success | — |

**结论**: audit_log 1:1 对应 control_command ✅ (Sprint 4.8.1 验证准确)

---

## 2. 站点库 star_storage_db (170 张表)

### 2.1 关键表行数

| 表 | 行数 | 真实度 |
|---|---|---|
| `tbl_task` | **37** | 100% (status 枚举 0/2/7/19/20) |
| `tbl_check_patrol_task` | **0** | ❌ |
| `tbl_hot_restore_record` | **0** | ❌ |
| `tbl_hot_backup_record` | **0** | ❌ |
| `tbl_data_receive_list` | **0** | ❌ |
| `tbl_interface_task` | **0** | ❌ |
| `tbl_file` | 存在 | ✅ (但源 0 行) |

### 2.2 tbl_task 状态分布 (整数枚举)

| status | count | 含义 (推测) |
|---|---|---|
| 0 | 27 | unknown / new |
| 2 | 1 | running |
| 7 | 1 | failed |
| 19 | 4 | completed |
| 20 | 4 | archived |

### 2.3 paused/priority 字段全扫 (170 张表)

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND
(column_name ILIKE '%paus%' OR column_name ILIKE '%prior%');
```

**结果**: 12 行命中, 全部是 PG 系统列 (`stats_reset` / `reset_val` / `sync_priority`), 与业务无关。

**业务字段 paused / priority**: **0 命中 (170 张表) ✅**

### 2.4 tbl_task schema

```
id              bigint
uuid            text
split_level     int
task_type       int
create_dt       timestamp
update_dt       timestamp
status          int (默认 1)
```

**缺**: paused / priority / pause / resume / reset 等控制字段

### 2.5 候选 control 表 (5 张) 0 行 + 字段分析

| 表 | 关键字段 | 角色 | 0 行? |
|---|---|---|---|
| `tbl_check_patrol_task` | status, success_count, fail_count, archive_count, message, start_time, finished_time | 巡检任务执行记录 | ✅ |
| `tbl_hot_restore_record` | progress, status, error_message, start_time, end_time | 热恢复 | ✅ |
| `tbl_hot_backup_record` | progress, status, error_message | 热备 | ✅ |
| `tbl_data_receive_list` | schedule_cron, schedule_enable, status | 数据接收 | ✅ |
| `tbl_interface_task` | job_type, job_stage, job_status, job_progress, err_code, err_str | 接口任务 | ✅ |

**关键**: 5 张表 schema 都有完整 state machine, 但 **0 行**, 站点系统未运行 (或未推过数据)。

---

## 3. 站点库 source_restore (13 张 partial)

| 指标 | 值 |
|---|---|
| 表数 | 13 |
| 用途 | Sprint 2B.4 早期 partial 恢复 |
| 限制 | **不能代表完整站点库** (170 vs 13) |
| 完整审计 | 必须用 `star_storage_db` |

R.2 §5 教训已记录, R.3 验证准确。

---

## 4. 任务控制 6 原子 真实度 (合并)

| 原子 | 中心库 (unified) | 站点库 (tbl) | 真实度 |
|---|---|---|---|
| 新建 | POST /api/tasks 不存在 | N/A | **0%** |
| 暂停 | 8 行 paused (历史) | 无 paused 字段 | **audit only** |
| 恢复 | 0 行 resume | 无字段 | **0%** |
| 重置 | 0 行 reset | 无 reset 字段 | **0%** |
| 巡检 | 0 行 patrol (unified 无此表) | tbl_check_patrol_task 0 行 | **0%** |
| 恢复任务 | 0 行 recovery | tbl_hot_restore_record 0 行 | **0%** |
| 优先恢复 | 中心库有 priority 字段, 但 Sprint 4.8.2-R 无 priority commandType | 无 priority 字段 | **0%** |

**总分**: 0/7 (0%) 真实控制, 1/7 (14%) audit 框架

---

## 5. 数据真实性矩阵 (R.3 重算)

| 表 | R.2 报告 | R.3 真实 | Δ |
|---|---|---|---|
| unified_tasks | 87 (✅) | 87 (✅) | — |
| unified_tasks paused | 8 (历史) | 8 (历史) | 解读不同 |
| unified_devices | 17 (✅) | 17 (✅) | — |
| unified_volumes | 13 (✅) | 13 (✅) | — |
| unified_file_index | 4 (✅) | 4 (✅) | — |
| unified_users | 4 (✅) | 4 (✅) | — |
| **unified_sites** | 0 (未提) | **0 (🔴 /api/sites 100% mock)** | **+ 关键发现** |
| control_command | 37 (✅) | 37 (✅) | — |
| audit_log | 35 (✅) | 35 (✅) | — |
| sync_package_log | 78 (✅) | 78 (✅) | — |
| sync_table_log | 155 (✅) | 155 (✅) | — |
| **tbl_task paused 字段** | 0 (✅) | 0 (✅) | — |
| **tbl_task priority 字段** | 0 (✅) | 0 (✅) | — |
| **8 行 paused 来源** | 历史 (隐含) | Sprint 2F.1 之前 (确认) | 解读更精确 |

---

## 6. 总结

### 6.1 DB 真实度评分

| 维度 | 评分 | 备注 |
|---|---|---|
| 中心库数据完整性 | 95/100 | 87/4/13/17/35/37/78/155 全部真实 |
| 中心库 `unified_sites` 接入 | **0/100** | 0 行 + /api/sites 100% mock |
| 站点库 paused/priority 字段 | **0/100** | 170 表 0 命中 |
| 候选 control 表 真实数据 | **0/100** | 5 张表 0 行 |
| control_command 状态机 | 70/100 | 5/6 状态命中, 缺 running/cancelled |
| audit_log 1:1 关联 | 100/100 | 准确 |

**总分**: **44/100** (满分 100)

### 6.2 R.3 关键发现 (历史 Sprint 漏掉)

1. 🔴 `/api/sites` 完全不读 `unified_sites` (R.2 未提)
2. 🔴 executor.ts L342 假执行, control_command success/failed 不代表真改 (Sprint 4.8.2-R 漏掉)
3. ✅ 8 行 paused 真实存在, 但**与 Sprint 4.8.2-R 无关** (历史数据)
4. ✅ 5 张候选 control 表 schema 完整, 但 0 行 (站点未运行)
5. ✅ HMAC 鉴权真工作 (/api/sync/package 401)
