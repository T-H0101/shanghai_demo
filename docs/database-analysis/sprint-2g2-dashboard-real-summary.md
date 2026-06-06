# Sprint 2G.2 — Dashboard 真实总览统计接入

> 状态: ✅ 完成
> 提交: 略 (本 Sprint 提交时填入)
> Sprint 目标: 把首页 Dashboard 从 mock 聚合切换到中心库真实统计

---

## 1. 背景

完成 Sprint 2G.1 后, 系统已具备:

- Tasks/Racks/Volumes/Users/Sites 真实 API
- Sync Center + `/api/sync/package` (HMAC 鉴权)
- `siteCode` 全局筛选

Dashboard 之前走 `app/api/dashboard/summary` 但内部 100% mock 数据 (`lib/mock/tasks/racks/sites`), 与真实业务页面割裂。本 Sprint 把 Dashboard 接入中心库统计。

## 2. 范围与限制

- ✅ 新增两个新 API: `/api/dashboard/summary`, `/api/dashboard/recent-syncs`
- ✅ 接入两个新组件: `DashboardSummaryBar`, `DashboardRecentSyncs`
- ✅ 引入全局 `useSite()` 让统计随 siteCode 切换
- ✅ SQL 对账 7/7 匹配
- ❌ 不接新源表 (仍走 5 张统一表 + sync_package_log)
- ❌ 不改 `/api/sync/package` / HMAC
- ❌ 不改 file-index
- ❌ 不做 site-stats API (UI 无对应卡片, 标记 deferred)
- ❌ 不重做 UI 样式

## 3. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `app/api/dashboard/summary/route.ts` | 重写: 改用 unified_* 真实 SQL |
| `app/api/dashboard/recent-syncs/route.ts` | 新增: sync_package_log 最近 N 条 |
| `lib/api/dashboard-provider.ts` | 新增: 前端 fetch 封装 + 类型 |
| `components/dashboard/dashboard-summary-bar.tsx` | 新增: 6 项真实总览 tile |
| `components/dashboard/dashboard-recent-syncs.tsx` | 新增: 最近 10 条同步 |
| `app/page.tsx` | 接入两个新组件 |
| `scripts/sprint-2g2-baseline.ts` | 新增: 启动前基线脚本 |
| `scripts/sprint-2g2-reconcile.ts` | 新增: SQL 对账脚本 |
| `docs/database-analysis/sprint-2g2-dashboard-real-summary.md` | 本文档 |

## 4. 字段来源 (Summary)

| 字段 | SQL | 说明 |
|---|---|---|
| `taskCount` | `SELECT COUNT(*) FROM unified_tasks` | 含全部站点 / 单站点 |
| `deviceCount` | `SELECT COUNT(*) FROM unified_devices` | 同上 |
| `volumeCount` | `SELECT COUNT(*) FROM unified_volumes` | 新接入字段 |
| `userCount` | `SELECT COUNT(*) FROM unified_users` | 新接入字段 |
| `packageCount` | `SELECT COUNT(*) FROM sync_package_log` | 包级日志 |
| `failedPackageCount` | `WHERE status='failed'` | 失败包 |
| `lastSyncAt` | `MAX(finished_at)` | ISO 字符串 |
| `successRate` | `success / total * 100` | 整数百分比, 无数据时 `null` |
| `siteCount` | `COUNT(DISTINCT site_code)` | **仅全部站点视图**, 单站点返回 `null` |

## 5. 字段来源 (Recent Syncs)

| 字段 | 来源 |
|---|---|
| `siteCode` | `sync_package_log.site_code` |
| `batchId` | `sync_package_log.batch_id` |
| `status` | `success` / `failed` / `partial` / `running` |
| `totalRecordCount` | `total_record_count` |
| `successTableCount` | `success_table_count` |
| `failedTableCount` | `failed_table_count` |
| `tableCount` | `table_count` |
| `startedAt` | `started_at` |
| `finishedAt` | `finished_at` |
| `durationMs` | `finished - started` (后端计算) |

`ORDER BY finished_at DESC NULLS LAST, started_at DESC NULLS LAST`, 默认 `limit=10`, 上限 50。

## 6. siteCode 行为

