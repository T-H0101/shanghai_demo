# Project Status

> **截至**: 2026-06-08
> **Sprint**: 4.5 完成 (control_command 控制队列 MVP)

## Sprint 3.0R 需求对照审计 (2026-06-08)

需求 vs 实现 真实对照。完整审计见 `docs/database-analysis/sprint-3.0r-requirements-reality-check.md`。

### 4 个率

| 率 | 数值 | 含义 |
|---|---|---|
| **需求完成度** | **28.1%** (9/32) | 完整实现 ✅ |
| 业务完成度 | 85% (Sprint 3.0) | 4/4 同步类型 |
| **可演示率** | **64%** (4.5/7) | 真实数据 + 端到端 demo |
| **可落地率** | **64%** (7/11) | 生产可用功能 |

### 8 大能力现状 (一句话)

| 能力 | 现状 | 根因 |
|---|---|---|
| JWT | ❌ Mock UI 演示, 0 真实 | CLAUDE.md 禁止 |
| RBAC | ❌ 无实现 | CLAUDE.md + 源端 3 行无 role |
| 登录 | ❌ Mock UI, 418 行演示 | CLAUDE.md 禁止 |
| 同步 | ✅ **核心能力, 13/13 源表处理完成** | — |
| 文件检索 | ⚠️ 任务级, 不是跨站 ES | CLAUDE.md 禁止 ES |
| 恢复 | ✅ 监控完整, ❌ 不发起 | 设计选择 (单向 pull) |
| 设备控制 | ✅ 监控完整, ❌ 不控制 | 设计选择 (单向) |
| 审计 | ⚠️ 同步层有, ❌ 业务操作 | CLAUDE.md 禁止登录/权限 |

### 32 项需求分布

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ completed | 9 | 28.1% |
| ⚠️ partial | 10 | 31.3% |
| ❌ not_started | 11 | 34.4% |
| 🚫 out_of_scope (CLAUDE.md 主动不做) | 2 | 6.3% |

### 14 项不可实现原因分布

| 类型 | 数量 | 说明 |
|---|---|---|
| CLAUDE.md 禁止项 | 8 | 登录/SSO/JWT/RBAC/审计/部门/ES/ClickHouse |
| 源端无数据 | 5 | tbl_site/tbl_platform/tbl_depa/tbl_file/tbl_folder 0 行 |
| 源端 schema 缺字段 | 4 | errorMessage/progress/checksum/移位 |
| 设计选择 (单向) | 2 | 任务控制/设备控制 |

### 下一阶段唯一推荐

**Sprint 3.7 — Racks slot drawer 真实数据 (ROI 5)**:
- 396 行 unified_slots 真实数据已有
- Racks 页面缺 slot 明细
- 1 个 drawer + 1 个 API 增强
- 完成后业务完成度 85% → 88%

**不再推荐**: 接新表 (133 张理论表 0 行) / 登录权限 (CLAUDE.md) / ES (CLAUDE.md) / 任务控制 (单向设计) / 设备控制 (单向设计)

---

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
- **Volumes** (`/volumes`) — Sprint 2H.4 上线, 5 个真实 volume, 3 个含 _aggregate 聚合 (slot_count/online/offline), 顶部 4 tile 统计 + 列表 + Drawer 详情

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
- **Sprint 2H.3 3 张占位表聚合器** — `tbl_lib_task` → `unified_tasks.runtime_seconds` (33/44 任务 75% 真实覆盖), `tbl_volume_slot` → `unified_volumes.raw_data._aggregate` (15/25 volume 真实 slot_count/online/offline), `tbl_user_task` → `unified_tasks.raw_data._aggregate.user_task_count` (27/44 真实关联数), dispatcher 从 `skip: true` 升级为调用聚合器, 真实可用率 61.5% → 84.6%
- **Sprint 2H.4 /volumes 页面** — `app/volumes/page.tsx` 完整页面 (顶部 4 tile: 卷总数/容量/盘位/聚合覆盖 + 列表 + Drawer 详情), `VolumeDTO.aggregate` 透传 `_aggregate`, 侧边栏 "存储卷" 入口, 把 2H.3 写入的真实数据落地到 UI
- **Sprint 2H.5 Tasks 列表 runtime 列** — Tasks 表格新增"运行耗时" 列, `formatRuntime(t.runtime)` 真实展示 2H.3 写入的 33/44 任务 runtime (75% 真实覆盖)
- **Sprint 2H.6 inlineUpsert inserted/updated 区分** — `RETURNING (xmax = 0) AS is_insert`, 全部 13 张白名单表真实区分 inserted vs updated, route.ts 透传 `TableSummary.inserted/updated`, 端到端 5+5 验证通过 (新 source_id → inserted, 重复 source_id → updated)
- **Sprint 3.0 全库业务价值审计** — 13/13 源表真实接入, 11 类需求源端缺失或禁止, 业务完成度 85%
- **Sprint 3.0R 需求对照** — 32 项需求矩阵 (✅ 9 / ⚠️ 10 / ❌ 11 / 🚫 2), 需求完成度 28.1%
- **Sprint 3.1 部署指南** — 完整 6 步启动 + HMAC + siteCode + 一键检查
- **Sprint 4.0 需求实现矩阵** — 40 个原子需求, 4 层映射, 6 状态分类
- **Sprint 4.1 任务控制能力审计** — 7 个原子动作 0 真实, 16 接口 + 13 字段 MVP
- **Sprint 4.2 PG 备份审查 + 同步策略收敛 + 控制方案 2 选 + 路线图** — 170 源表 / 13 白名单 (7.6%), 收口每小时同步, 设计 SSO 跳转 + 控制队列 2 方案
- **Sprint 4.5 control_command 控制队列 MVP** — 1 张表 (16 字段) + 1 service (5 函数) + 5 API (3 总控 + 2 站点) + Tasks 按钮接通 (暂停/恢复/重置, 不改 unified_tasks) + /control 列表页 + sidebar 入口, 端到端 8 步全过, tsc/build/smoke 全部干净

