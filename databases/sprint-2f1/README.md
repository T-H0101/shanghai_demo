# Sprint 2F.1 - Task P0 Runtime Fields

## 概述

为 `unified_tasks` 增加 8 个任务运行时/统计字段, 解决 Sprint 2E.1 任务域审查中识别的 P0 字段缺口。

## 新增字段

| 字段 | 类型 | 来源 | 备注 |
|---|---|---|---|
| `task_mode` | smallint | tbl_task.task_mode | 0:顺序, 1:并行, 2:视频合并顺序, 3:视频合并并行 |
| `error_message` | text | tbl_task.ret_msg | "0" 是常见值 (无错误) |
| `runtime_seconds` | integer | 计算: update_dt - create_dt | 秒 |
| `package_count` | integer | 派生: COUNT(tbl_disc) WHERE task_id | 关联盘片数 |
| `success_count` | integer | 派生: SUM(tbl_disc.burn_success) | 成功盘片数 |
| `error_count` | integer | 派生: SUM(tbl_disc.error_files) | 异常文件总数 |
| `progress` | integer | 源 tbl_disc.disc_progress 平均 | completed 任务 100 |
| `current_phase` | text | 源 tbl_disc.stage | 8 个状态码 |

## 不补字段 (本 Sprint 范围)

- **volumeId**: 源 tbl_task **无** volume_id 字段 (在 tbl_task_items/tbl_task_folder 中, 不在本 Sprint 范围)
- **sm3Status**: tbl_task_certif_status 不在 source_restore, 不接入
- **speed / remainingTime / currentFile / recentLogs**: 源 schema 无持久化字段, 不可伪造, 继续显示 `—`

## 部署

```bash
psql -U unified -d unified_disc_platform -f databases/sprint-2f1/unified-task-runtime-fields.sql
```

## 幂等

- 使用 `ADD COLUMN IF NOT EXISTS`, 可重复执行
- 不修改现有数据
- 不修改 sync 写入逻辑 (importer 单独补充)
