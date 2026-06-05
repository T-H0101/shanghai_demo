# Sprint 2C.15 — tbl_file / tbl_folder 大表同步策略校准与数据画像审查

> **日期**: 2026-06-05
> **范围**: 只做审查和方案，不写正式 import 代码
> **结论**: 暂不导入 `tbl_file` / `tbl_folder`，下一 Sprint 优先做任务详情 API，复用已有小表和中心表。

---

## 一、同步原则校准

### 1.1 小表全量同步原则

小表和关键业务关系表可以进入 PG17 中心库：

- 同步方式：snapshot + UPSERT。
- 幂等键：`UNIQUE(source_site_id, source_table, source_id)`。
- 数据保护：UPDATE 使用 `COALESCE` 保护旧记录。
- 原始字段：可放入 `raw_data JSONB` 追溯。
- 当前已完成 10 张：`tbl_task`、`tbl_disc_lib`、`tbl_magzines`、`tbl_slots`、`tbl_hd_info`、`tbl_lib_task`、`tbl_disc`、`tbl_logical_volume`、`tbl_volume_slot`、`tbl_user_task`。

### 1.2 大表不全量进 PG17 原则

`tbl_file` / `tbl_folder` 是文件级、目录级大表，不能按小表方式全量复制到中心 PG17。

- 不做全站点 full-copy。
- 不创建全量 `unified_files` / `unified_folders`。
- 不把大表 `raw_data` 无限制塞入 PG17。
- 中心库只保存总控需要的摘要、索引状态或任务范围内最小索引。
- 文件全文检索、全量目录树、跨站点文件搜索后续交给 ES / ClickHouse / 专用索引库。

---

## 二、当前库状态

| 检查项 | 结果 |
|--------|------|
| `source_restore` 位置 | `unified_disc_postgres` 容器中的独立数据库 |
| `source_restore` 是否有 tbl_file/tbl_folder | 否 |
| `pg_restore_test` 位置 | `pg_restore_test` 容器，数据库 `star_storage_db` |
| `pg_restore_test` 是否有 tbl_file/tbl_folder | 是 |
| 是否执行导入 | 否 |

---

## 三、tbl_folder 数据画像

### 3.1 规模

| 来源 | count |
|------|-------|
| source_restore | 表不存在 |
| pg_restore_test.star_storage_db | 0 |

### 3.2 字段结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键，自增 ID |
| name | text | 本级目录名称，非空 |
| folder_path | text | 原目录全路径 |
| disc_path | text | 光盘目录全路径 |
| s_level | integer | 目录层级 |
| parent | bigint | 父目录 ID |
| sum_files | bigint | 目录文件总大小 |
| files | integer | 本目录文件数 |
| subs | integer | 子目录数 |

### 3.3 关键判断

| 检查项 | 结果 |
|--------|------|
| 主键 | `id` |
| parent 字段 | 存在，且 pg_restore_test 有 `tbl_folder_index_parent` |
| folder_path / disc_path | 存在 |
| task_id | 不存在 |
| update_dt / create_dt | 不存在 |
| 最大目录深度 | 当前样本 0 行，无法计算 |
| 每个父目录子目录分布 | 当前样本 0 行，无法计算 |
| 是否适合全量进 PG17 | 不适合 |

判断：`tbl_folder` 没有任务直接关联字段，也没有更新时间字段；即使当前测试库为 0 行，也不能按小表模式设计，后续应按目录按需加载或外部索引处理。

---

## 四、tbl_file 数据画像

### 4.1 规模

| 来源 | count |
|------|-------|
| source_restore | 表不存在 |
| pg_restore_test.star_storage_db | 4 |

当前 `pg_restore_test` 样本很小，不代表生产规模；既有架构文档仍按千万到亿级大表处理。

### 4.2 字段结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键，自增 ID |
| uuid | text | 文件字符 ID |
| folder_id | bigint | 文件目录 ID，非空 |
| file_name | text | 文件名 |
| file_remark | text | 文件别名 |
| file_disc_name | text | 光盘内文件名 |
| file_size | bigint | 文件大小 |
| hash | text | 文件校验码 |
| hash1 | text | 第二校验/外部介质字段 |
| task_id | bigint | 回迁或迁入任务 ID |
| items_id | bigint | 任务条目 ID，非空 |
| create_date | timestamp | 文件归档时间 |
| status | smallint | 文件状态 |
| burn_times | smallint | 刻录次数 |
| slot_id | integer | 所在光盘 slot id |
| content_type | text | MIME 类型 |
| storage_class | smallint | 存储类别 |
| thumbs | smallint | 缩略图状态 |
| meta_data | text | 文件元数据 |

