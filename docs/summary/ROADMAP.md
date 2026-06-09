# Roadmap

> **统一路线图 (取代分散在多个 sprint 文档中的路线图)**
> 截至: 2026-06-08

## 4.5 control_command 控制队列 MVP (刚完成)

Sprint 4.5: 总控具备可落地的命令下发骨架, 不假实现。

- 1 张表 (`control_command`, 16 字段 + 4 索引 + 1 触发器)
- 1 service (`lib/control/control-command.ts`, 5 函数)
- 5 个 API (3 总控 + 2 站点轮询)
- Tasks 页面 3 按钮接通 (暂停/恢复/重置, **不改 unified_tasks**)
- `/control` 控制命令列表页 + sidebar 入口
- 端到端 8 步全过 + tsc + build + smoke 干净
- 详情见 `docs/database-analysis/sprint-4.5-control-command-mvp.md`

## 4.6 (下一步)

**目标**: TaskControlProvider 抽象 + 9 thin API + 站点侧完整 HMAC

- 2d TaskControlProvider 抽象 (Sprint 4.1 已设计)
- 0.5d 站点侧完整 HMAC 升级 (nonce + 时间窗)
- 0.5d `/control` 批量操作 (按 status 批量取消)
- 3d WebSocket 推送 (可选, ROI 3)
- 依赖: Sprint 4.5 已完成

## 4.7

**目标**: SSO 跳转入口占位 (Sprint 4.2-C 方案 1 落地)

- 1d `lib/site/site-urls.ts` + `components/site-jump-button.tsx`
- 集成: Tasks/Racks/Volumes 详情页加"在站点管理" 跳转
- 依赖: 站点 URL 配置 (`SITE_URL_*` 环境变量)
- 风险: URL 未配置时按钮 disabled

## 4.8

**目标**: 巡检/恢复/优先控制方案 (Sprint 4.2-C 方案 2 完整版)

- 2d 巡检命令接入 (control_command.action='inspect_start')
- 2d 恢复命令接入 (action='recovery_start')
- 1d 真实站点拉取脚本示例
- 4d 总估时, 站点侧同步开发

### 4.8.2 站点控制真相审计 (2026-06-09 完成 + 重审)

