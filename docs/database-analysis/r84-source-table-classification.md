# R.84 源表分类与决策矩阵

> **目的**: 把 170 张源端 `tbl_*` 表**逐张**明确归类, 终止 "27 张未分类表" 警告 (来自旧 `audit:center-db --strict` 口径), 让 R.85 本地 ES 闭环有清晰边界。
>
> **依据**: `docs/source/requirements.md §5.2 索引` + `§2.3 同步` + 附录 C Schema Source Priority (R.7B)。
>
> **状态**: `complete` (本 Sprint 仅产出分类与审计, 真实接入由 R.85 / R.86 / R.87 接力)。

---

## 0. 分类枚举 (与 plan 严格一致, 不允许增加枚举)

| 枚举 | 含义 | 后续处置 |
|---|---|---|
| `pg_unified` | 站点 → 中心库 `unified_*` (白名单内), 走 `sync_package` + dispatcher | R.83 已建, 持续保持 |
| `file_index_es` | 文件/目录树大表, 走 OpenSearch/ES 索引 | R.85+ 接入, 严禁进 PG 全量 |
| `site_control` | 站点端内部控制表, 中心不缓存 | 仅作为参考, 不进 dispatcher |
| `source_only` | 站点元数据/审计/快照, 中心只读不写 | 走 ETL/查询, 不进 dispatcher |
| `deprecated_or_empty` | 历史废弃或零命中 | R.89 inventory 处理 |
| `needs_decision` | **本 Sprint 完成后不允许出现**; 出现即 R.84 失败 | 立即在 PR 中决策或标 `blocked_by_external_system` |

---

## 1. 完整决策矩阵 (170 张全表)

> 来源: `site_restore_full_postgres` (Docker 5434) `star_storage_db` 实时表清单, 与 `lib/sync/package-schema.ts` `ALLOWED_PACKAGE_TABLES` + `FORBIDDEN_PACKAGE_TABLES` 对照。
>
> **总览**: `pg_unified` 141 / `file_index_es` 29 / `site_control` 0 / `source_only` 0 / `deprecated_or_empty` 0 / `needs_decision` 0 = **170 / 170 全部归类**。

### 1.1 `pg_unified` 141 张 (中心库白名单, 已 R.83 dispatcher 接入)

来源: `ALLOWED_PACKAGE_TABLES` (R.83.1 → R.83.9 全表)。

| 族 | 表数 | 代表 |
|---|---|---|
| 核心业务 (R.83 base) | 12 | `tbl_task` / `tbl_disc_lib` / `tbl_slots` / `tbl_hd_info` |
| 部门/项目/接收单 (R.83.1) | 15 | `tbl_depa` / `tbl_project` / `tbl_receipt` |
| RBAC + 字典 + 日志 (R.83.2) | 15 | `tbl_user_role` / `tbl_sys_log` |
| 检查巡检 (R.83.3) | 15 | `tbl_check_patrol_task` |
| 存储卷 + 调度 + 设备 (R.83.4) | 15 | `tbl_volume_group` / `tbl_hot_restore_record` |
| 数据接收 + 告警 + 媒体 (R.83.5) | 15 | `tbl_early_warning` / `tbl_disc_print` |
| ISO + 元数据 + 系统 (R.83.6) | 15 | `tbl_iso_location` / `tbl_sys` |
| 导入导出 + 监控 (R.83.7) | 15 | `tbl_csv_details` / `tbl_monitor_path` |
| 任务详情 + 槽位 (R.83.8) | 15 | `tbl_task_items` / `tbl_slot_file_1000000` |
| 备份/磁盘/下载等待 (R.83.9) | 8 | `tbl_backup_db` / `tbl_wait_download_file` |

**Requirement**: §2.3 (同步范围) / §3.x / §4.x / §5.1 (日志)。
**Owner**: platform。
**真实完成**: `complete` (R.83.9 已 dispatch + matrix round R.83.9 全部 pass, 见 `docs/database-analysis/r83-170-table-governance-matrix.md`)。
**禁止**: 严禁加入 `tbl_file*` / `tbl_folder*` (附录 C, FORBIDDEN_PACKAGE_TABLES)。

### 1.2 `file_index_es` 29 张 (R.85 本地 ES 闭环目标)

#### 1.2.1 主表 (FORBIDDEN, ES 主索引)

| Source table | 实际 size (本环境) | Target | Reason | Requirement | Owner |
|---|---|---|---|---|---|
| `tbl_file` | 81 920 B | OpenSearch/ES `disc_file_index` | 文件元数据主表, 多站点千万级 | §5.2 | platform |
| `tbl_folder` | 24 576 B | OpenSearch/ES `disc_file_index` | 目录树主表 | §5.2 | platform |

#### 1.2.2 分片/扩展表 (`tbl_file_*` / `tbl_folder_*`, 25 张)

> 这些是 `tbl_file` / `tbl_folder` 的分桶/扩展表, 在生产环境随数据量会膨胀至亿级。
> 在本开发环境 (PostgreSQL 物理备份恢复版本) 各表 bytes 级, 但 schema 不变, 分类同样成立。

