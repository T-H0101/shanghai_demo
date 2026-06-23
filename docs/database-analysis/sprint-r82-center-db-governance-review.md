# Sprint R.82 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.1.1: 站点配置（名称/IP/状态/联系人）
- REQ-2.1.3: 站点监控状态
- REQ-2.3.1 / REQ-2.3.2: 站点数据同步与同步策略
- REQ-6.2.1 / REQ-6.2.2: 安全配置与敏感信息保护
- REQ-6.3.3: PostgreSQL 17 中心库兼容与可维护

## 2. Requirement 原始文本

以 `docs/source/requirements.md` 为准，本 Sprint 涉及站点配置、站点同步、中心库、敏感信息保护和可部署性相关要求。

## 3. Implementation

- `app/api/sites/route.ts`
  - `/api/sites` 改为只返回 `sync_sites` 注册站点。
  - `sites` 表作为展示详情补充。
  - 业务表中出现但未注册的 siteCode 只进入 `meta.orphanSiteCodes`，不计入站点总数。
- `app/sites/page.tsx`
  - 页面站点统计口径改为注册站点。
  - 移除 derived 站点展示口径。
- `app/api/dashboard/summary/route.ts`
  - 首页全站统计改为只统计 `sync_sites.enabled=true` 注册站点范围。
- `lib/types/site.ts`
  - 移除 `derived` 站点状态。
- `scripts/audit/center-db-integrity.ts`
  - 新增只读中心库审计脚本。
  - 检查注册站点、未注册业务 siteCode、明文密码列、敏感 raw_data、站点库 170 表覆盖。
- `package.json`
  - 新增 `pnpm audit:center-db`。
- `README.md`
  - 增加部署后中心库真实性自检步骤。
- `scripts/e2e/test-sites.ts`
  - 更新站点 e2e，断言 `/api/sites` 与 `sync_sites` 注册表一致。
- `scripts/e2e/test-dashboard.ts`
  - 更新首页 e2e，断言 `siteCount` 等于 `sync_sites` 注册站点数。

## 4. Backend Reality

- 真后端：`/api/sites` 查询中心库 `sync_sites`、`sites`、`unified_tasks`、`unified_devices`、`unified_volumes`、`sync_package_log`。
- 真后端：`pnpm audit:center-db` 只读检查 `DATABASE_URL` 和可选 `SITE_DATABASE_URL`。
- 未完成：170 张源表未全部进入中心库；当前 PG17 package 白名单仍是 13 张小表。
- 未完成：`tbl_file/tbl_folder` 不进入 PG17 全量，仍需 ES/ClickHouse 或索引链路承接。

## 5. UI Reality

- `/sites` 页面的站点总数现在表示注册站点数，不再把 `TEST_*`、`PKG_TEST` 等历史业务数据 siteCode 当作站点。
- 页面仍保留禁用的站点写操作按钮；不宣称站点 CRUD 或 SSO 已完成。

## 6. Mock / Simulator / DRY_RUN / 真控制

- Mock：无新增。
- Simulator：无。
- DRY_RUN：无。
- 真控制：本 Sprint 不涉及控制执行闭环，不宣称控制完成。

## 7. Missing Pieces

- 170 张源表仍需完成分类矩阵：PG 小表 / ES 搜索索引 / ClickHouse 日志分析 / blocked / out_of_scope。
- `unified_sites` 当前仍可能为空；本 Sprint 以 `sync_sites + sites` 作为注册站点来源修正页面口径。
- 历史测试 siteCode 仍存在于中心库业务表中，但不再污染站点列表；生产库需用审计脚本确认无非测试 orphan。

## 8. Blocker Type

- `partial`
- 大表与日志表后续接入依赖 ES/ClickHouse：`blocked_by_external_system`
- 源表字段/业务语义未确认的 155 张表：`blocked_by_source_schema`

## 9. 需要的源端 schema / 站点 API 变更清单

- 站点需提供正式站点登记主数据，或允许中心以 `sync_sites/sites` 作为站点注册主数据。
- 170 张表需逐表确认业务语义、更新字段、增量游标和目标存储。
- 大文件/日志相关表需确认进入 ES/ClickHouse 的索引字段和保留策略。

## 10. Verdict

`partial`

本 Sprint 修正了中心库站点主数据口径和部署后审计入口，但不宣称中心数据库已完整集成 170 张表，也不宣称 requirements 全部完成。