### 4.3 关键判断

| 检查项 | 结果 |
|--------|------|
| 主键 | `id` |
| folder_id | 存在，非空；pg_restore_test 有 `tbl_file_index_folder_id` |
| task_id | 存在；但 pg_restore_test 未建 task_id 索引 |
| slot_id | 存在；pg_restore_test 有 `tbl_file_index_slot_id` |
| file_size | 存在 |
| hash | 存在；当前样本 0 条有值 |
| create_dt / update_dt | 无；只有 `create_date` |
| 每个 task_id 文件数分布 | task_id=1 有 4 条 |
| 最大 task 文件数 | 4 |
| 每个 folder_id 文件数分布 | folder_id=2 有 4 条 |
| 总文件大小 | 492 bytes |
| 是否适合全量进 PG17 | 不适合 |

判断：`tbl_file` 有 `task_id`，适合任务级分页读取或任务级最小索引；但没有 `update_dt`，当前也缺 task_id 索引，全量导入 PG17 风险高。

---

## 五、原 2C.13 计划风险

### 5.1 可保留部分

- “任务详情聚合 API”可保留：复用 `unified_tasks`、`unified_disc_media`、`unified_devices`。
- “文件列表分页”作为后续能力可保留，但数据源应是 `source_restore` 按 task_id 分页或任务级索引，不是全量中心表。
- `COALESCE`、幂等键、source 标记、mock fallback 原则可保留。

### 5.2 违反大表原则部分

- `tbl_folder → unified_folders` 按全量中心表设计，违反“大表不全量进 PG17”。
- `tbl_file → unified_files` 按全量中心表设计，违反“大表不全量进 PG17”。
- 验证标准要求 `source_restore.tbl_file count = unified_files count`，这是 full-copy 思路。
- CLI 示例中的 `pnpm import:folders`、`pnpm import:files` 不应执行。
- 大表 `raw_data` 全量保存到 PG17 风险过高。

### 5.3 小表可全量范围

可继续按小表全量 snapshot + UPSERT：已完成的 10 张源表，以及后续 `tbl_user`、`tbl_depa`、小规模审计配置表。

### 5.4 必须改成大表策略

- `tbl_file`
- `tbl_folder`
- 后续同类：`tbl_zip_file`、`tbl_file_path_archive`、`tbl_check_files`、`tbl_sys_log`

### 5.5 命名建议

- 不建议创建 full-copy `unified_files` / `unified_folders`。
- 若后续确需 PG17 任务级索引，命名为 `unified_file_index` / `unified_folder_index` 更准确。
- 当前 Sprint 不建表；先完成策略审查。

---

## 六、任务详情第一版需要什么

### 6.1 必须字段

| 字段 | 用途 |
|------|------|
| taskNo / name / type | 基础信息 |
| status / phase / progress | 状态展示 |
| operator | 负责人 |
| deviceId / deviceName | 关联设备 |
| file_count | 文件数量摘要 |
| total_size | 总大小摘要 |
| disc_count | 光盘/介质数量 |
| recentLogs | 可继续 mock 或后续接日志 |

### 6.2 现有中心表可提供

| 数据 | 来源 |
|------|------|
| taskNo / type / status / operator / total_files / total_size | `unified_tasks` |
| deviceId | `unified_tasks.device_id` |
| deviceName | `unified_devices.device_name` |
| disc_count / 介质列表 | `unified_disc_media` |

当前中心库已有：

- `unified_tasks`: 82 条，`total_files` 合计 271309，`total_size` 合计 72196481652。
- `unified_disc_media`: 65 条，覆盖 23 个 source_task_id。
- `unified_devices`: 10 条。
- `unified_volumes`: 6 条。

### 6.3 必须从 tbl_file / tbl_folder 得到的内容

任务详情第一版没有必须依赖 `tbl_file` / `tbl_folder` 的字段。

只有“文件明细分页列表”需要 `tbl_file`；目录树才需要 `tbl_folder`。这两项可后置。