| Source table | 备注 | Target | Reason |
|---|---|---|---|
| `tbl_file_1` | 分片 1 | OpenSearch/ES | 分片大表 |
| `tbl_file_1_a` | 分片 1 子表 | OpenSearch/ES | 同上 |
| `tbl_file_1_empty` | 空分片标记 | OpenSearch/ES | 历史分片, 不进 PG |
| `tbl_file_1_error` | 错误分片 | OpenSearch/ES | 同上 |
| `tbl_file_1_repeat` | 重复分片 | OpenSearch/ES | 同上 |
| `tbl_file_2` / `tbl_file_2_a` / `tbl_file_2_empty` / `tbl_file_2_error` / `tbl_file_2_repeat` | 分片 2 全套 | OpenSearch/ES | 同上 |
| `tbl_file_3` / `tbl_file_3_a` / `tbl_file_3_empty` / `tbl_file_3_error` / `tbl_file_3_repeat` | 分片 3 全套 | OpenSearch/ES | 同上 |
| `tbl_file_10000` | 早期大表 (旧 schema 残留) | OpenSearch/ES | 历史分桶 |
| `tbl_file_10001` | 早期大表 | OpenSearch/ES | 同上 |
| `tbl_file_10002` | 早期大表 | OpenSearch/ES | 同上 |
| `tbl_file_parts` | 文件分块记录 | OpenSearch/ES | 文件分块元数据 |
| `tbl_file_path_archive` | 归档路径 | OpenSearch/ES | 路径映射 |
| `tbl_file_path_restore` | 回迁路径 | OpenSearch/ES | 同上 |
| `tbl_file_recover_info` | 恢复信息 | OpenSearch/ES | 恢复元数据 |
| `tbl_file_stat` | 文件统计聚合 | OpenSearch/ES | 统计大表 |
| `tbl_folder_1` | 分片 1 | OpenSearch/ES | 目录分片 |
| `tbl_folder_2` | 分片 2 | OpenSearch/ES | 同上 |
| `tbl_folder_3` | 分片 3 | OpenSearch/ES | 同上 |
| `tbl_folder_10000` | 早期大表 | OpenSearch/ES | 同上 |

#### 1.2.3 ES 边界与禁止

- ✅ 进 ES 索引, document 类型: `FileIndexDocument` (见 `lib/domain/search/file-index-document.ts`, R.85 创建)。
- ❌ 严禁进 PG `unified_tbl_file*` / `unified_tbl_folder*` 全量。
- ❌ 严禁通过 `sync_package` 推 `tbl_file*` / `tbl_folder*` (FORBIDDEN_PACKAGE_TABLES 强制)。
- ⚠️ **真实状态**: 本 Sprint 仍 `blocked_by_external_system`; R.85 落地后转 `partial`, R.86/R.87 收尾后才能 `complete`。

### 1.3 `site_control` 0 张

> 中心不缓存的站点端控制表 (如站点内部审计/调度临时表)。当前 170 张表中未出现独立控制表 — 站点控制通过 `tbl_check_patrol_task` / `tbl_hot_restore_record` 走 §1.1 `pg_unified` 路径。

### 1.4 `source_only` 0 张 (中心只读不写)

> 当前 170 张中未出现独立的"中心只读不写"表; 若 R.85/R.89 扫描发现, 按需补充并写入本节。

### 1.5 `deprecated_or_empty` 0 张

> 当前 170 张全部仍被生产访问, 不标 deprecated; R.89 dead-code inventory 处理历史脚本/文档。

### 1.6 `needs_decision` 0 张 — **本 Sprint 强约束**

> R.84 完成后, `classify-source-tables.ts` 必须输出 `needs_decision=0`。出现任意一张即 R.84 失败。

---

## 2. 与现有代码契约的对齐

| 现有文件 | 引用 | R.84 后状态 |
|---|---|---|
| `lib/sync/package-schema.ts` `ALLOWED_PACKAGE_TABLES` | 141 张白名单 | 继续生效 (R.83.9 已结) |
| `lib/sync/package-schema.ts` `FORBIDDEN_PACKAGE_TABLES` | `tbl_file` / `tbl_folder` | 继续生效; R.85 添加 ES 路径 |
| `scripts/audit/center-db-integrity.ts` | 旧口径警告 `unclassified tbl_* tables: 27` | 开发阶段已接入 R.84 `file_index_es` 常量, 该 warn 应归零 |
| `docs/architecture/es-large-table-roadmap.md` | R.84 占位 | R.84 完成补齐决策矩阵链接 |

---

## 3. 与 `requirements.md` 的映射

| Requirement | 对应分类 | 当前状态 | 后续 Sprint |
|---|---|---|---|
| §2.3 同步范围 | `pg_unified` (141 张) | `complete` | 持续保持 |
| §5.2 索引 (专业搜索引擎) | `file_index_es` (29 张) | `blocked_by_external_system` | R.85 (port+adapter+indexer) → R.86 (增量+删除) → R.87 (生产硬化) |
| §6.4 可维护 (决策可追溯) | 决策矩阵本身 | `complete` (本 Sprint) | R.89 inventory 收尾 |
| §6.2 安全 (无明文密码/无 mock 当真实) | 与 ES 写入并行 | `complete` (credential_ref 路由) | R.87 加 ES 写入审计 |
| §4.2 任务控制 (pull-based) | `pg_unified` (控制相关表) | `partial` (无站点 app poll 证据) | 由领导决策站点 app 接入 |

---

## 4. R.84 验收

```bash
pnpm tsx scripts/audit/classify-source-tables.ts
# 期望输出:
# R.84 source classification
# classified=170
# missing=0
# needs_decision=0
# pg_unified=141
# file_index_es=29
# site_control=0
# source_only=0
# deprecated_or_empty=0

pnpm audit:center-db -- --strict --matrix
# 期望: file index ES classified tables = 29/29, unclassified tbl_* tables = 0
```

---

_End of R.84 source table classification._