- `?siteCode=SH01`: 单站点, `siteCode=SH01`, `siteCount=null`
- `?siteCode=TEST_CLEAN`: 单站点, 同上
- 不传 / `__all__`: 全部站点, `siteCode=null`, `siteCount=N`
- 前端通过 `useSite()` 读取全局 siteCode, 切换时自动重新拉取

## 7. Mock / API Mode 区别

| 模式 | SummaryBar / RecentSyncs 行为 |
|---|---|
| `NEXT_PUBLIC_API_MODE=api` | 渲染 + 真实数据 + DB badge |
| `NEXT_PUBLIC_API_MODE=mock` | 不渲染 (`return null`), 保持原 mock 卡片 |

API 失败:

- HTTP 错误 → `source: "unavailable"`, 显示"统计加载失败"+ 重试按钮
- 不回退到 mock 假数据
- 也不修改 mock 卡片的数据源

## 8. 验证结果

### 5 个 API 验证 (HTTP 状态)

| # | 接口 | HTTP | 备注 |
|---|---|---|---|
| 1 | GET `/api/dashboard/summary` | 200 | 全站视图 |
| 2 | GET `/api/dashboard/summary?siteCode=SH01` | 200 | 单站 |
| 3 | GET `/api/dashboard/summary?siteCode=TEST_CLEAN` | 200 | 单站 |
| 4 | GET `/api/dashboard/recent-syncs` | 200 | 10 条 |
| 5 | GET `/api/dashboard/recent-syncs?siteCode=TEST_SMOKE` | 200 | 10 条全 TEST_SMOKE |

### SQL 对账 (脚本 `sprint-2g2-reconcile.ts`)

```
✅ taskCount: sql=87 api=87
✅ deviceCount: sql=14 api=14
✅ volumeCount: sql=10 api=10
✅ userCount: sql=4 api=4
✅ packageCount: sql=32 api=32
✅ failedPackageCount: sql=4 api=4
✅ siteCount: sql=8 api=8
```

SH01 单站:

```
task=44 ✅ dev=6 ✅ vol=5 ✅ pkg=1 ✅ fail=1 ✅
```

### 回归 (其他 API)

| 接口 | HTTP |
|---|---|
| GET `/api/tasks` | 200 ✅ |
| GET `/api/racks` | 200 ✅ |
| GET `/api/volumes` | 200 ✅ |
| GET `/api/sync/packages` | 200 ✅ |
| POST `/api/sync/package` 无签名 | 401 ✅ (HMAC 仍生效) |
| `pnpm smoke:sync` | passed ✅ |
| `pnpm exec tsc --noEmit` | exit 0 ✅ |
| `pnpm build` | success ✅ (24 routes) |

## 9. 暂未实现 / Deferred

- **site-stats API**: Dashboard 当前没有按站点聚合的卡片 UI, 仅 `SiteHealthHeatmap` (设备列表) 和新的 `RecentSyncs` (混合展示)。如果未来加入"按站点统计卡片", 再做 `GET /api/dashboard/site-stats`。
- **Sync Trend Chart 真实数据**: 仍为硬编码 `chartData` (本 Sprint 不在范围)。需要单独的 `sync_trend_daily` 视图或 ES 索引支持, 留待后续 Sprint。
- **DashboardSummaryDTO 适配层**: 现有 `lib/api/dto` 是嵌套结构, 与 Sprint 目标扁平字段不同。本次未更新 DTO (避免破坏 tasks 已有调用方)。新 API 用 `lib/api/dashboard-provider.ts` 独立类型, 后续可考虑收敛。

## 10. 后续建议

1. 如果未来 Dashboard 需要展示"今日任务数 / 当前运行包"等时序数据, 引入 `sync_summary_daily` 物化视图 (本 Sprint 未做)。
2. `successRate` 当前只算 package 级; 如果想精确到 table 级, 需要 `sync_table_log` 聚合。
3. `userCount` 当前是 `unified_users` 行数, 实际可能含历史归档, 后续需确认是否去重。

## 11. 已知限制

- `unified_*` 全部走 PostgreSQL 中心库 `unified_disc_platform`, 无 ES / ClickHouse 加速。
- 不接 source_restore (严格遵守 Sprint 2A 约束)。
- 不动 file-index 表 / import:all 流程。
