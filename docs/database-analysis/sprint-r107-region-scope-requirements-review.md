# Sprint R.107 — 全局区域筛选 requirements review

## A. Requirement 对照

| Req | 原文要点 | 状态 |
|---|---|---|
| §2.1 站点 / 统一视图 | 多站点统一视图与筛选 | `partial` — 增加区域级筛选；不宣称站点 CRUD/管控完成 |
| §4.1 检索 | 检索区域筛选 | `out_of_scope`（本轮）— 检索页继续用页内 `regionFilter`，**不合并**顶部 `regionCode` |
| §5.1 日志 | 审计日志筛选 | `out_of_scope`（本轮）— 日志页 UI 不接顶部区域；API 已支持 `regionCode` 备后续 |

**Verdict**: `partial`（展示/列表筛选链路完成；检索/日志双轨保留）

## B. 前端变更清单（8 项）

1. **新增**: 无新页面；`SiteSelector` 改为 Popover 树
2. **修改**: 顶部选择器；sidebar / command-palette 保留 `regionCode`；dashboard / tasks / sync / early-warning / racks / control-command 传参与文案
3. **删除**: 无
4. **UI-only**: 一级 `·区域` / `·站点` 灰色标记
5. **真实后端**: `regionCode` → `resolveRequestScope` → SQL `= ANY` / FALSE（空区域）
6. **simulator/DRY_RUN**: 无
7. **需求未要求的新增**: 无（属 §2.1 统一视图增强）
8. **理由**: 已有 `site_regions`；顶部扁平列表难管理多站

## C. API 变更清单

- `resolveRequestScope` / `resolveRequestScopeFromSearchParams`（`lib/auth/site-scope.ts`）
- 已接: dashboard summary/recent-syncs、early-warning、alerts、sync/packages、control GET、tasks、racks、volumes、trend、logs
- `/api/sync/config` 返回 `regionCode`
- 控制 POST / sync trigger / SSO：**仍要求具体站点**（区域不可当目标）

## D. 数据库变更清单

- 无新 DDL（复用 R.103/R.105 `site_regions` + `sync_sites.region_code`）

## E. 事件测试清单（要点）

| 交互 | 验证 |
|---|---|
| 点区域 | URL `siteCode=__all__&regionCode=XXX`；列表按区域过滤 |
| 点站点 | URL 仅 `siteCode`；清 region |
| 空区域 | API total=0；页面空数据 |
| 进入站点 | 区域模式下 disabled |
| 检索/日志 | 本轮不跟顶部（双轨写明） |

脚本: `pnpm e2e:region-scope` → `scripts/e2e/test-region-scope.ts`

## F. 浏览器验证

- 手工: 打开选择器 → 区域/未挂靠站点平铺 → 标记可见
- e2e: 首页 200 + API regionCode

## G. mock / simulator / DRY_RUN

- 无 mock 冒充区域筛选；空区域返回真实空列表

## H. 未完成项

- 检索页与顶部区域合并
- 日志页 UI 接全局区域
- 区域级批量控制（明确不做）

## I. 是否允许 commit

满足本 Sprint 范围 + 禁止项无违反 → **允许 commit**（需本地 `tsc` / `e2e:region-scope` 通过）

## Backend reality

- 证据: `resolveRequestScope` 查 `sync_sites.region_code`，权限交集后 `SiteScope.listed`；空 → `sql FALSE`
- 非「仅 UI」

## UI reality

- Toast/按钮: 区域下「进入站点」「新建任务」「立即同步」禁用并提示选具体站
- 禁止措辞: 未宣称「区域控制完成」

## Missing pieces / Blocker

- `blocked_by_site_change`: 无（不依赖站点 app）
- 产品双轨: search/logs 未合并（有意）