## 已接入表 (13 张)

| 源表 | target | sync_mode | status |
|---|---|---|---|
| tbl_task | unified_tasks | full | done |
| tbl_disc_lib | unified_devices | full | done |
| tbl_magzines | (unified_devices join) | aggregate | done |
| tbl_slots | unified_devices 汇总 + unified_slots 明细 | full/aggregate | partial：汇总完成，明细待站点真实 package |
| tbl_hd_info | unified_hard_disks | full | done |
| tbl_lib_task | (unified_tasks join) | aggregate | done (Sprint 2H.3) |
| tbl_disc | unified_disc_media | full | done |
| tbl_logical_volume | unified_logical_volumes | full | done |
| tbl_volume_slot | (unified_volumes join) | aggregate | done (Sprint 2H.3) |
| tbl_user_task | (unified_tasks join) | aggregate | done (Sprint 2H.3) |
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

## Sprint 4.8.2 站点控制真相审计 (2026-06-09)

### 初版 (基于 source_restore 13 张表)
- **结论**: 站点库**完全没有被外部控制的机制** (0 control/command/queue 表, 0 函数, 0 触发器, 0 视图)
- **关键发现**: `tbl_task.status` 无 "paused" 语义, 无 priority 字段. 即使修改 `tbl_task.status` 也**无证据**说明站点应用会执行
- **Site Worker 现状**: 框架 + audit + simulator, **不是执行器**. 5 个 commandType 全部降级为 "审计总控意图"
- **前端按钮**: 维持当前状态 (暂停/恢复/重置 已删, 不恢复). 推进/标记完成/失败 保留 (本地 UI, 不误导)
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md`

### 重审版 (基于 star_storage_db 170 张表) — Sprint 4.8.2-R
- **数据库**: 完整 PG 物理备份恢复 (`/Users/tian/Desktop/20260601`), 170 张表 (vs source_restore 13 张)
- **新发现**:
  - ✅ **3 张表有 cron** (`tbl_schedule_job`, `tbl_data_receive_list.schedule_cron`, `tbl_check_patrol_strategy.cron`)
  - ✅ **7 张表有 progress** (`tbl_hot_backup_record`, `tbl_hot_restore_record`, `tbl_interface_task.job_progress` 等)
  - ✅ **79 张表有 status 字段** (state machine 基础完整)
  - ✅ 调度/进度/状态机基础设施**完整存在**
- **仍然没有**: `paused` / `priority` / `pause` / `resume` / `reset` 字段 (**全库 0 命中**)
- **新候选 control 表**:
  - `tbl_hot_restore_record` (recovery_start 目标, 含 progress/status/error_message)
  - `tbl_hot_backup_record` (热备目标)
  - `tbl_check_patrol_task` (inspect_start 目标, 含 status/success_count/fail_count)
  - `tbl_data_receive_list` (数据接收/巡检入口, 含 schedule_cron)
- **结论修正**: 从 "D 完全没有" → "A + B + C 部分支持" (有基础设施, 但缺关键 paused 字段, 无应用代码 evidence)
- **Site Worker 角色升级**: simulator → **调度编排 + 审计监控**
- **5 dispatch 重映射** (Sprint 4.9+ 实施, 需领导确认):
  - inspect_start → `tbl_check_patrol_task` 或 `tbl_data_receive_list`
  - recovery_start → `tbl_hot_restore_record`
  - task_pause/resume/reset → 维持 audit (无 paused 字段)
- **前端按钮恢复** (Sprint 4.8.2-R 落地):
  - Tasks 表格操作列 + 详情抽屉新增 **暂停 / 恢复 / 重置** 3 按钮
  - 调用走 `POST /api/control/commands` (audit/simulator, 不直接改 `unified_tasks`)
  - Toast 文案明确: "已提交到控制队列, 等待站点拉取执行" (不误导用户)
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (重写版)

### Overnight Verification (Sprint 4.8.2-R, 2026-06-09)
- **DB 验证**: `star_storage_db` 170 张表确认, 全库扫描 0 paused/priority 命中
- **Site Worker DRY_RUN**: 5/5 命令 (task_pause/resume/reset/inspect_start/recovery_start) 通过 worker 拉取, 写入 audit_log 5 行 (1:1 对应)
- **UI 按钮**: 暂停/恢复/重置 走 control_command POST → 3/3 ok, toast 文案合规, API mode only
- **smoke + siteCode**: smoke:sync passed, 4 端点 (Tasks/Racks/Volumes/Sync) siteCode 过滤一致
- **未解决限制**: paused/priority 字段全库 0 命中, 站点应用 poll 行为无 evidence
- **报告文件**: `docs/audit/sprint-4.8.2-r/REPORT.md` (含 CSV/JSON/Markdown)
- **统计**: control_command 37 total (29 success / 7 failed / 1 inflight), audit_log 35 total (11 in last hour)

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
