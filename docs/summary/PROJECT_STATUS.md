# Project Status

> **截至**: 2026-06-07
> **Sprint**: 2H.2 完成 (Dispatcher 真实落库覆盖率 38.5% → 61.5%)

## 已完成功能

### 中心库 (PostgreSQL 17)
- `unified_tasks` — 任务主表
- `unified_devices` — 设备主表
- `unified_volumes` — 逻辑卷主表
- `unified_disc_media` — 物理盘片
- `unified_hard_disks` — 硬盘主表
- `unified_slots` — 盘位明细中心表（当前仅 1 条 package 测试记录）
- `unified_file_index` — 任务级文件索引 (Sprint 2C.18)
- `unified_folder_index` — 任务级目录索引
- `sync_package_log` — 同步包日志
- `sync_table_log` — 同步表日志

### API
| 端点 | 数据源 | 状态 |
|---|---|---|
| `GET /api/tasks` | unified_tasks | ✅ 真实数据 (含 Sprint 2F.1 runtime/progress 等 8 字段) |
| `GET /api/tasks/[id]` | unified_tasks | ✅ |
| `GET /api/tasks/[id]/files` | unified_file_index | ✅ (Sprint 2C.19) |
| `GET /api/racks` | unified_devices | ✅ |
| `GET /api/racks/[id]` | unified_devices | ✅ |
| `GET /api/racks/[id]/slots` | unified_slots | ✅ 真实中心库；无明细返回 empty |
| `GET /api/volumes` | unified_logical_volumes | ✅ |
| `GET /api/sync/logs` | sync_package_log | ✅ |
| `GET /api/sync/packages` | sync_package_log | ✅ (Sprint 2D.4) |
| `POST /api/sync/package` | dispatch registry | ✅ (Sprint 2D.2, HMAC Sprint 2G.1) |
| `GET /api/dashboard/summary` | unified_* + sync_package_log | ✅ (Sprint 2G.2) |
| `GET /api/dashboard/recent-syncs` | sync_package_log | ✅ (Sprint 2G.2) |

### 前端页面
- **Tasks** (`/tasks`) — 真实任务列表 + 详情 drawer + 文件索引后置
  - Sprint 2F.3 收口: 数据源徽章 (DB / MOCK) + 实时运行字段空态 (speed/remainingTime → "暂无实时数据")
  - 进度展示: null/0 → "—", completed → "100%"
  - 运行耗时格式化: 28s / 5m31s / 1h12m
  - 计数字段保留 0 (真实 0 区别于 null)
  - 错误信息过滤 "0" 占位符
  - 多线程封包/重试次数/数据分类 在 API 模式统一空态 (mock 模式保留)
- **Racks** (`/racks`) — 设备列表
- **Sync Center** (`/sync`) — package/table 同步日志
- `/volumes` 页面尚未实现，当前仅有真实 `/api/volumes`

### 同步能力
- **小表 CLI import** — 9 张小表 + file-index
- **package endpoint** — 接收站点推送 (Sprint 2D.2 起)
- **file-index** — 任务级文件/目录索引 (taskId + watermark + limit)
- **package-log/table-log** — 全程追踪
- **Sprint 2F.4 全局 siteCode 筛选** — Header 站点选择器, Tasks/Racks/Sync Center 自动联动, localStorage 记忆 + URL 同步, 支持 All Sites 视角
- **Sprint 2G.1 /api/sync/package HMAC 鉴权** — 写入入口强制 HMAC-SHA256, 5 分钟时间窗, rawBody 优先签名, `crypto.timingSafeEqual` 防侧信道, strict/dev 双模式
- **Sprint 2G.2 Dashboard 真实总览** — 6 项总览 tile (任务/设备/卷/用户/包/最后同步) + 最近 10 条同步记录, 跟随全局 siteCode, 7/7 SQL 对账匹配, mock 模式自动隐藏
- **Sprint 2G.3 任务域盘点** — 13 张 tbl_* 中只有 3 张任务表 (task/lib_task/user_task), 7 张"假定存在"表全部不存在, runtime 推算为 P0 唯一可补
- **Sprint 2H.1 站点 Package Exporter 模拟器** — `pnpm export:package` / `push:package` / `export-and-push`, 7 张表端到端签名推送
- **Sprint 2H.1R Dispatcher 覆盖率审计** — 13 张白名单 5/5/3 (A/C/D), 3 张 D 类 (magzines/slots/logical_volume) 字段名错配
- **Sprint 2H.2 Dispatcher 真实落库修复** — 3 张 D 类全部修成 A 类, sourceIdField/列映射修正, inlineUpsert 统计口径修正 (failed/partial/skipped 真实反映), 真实可用率 38.5% → 61.5%

## 已接入表 (13 张)

| 源表 | target | sync_mode | status |
|---|---|---|---|
| tbl_task | unified_tasks | full | done |
| tbl_disc_lib | unified_devices | full | done |
| tbl_magzines | (unified_devices join) | aggregate | done |
| tbl_slots | unified_devices 汇总 + unified_slots 明细 | full/aggregate | partial：汇总完成，明细待站点真实 package |
| tbl_hd_info | unified_hard_disks | full | done |
| tbl_lib_task | (unified_tasks join) | aggregate | done |
| tbl_disc | unified_disc_media | full | done |
| tbl_logical_volume | unified_logical_volumes | full | done |
| tbl_volume_slot | (unified_volumes join) | aggregate | done |
| tbl_user_task | (unified_tasks join) | aggregate | done |
| tbl_user | unified_users | full | done (Sprint 2E.2) |
| tbl_site | unified_sites | full | done (Sprint 2E.2) |
| tbl_platform | unified_platforms | full | done (Sprint 2E.2) |
| tbl_file | unified_file_index | incremental (taskId+watermark+limit) | partial |
| tbl_folder | unified_folder_index | incremental | partial |

**累计 13 张源表 done + 2 张大表 partial (file-index)**

## 未完成

### 短期
- 让站点按真实 `tbl_slots` 字段推送盘位明细，并修正 package mapper
- 补充任务实时进度、速度、剩余时间的站点数据源
- 多站点筛选
- 同步日志页面 UI 增强
- package 鉴权 (生产 API key / mTLS)
- package 严格 checksum (SHA-256)

## Sprint 2D.6 结论

- Racks 盘位格子不再根据 `totalSlots` 推断为空闲。
- API mode 仅显示 `unified_slots` 已同步明细；没有明细时显示空态并保留汇总。
- Tasks 的非完成任务没有可靠实时进度来源，继续显示 `—`，不做自动增长。
- `speed`、`remainingTime`、未同步的 `sm3Status` 均显示 `—`。
- 设备控制 API 未实现；API mode 继续明确提示，不伪造成功。

### 中期
- 站点侧推送客户端 (CLI / Agent)
- P1 小表 package 化 (tbl_user / tbl_site / tbl_platform)
- 站点同步调度器 (每小时触发)

### 长期
- ES 接入 (tbl_file / tbl_folder 全文检索)
- ClickHouse 接入 (tbl_sys_log / tbl_api_log)
- 鉴权 / SSO
- 审计 / 报表 / 告警
