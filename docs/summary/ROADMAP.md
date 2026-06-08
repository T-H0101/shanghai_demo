# Roadmap

> **统一路线图 (取代分散在多个 sprint 文档中的路线图)**
> 截至: 2026-06-08

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
