# Project Status

> **截至**: 2026-06-06
> **Sprint**: 2C.18D + 2D.1 + 2D.2 + 2D.3 完成

## 已完成功能

### 中心库 (PostgreSQL 17)
- `unified_tasks` — 任务主表
- `unified_devices` — 设备主表
- `unified_volumes` — 逻辑卷主表
- `unified_disc_media` — 物理盘片
- `unified_hard_disks` — 硬盘主表
- `unified_file_index` — 任务级文件索引 (Sprint 2C.18)
- `unified_folder_index` — 任务级目录索引
- `sync_package_log` — 同步包日志
- `sync_table_log` — 同步表日志

### API
| 端点 | 数据源 | 状态 |
|---|---|---|
| `GET /api/tasks` | unified_tasks | ✅ 真实数据 |
| `GET /api/tasks/[id]` | unified_tasks | ✅ |
| `GET /api/tasks/[id]/files` | unified_file_index | ✅ (Sprint 2C.19) |
| `GET /api/racks` | unified_devices | ✅ |
| `GET /api/racks/[id]` | unified_devices | ✅ |
| `GET /api/racks/[id]/slots` | unified_slots | ✅ |
| `GET /api/volumes` | unified_logical_volumes | ✅ |
| `GET /api/sync/logs` | sync_package_log | ✅ |
| `POST /api/sync/package` | dispatch registry | ✅ (Sprint 2D.2) |

### 前端页面
- **Tasks** (`/tasks`) — 真实任务列表 + 详情 drawer + 文件索引后置
- **Racks** (`/racks`) — 设备列表
- **Volumes** (`/volumes`) — 逻辑卷列表
- **Logs** (`/logs`) — 同步日志

### 同步能力
- **小表 CLI import** — 9 张小表 + file-index
- **package endpoint** — 接收站点推送 (Sprint 2D.2 起)
- **file-index** — 任务级文件/目录索引 (taskId + watermark + limit)
- **package-log/table-log** — 全程追踪

## 已接入表 (10 张)

| 源表 | target | sync_mode | status |
|---|---|---|---|
| tbl_task | unified_tasks | full | done |
| tbl_disc_lib | unified_devices | full | done |
| tbl_magzines | (unified_devices join) | aggregate | done |
| tbl_slots | (unified_devices join) | aggregate | done |
| tbl_hd_info | unified_hard_disks | full | done |
| tbl_lib_task | (unified_tasks join) | aggregate | done |
| tbl_disc | unified_disc_media | full | done |
| tbl_logical_volume | unified_logical_volumes | full | done |
| tbl_volume_slot | (unified_volumes join) | aggregate | done |
| tbl_user_task | (unified_tasks join) | aggregate | done |
| tbl_file | unified_file_index | incremental (taskId+watermark+limit) | partial |
| tbl_folder | unified_folder_index | incremental | partial |

**累计 10 张源表 done + 2 张大表 partial (file-index)**

## 未完成

### 短期
- 多站点筛选
- 同步日志页面 UI 增强
- package 鉴权 (生产 API key / mTLS)
- package 严格 checksum (SHA-256)

### 中期
- 站点侧推送客户端 (CLI / Agent)
- P1 小表 package 化 (tbl_user / tbl_site / tbl_platform)
- 站点同步调度器 (每小时触发)

### 长期
- ES 接入 (tbl_file / tbl_folder 全文检索)
- ClickHouse 接入 (tbl_sys_log / tbl_api_log)
- 鉴权 / SSO
- 审计 / 报表 / 告警