**初版 (基于 source_restore 13 张表)**:
- **结论**: 站点库**没有原生控制机制** (0 control/command 表, 0 函数/触发器/视图)
- **状态**: Site Worker = framework + audit + simulator, **不是执行器**
- **5 个 commandType 全部降级为"审计总控意图"**, 真控制需站点侧 schema 变更
- **等待领导**: 站点表能否加新字段? 站点应用是否读新行? 是否提供真 API 文档?
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md`

**重审版 (基于 star_storage_db 170 张表) — Sprint 4.8.2-R**:
- **数据库**: 完整 PG 物理备份恢复 (`/Users/tian/Desktop/20260601`), 170 张表 (vs source_restore 13 张)
- **新发现**: 3 张表 cron + 7 张表 progress + 79 张表 status — **调度/进度/状态机基础设施完整**
- **仍然没有**: `paused` / `priority` / `pause` / `resume` / `reset` 字段 (全库 0 命中)
- **结论修正**: D 完全没有 → **A + B + C 部分支持** (有基础设施, 但缺 paused 字段, 无应用代码 evidence)
- **Site Worker 角色升级**: simulator → **调度编排 + 审计监控**
- **5 dispatch 重映射候选** (Sprint 4.9+ 实施, 需领导确认):
  - inspect_start → `tbl_check_patrol_task` / `tbl_data_receive_list`
  - recovery_start → `tbl_hot_restore_record`
  - task_pause/resume/reset → 维持 audit (无 paused 字段)
- **前端按钮恢复** (Sprint 4.8.2-R 落地, 2026-06-09):
  - Tasks 表格 + 详情抽屉新增 **暂停 / 恢复 / 重置** 3 按钮
  - 走 `POST /api/control/commands` (audit/simulator, 不改 `unified_tasks`)
  - Toast 文案明确"已提交到控制队列, 等待站点拉取执行"
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (重写版)

**Overnight Verification (2026-06-09)**:
- **DB**: `star_storage_db` 170 张表确认, 全库扫描 0 paused/priority 命中
- **Site Worker DRY_RUN**: 5/5 命令 (task_pause/resume/reset/inspect_start/recovery_start) 拉取执行, audit_log 5 行 (1:1)
- **UI 按钮**: 暂停/恢复/重置 3 按钮接通 control_command POST (3/3 ok), toast 合规, API mode only
- **smoke + siteCode**: smoke:sync passed, Tasks/Racks/Volumes/Sync 4 端点 siteCode 过滤一致
- **统计**: control_command 37 total (29 success / 7 failed / 1 inflight), audit_log 35 total (11 in last hour)
- **报告**: `docs/audit/sprint-4.8.2-r/REPORT.md` (含 CSV/JSON/Markdown)

### 4.8.3 (下一步) 等待领导决策后再开

- A. 站点表加 control_command 镜像字段 → Site Worker 升级为真控制
- B. 提供站点 API 文档 → 直接走 API
- C. 维持 simulator (当前) → 仅总控侧审计 + 事后追溯

## 5.x (需上级解锁 CLAUDE.md)

5.1 ADFS 集成登录 (5d) → 5.2 JWT 令牌 (4d) → 5.3 账号生命周期 (3d) → 5.4 RBAC (5d) → 5.5 审计 (3d) → 5.6 登录审计 (4d) → 5.7 部门管理 (5d) → 5.8 SSO 跳转真接入 (3d)

**总计 32 人天**, 解锁 REQ-003/006/007/009/017/019/023/040 共 8 项需求。

Sprint 3.0 审计结论: **业务完成度 85%**, 13/146 源端理论表 = 8.9% 真实存在率, 不再大规模接表。

- 13/13 源端实际表全部接入 (11 A + 2 C, 0 D)
- 4/4 同步数据类型覆盖 (设备/文件/权限/任务)
- 11 类需求源端 schema 缺失或 CLAUDE.md 禁止项, **不可实现**
- 详情见 `docs/database-analysis/sprint-3.0-business-value-audit.md`

## 3.1 (下一步)

**目标**: Racks slot 真实明细 drawer (ROI 5)

396 行 unified_slots 真实数据已有, Racks 页面缺 slot 明细。改 1 个 drawer, 调 /api/racks/[id]/slots。

## 3.2

**目标**: Tasks 详情页 _aggregate 来源 badge (ROI 4)

33/44 任务 runtime 真实 + 27/44 user_task_count 真实, 加 badge 标"来自 lib_task 聚合"。

## 3.3

**目标**: Dashboard unified_volumes 总数 tile (ROI 4)

5 个真实 volume, 但 Dashboard 没显示。

## 3.4

**目标**: 同步日志页 dispatcher A/B/C/D 分类 (ROI 3)

sync_table_log 已有 status, 加分类徽章让用户知道哪些表真实可用。

## 3.5

**目标**: unified_tasks.user_task_count 透传 + UI (ROI 3)

TaskDTO.aggregate 字段, drawer 展示 user_task_count。

## 3.6

**目标**: 系统操作 / 运维文档 (ROI 3)

写 4 篇: 启动 / 接入新站点 / 接新表 / 故障排查。



## 已完成

- ✅ **2C.18A-2C.20**: file-index reader/mapper/upsert/importer
- ✅ **2C.18D**: file-index 端到端验证 (独立测试库)
- ✅ **2D.1**: 全表同步分类矩阵
- ✅ **2D.2**: `/api/sync/package` + dispatch registry (2 表: tbl_task + tbl_disc_lib)
- ✅ **2D.3**: 10 张小表 package 化 + Summary 收口
- ✅ **2D.4**: Sync Center + package log API
- ✅ **2E.1**: 任务域字段缺口审查
- ✅ **2E.2**: 用户/站点/平台域接入 (tbl_user + tbl_site + tbl_platform)
- ✅ **2E.3**: 站点域真实性审查 (tbl_site/tbl_platform 是监控域, 不继续)
- ✅ **2F.1**: 任务域 P0 字段补全 (8 字段: task_mode/error_message/runtime_seconds/package_count/success_count/error_count/progress/current_phase)
- ✅ **2F.2A**: tbl_task_items 接入策略审查 (结论: source_restore 中不存在, 不接入, 文档化待源表)
- ✅ **2F.3**: 任务详情页收口 (数据源徽章 / 字段空态 / runtime 格式化 / 计数 0 保留 / API vs mock 差异)
- ✅ **2F.4**: siteCode 全局筛选 (Header 站点选择器 + Tasks/Racks/Sync 联动 + localStorage + URL 同步 + file-index 防跨站)
- ✅ **2G.1**: `/api/sync/package` HMAC 鉴权 (rawBody 优先签名 + 5min 时间窗 + timingSafeEqual + strict/dev 双模式)
- ✅ **2G.2**: Dashboard 真实总览 (`/api/dashboard/summary` + `/api/dashboard/recent-syncs` + SummaryBar + RecentSyncs 组件, 7/7 SQL 对账匹配, 跟随全局 siteCode)
- ✅ **2G.3**: 任务域盘点 (13 张 tbl_* 中仅 3 张任务表, 7 张"假定存在"表全不存在, runtime 推算 P0 唯一可补)
- ✅ **2H.1**: 站点 Package Exporter 模拟器 (`export:package` + `push:package` + `export-and-push` 端到端, 7 张表 HMAC 签名推送)
- ✅ **2H.1R**: Dispatcher 覆盖率审计 (5 A / 5 C / 3 D, D 类为 sourceIdField 错配)
- ✅ **2H.2**: Dispatcher 真实落库修复 (3 D → 0 D, 8 A 类, 真实可用率 38.5% → 61.5%, inlineUpsert 统计口径修正)
- ✅ **2H.3**: 3 张占位表聚合器 (tbl_lib_task / tbl_volume_slot / tbl_user_task 从 C → A, 真实可用率 61.5% → 84.6%, runtime_seconds 真实数据从 0 → 33 个 task)
- ✅ **2H.4**: /volumes 页面 + VolumeDTO.aggregate 透传 + 侧边栏入口 (2H.3 数据落地最后一公里, 5 个真实 volume / 3 个含 _aggregate, API 透传, 页面展示)
- ✅ **2H.5**: Tasks 列表 runtime 列 (来自 2H.3 真实数据, 33/44 任务有真实 runtime 75% 覆盖, formatRuntime 展示)
- ✅ **2H.6**: inlineUpsert inserted/updated 区分 (RETURNING xmax = 0 技巧, 13 张表全部支持真实区分, 端到端 5+5 验证通过)

## 2H.7 (下一步)

**目标**: Racks 页面 slot 真实明细 + 任务详情页 runtime 展示

| 任务 | 说明 |
|---|---|
| Racks 页面 slot 真实明细 (来自 unified_slots) | 396 行真实数据, 缺一个 slot 列表 drawer |
| 任务详情页接 runtime 真实数据 | Tasks 列表 33/44 任务有真实 runtime, 需要 UI 展示 |
| `tbl_hd_info` 5 个缺失列 (disk_id/capacity/used_capacity/total_capacity/slot_index) | 需要从其它表 join 或扩展 source schema |
| inlineUpsert inserted/updated 区分 | 加 `RETURNING (xmax = 0)` 让 PG 返回 inserted/updated 区分 |

## 2D.4 (下一步)

**目标**: 站点同步调度 + 同步日志 UI

| 任务 | 说明 |
|---|---|
| 站点侧推送脚本示例 | bash 包装站点导入 → 推 /api/sync/package |
| 同步日志页面增强 | 在 /logs 页面集成 sync_package_log 列表 |
| package 鉴权骨架 | API key 中间件 (HMAC) |
| package 严格 checksum | SHA-256 |

## 2D.5

**目标**: 用户/站点/平台 P0 小表接入

| 任务 | 说明 |
|---|---|
| tbl_user → unified_users | 用户主表 |
| tbl_site → unified_sites | 站点主表 |
| tbl_platform → unified_platforms | 平台主表 |
| 角色/部门/权限三件套 | P1 权限系统基础 |
| 全部 5 张走 package 化 | dispatch registry 扩展 |

## 2D.6

**目标**: ES 接入 + ClickHouse 日志骨架

| 任务 | 说明 |
|---|---|
| ES 客户端骨架 | lib/elasticsearch/* |
| tbl_file → ES (保持 file-index 作为 PG17 索引) | ES 仅用于全文检索 |
| tbl_sys_log → ClickHouse | 日志分析 |
| tbl_api_log → ClickHouse | API 日志分析 |
| ES 检索 API | /api/search/files?keyword= |

## P2: 大表索引/分析

- dynamic 7 模板表 → ES
- tbl_data_receive_* / tbl_evidence_* / tbl_receipt_* 索引化
- tbl_check_* / tbl_patrol_* 全文检索

## P3: 增强功能

- 审计 (谁/什么时候/改了什么)
- 报表 (周报/月报/年度)
- 运维告警 (容量/温度/失败)
- 多站点策略 (隔离/聚合/对比)
- SSO