### 6.4 不用 tbl_file 是否仍可演示

可以。任务详情主信息、文件数量、总大小、设备、操作员、介质数量都能从已接入 10 张表支撑。

### 6.5 如果要文件列表

优先按 `task_id` 从源库分页读取：

```sql
SELECT id, folder_id, file_name, file_size, status, slot_id, content_type
FROM tbl_file
WHERE task_id = $1
ORDER BY id
LIMIT $2 OFFSET $3;
```

前提：源库需要 `task_id` 索引；当前 `pg_restore_test` 只有 `folder_id/items_id/slot_id` 索引，缺 `task_id` 索引，需站点侧确认。

---

## 七、三档方案

### 7.1 方案 A：不接大表，只做任务详情摘要

| 项 | 内容 |
|----|------|
| 做法 | 复用 `unified_tasks.total_files/total_size`、`unified_disc_media`、`unified_devices` |
| 优点 | 风险最低；不触碰大表；3 周 demo 最稳；不新增 schema |
| 缺点 | 暂无真实文件分页列表；目录树仍是后续能力 |
| 实现成本 | 低 |
| 3 周内是否推荐 | 推荐 |
| 是否需要领导确认 | 需要确认“任务详情第一版不展示真实文件明细列表” |

### 7.2 方案 B：任务级文件索引

| 项 | 内容 |
|----|------|
| 做法 | 只按指定 `task_id` 导入当前任务相关文件元数据，中心表命名 `unified_file_index` |
| 优点 | 支持任务详情文件分页；不做全站点全量；可控 |
| 缺点 | 仍需处理大任务的分页、水位、清理策略；依赖源库 task_id 索引 |
| 实现成本 | 中 |
| 3 周内是否推荐 | 仅在领导明确要求真实文件列表时推荐 |
| 是否需要领导确认 | 需要确认索引范围、保留周期、是否允许文件名/hash/meta_data 进中心 |

### 7.3 方案 C：外部检索方案

| 项 | 内容 |
|----|------|
| 做法 | `tbl_file/tbl_folder` 不进 PG17，后续进入 ES / ClickHouse / 专用索引库；PG17 只存 task_id、索引状态、统计摘要 |
| 优点 | 最符合长期大数据架构；检索能力强；避免 PG17 膨胀 |
| 缺点 | 当前 Sprint 不实现；需要额外基础设施和数据治理 |
| 实现成本 | 高 |
| 3 周内是否推荐 | 不推荐实现，只保留方案 |
| 是否需要领导确认 | 需要确认长期检索技术路线和资源 |

---

## 八、推荐方案

推荐先走方案 A：

1. 下一 Sprint 做 `/api/tasks/[id]` 数据库优先 + mock fallback。
2. 只使用 `unified_tasks`、`unified_disc_media`、`unified_devices`。
3. 不导入 `tbl_file` / `tbl_folder`。
4. 不创建 `unified_files` / `unified_folders`。
5. 文件列表分页作为方案 B 的后续可选项。

理由：现有 10 张表已经足够支撑任务详情主信息；大表当前不在 `source_restore`，`pg_restore_test` 样本也不代表生产规模；先完成任务详情能最快提升功能完整度。

---

## 九、需要领导确认的问题

1. 任务详情第一版是否接受“真实摘要 + 真实介质 + 暂无真实文件明细列表”。
2. 如果要文件列表，是否只按任务级分页，不做全站点检索。
3. 站点源库是否能为 `tbl_file.task_id` 增加索引。
4. 文件名、hash、meta_data 是否有敏感信息，需要脱敏或不入中心。
5. 长期文件检索是否走 ES / ClickHouse / 专用索引库。

---

## 十、后续 Sprint 建议

| 选项 | 判断 |
|------|------|
| A. 任务详情 API，不接 tbl_file，只用已有 unified_tasks + unified_disc_media | 推荐下一 Sprint |
| B. task-scoped file index 抽样方案 | 后续可选，需领导确认文件列表需求 |
| C. 站点筛选器 | 可排在任务详情之后 |
| D. Logs / Sync 页面 | 可并行排期，但不如任务详情直接补齐主链路 |
| E. Dashboard 真实统计 | 建议在任务详情稳定后做 |

下一 Sprint 推荐：A。

