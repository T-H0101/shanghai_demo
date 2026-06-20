# Sprint R.43 Requirements Review

> REQ-5.1.1 日志采集
> 日期: 2026-06-20

## A. Requirement 对照

**REQ-5.1.1**: 采集各站点刻录/回迁任务的全量日志, 字段含任务ID/操作人/时间/设备/光盘/错误码

## B. 交付

| # | 交付 | 文件 |
|---|---|---|
| 1 | 控制命令日志 | control_command + audit_log 表已有 |
| 2 | /api/logs 查询 | 支持 control/audit 类型 + keyword/status 过滤 |
| 3 | /logs UI | 7 类日志 Tab + 任务类型过滤 |
| 4 | 同步日志 | sync_package_log + sync_table_log |

## C. 限制说明

- 当前日志来自 control_command 和 audit_log, 非站点刻录/回迁原生日志
- 站点原生日志需站点 app 采集并推送, 当前 blocked_by_site_change
- 缺文件列表/光盘编号字段 (需源端 tbl_lib_task 日志表)

## D. Verdict

**PARTIAL** ⚠️ - 框架完成, 站点原生日志采集需站点 app 配合
