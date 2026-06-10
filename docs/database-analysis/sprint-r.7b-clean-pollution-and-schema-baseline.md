# Sprint R.7B — Clean Pollution + Schema Baseline

> **日期**: 2026-06-10
> **范围**: 不新增功能/页面/表/API，只清理污染 + 纳入 schema 基线

---

## 1. disc_files.sql 解析

| 指标 | 值 |
|---|---|
| 文件 | `databases/disc_files.sql` |
| 大小 | 154KB, 2842 行 |
| CREATE TABLE | 147 |
| 与 star_storage_db 对比 | 核心表 100% 覆盖，star 多 29 张分区表 |
| 与 source_restore 对比 | 13 表全部在 disc_files.sql 中 |
| 关键控制表 | tbl_check_patrol_task, tbl_hot_restore_record, tbl_data_receive_list 等 11 张 |

## 2. 污染数据清单

| 表 | source_id | name | created_at | 判定 |
|---|---|---|---|---|
| unified_tasks | 100 | 测试任务1 (INGEST-001) | 2026-05-30 | 不在源库 |
| unified_tasks | 101 | 测试任务2 (INGEST-002) | 2026-05-30 | 不在源库 |
| unified_tasks | 200 | 修复后测试任务 (FIX-TEST-001) | 2026-05-30 | 不在源库 |
| unified_tasks | 300 | 验收测试任务 (V-TEST-001) | 2026-05-30 | 不在源库 |
| unified_tasks | 8888 | 验收测试任务 (ACCEPT-001) | 2026-05-30 | 不在源库 |
| unified_tasks | TASK_2026_001 | 2026年5月财务报表备份 | 2026-05-30 | 不在源库 |
| unified_tasks | TASK_2026_002 | 客户数据归档 | 2026-05-30 | 不在源库 |
| unified_devices | 5001 | 光盘库X (DEV-INGEST-001) | 2026-05-30 | 不在源库 |
| unified_devices | 5002 | 光盘库Y (DEV-INGEST-002) | 2026-05-30 | 不在源库 |
| unified_devices | DEV_001 | 上海光盘库设备A (DL_SH01_001) | 2026-06-09 | 不在源库 |
| unified_devices | DEV_002 | 上海硬盘阵列A (DL_SH01_002) | 2026-06-09 | 不在源库 |
| unified_volumes | VOL_001 | — | 2026-05-29 | 不在源库 |
| unified_volumes | VOL_002 | — | 2026-05-29 | 不在源库 |

**引用检查**: control_command / audit_log 中 0 引用 ✅

## 3. 清理结果

| 模式 | 结果 |
|---|---|
| dry-run | 13 行确认候选 |
| execute | 13 行删除，事务执行 |
| 验证 | 3 表清理后 0 行 ✅ |

## 4. 一致性校验

清理后 `pnpm check:sync-consistency -- SH01`:

```
状态: matched
总表数: 7
匹配: 7
异常: 0
耗时: 44ms
exit code: 0
```

**7/7 matched ✅**

## 5. CLAUDE.md 更新

新增附录 C: Schema Source Priority 5 级 + 4 项禁止。

## 6. 约束自检

- ✅ 不新增功能
- ✅ 不新增页面
- ✅ 不新增表
- ✅ 不改 requirements
- ✅ 不删 source_restore / star_storage_db 数据
- ✅ 只清理 unified_disc_platform 确认污染行
