# Sprint R.46 — 170-Table Source Schema Inventory

> Requirement IDs: `REQ-2.3.1`, `REQ-4.1.1`, `REQ-5.1.1`, `REQ-5.2.1`, `REQ-6.3.3`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-6.3.3 | 数据源 schema 覆盖验证 | complete |

## B. 产出

- `scripts/audit/source-schema-inventory.ts` — 扫描脚本
- `docs/database-analysis/source-table-inventory-r46.md` — 170 表完整清单 + 集成决策

## C. 关键发现

### 有真实数据的表 (11 张关键表)

| table | rows | 用途 |
|---|---:|---|
| tbl_task | 37 | 任务管理 |
| tbl_disc | 65 | 光盘状态 |
| tbl_file_2 | 40421 | 文件索引 |
| tbl_file_3_a | 27658 | 文件索引 |
| tbl_file_1 | 1773 | 文件索引 |
| tbl_slots | 396 | 盘位映射 |
| tbl_sys_log | 85 | 系统日志 |
| tbl_user | 3 | 用户 |
| tbl_logical_volume | 3 | 卷 |
| tbl_volume_slot | 161 | 卷-盘位映射 |
| tbl_task_items | 47 | 任务明细 |

### 完全空的表 (阻塞项)

| table | 影响需求 |
|---|---|
| tbl_depa | REQ-3.3.1 部门管理 |
| tbl_device_device | REQ-2.3.1 设备监控 |
| tbl_disc_inspect | REQ-4.2.3 巡检 |
| tbl_check_* (全部) | REQ-4.2.3 巡检 |
| tbl_user_role | REQ-3.2.1 权限同步 |

## D. 集成决策

| 需求 | 决策 | 理由 |
|---|---|---|
| REQ-5.1.1 日志 | partial | `tbl_sys_log` 有数据, 但任务级日志需 join |
| REQ-5.2.1 索引 | integrate | `tbl_file_*` 有 hash/hash1, 可直接查询 |
| REQ-4.1.1 检索 | partial | 文件+光盘维度可用, 部门维度空 |
| REQ-2.3.1 同步范围 | partial | 任务+用户可用, 设备/权限空 |
| REQ-3.1.1 账号维度 | partial | 仅 3 个用户 |
| REQ-3.3.1 部门管理 | blocked_by_source_schema | `tbl_depa` 0 行 |

## E. 是否允许 commit

**pass** — 纯文档产出, 无代码变更

---

Commit: `docs(r46): audit restore source table coverage [REQ-6.3.3]`
