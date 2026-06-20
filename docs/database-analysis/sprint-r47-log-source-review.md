# Sprint R.47 — Log Collection Closure

> Requirement IDs: `REQ-5.1.1`, `REQ-5.1.3`, `REQ-6.4.1`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-5.1.1 | 站点任务日志采集与展示 | partial |
| REQ-5.1.3 | 日志分类与检索 | partial |
| REQ-6.4.1 | 可配置日志级别 | blocked_by_source_schema |

## B. 前端变更清单

| 项 | 内容 |
|---|---|
| 新增页面/组件 | 无 (API-only) |
| 真实后端能力 | `GET /api/logs/source` — 读取 `tbl_sys_log` (85 行) + `tbl_task` (37 行) |
| simulator/DRY_RUN | 无 |

## C. API 变更清单

| API | 方法 | 说明 |
|---|---|---|
| `/api/logs/source` | GET | 从 star_storage_db 读取真实日志 |

## D. 数据库变更清单

无新增表。读取现有 `tbl_sys_log`, `tbl_task`。

## E. 源端数据证据

| 字段 | 来源 | 有数据 |
|---|---|---|
| taskId | tbl_task.id | ✅ 37 行 |
| taskType | tbl_task.task_type (0=备份, 1=恢复) | ✅ |
| result | tbl_task.status (7=成功, 2=取消) | ✅ |
| operator | tbl_sys_log.user_id | ⚠️ tbl_sys_log 有, tbl_task 无 |
| occurredAt | tbl_task.update_dt | ✅ |
| deviceId | tbl_device_device | ❌ 0 行 |
| discNo | — | ❌ 不在 tbl_task |
| fileList | tbl_file join | ❌ 需要额外 join |
| errorCode | tbl_task.burn_status | ⚠️ 仅数字码 |
| errorMessage | — | ❌ 无文本错误信息 |

## F. 缺失字段 (blocked_by_source_schema)

| 缺失字段 | 影响 | 站点 schema 变更建议 |
|---|---|---|
| device_id | REQ-5.1.1 设备关联 | `tbl_device_device` 需有数据 |
| disc_no | REQ-5.1.1 光盘关联 | 需 `tbl_task` 加 `disc_no` 或 join `tbl_disc` |
| file_list | REQ-5.1.1 文件列表 | 需 join `tbl_file` (40K+ 行, 性能考量) |
| error_message | REQ-5.1.3 错误详情 | 需站点记录文本错误信息 |

## G. mock/simulator/DRY_RUN 标记

无。全部读取真实 source_restore_db 数据。

## H. Verdict

**partial** — 有真实日志数据 (122 行), 但缺少设备/光盘/文件/错误详情字段。

---

Commit: `feat(r47): site-native log source adapter [REQ-5.1.1]`
