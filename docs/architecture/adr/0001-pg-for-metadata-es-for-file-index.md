# ADR 0001: PostgreSQL for Metadata, OpenSearch/ES for File Index

> Status: Accepted (R.85)
> Date: 2026-06-29
> Sprint: R.84 + R.85
> Deciders: platform
> Requirements: `requirements.md §5.2 索引` / `§2.3 同步` / `§6.1 性能` / `§6.4 可维护`

## Context

`tbl_file*` / `tbl_folder*` (29 张, R.84 决策矩阵 `file_index_es` 类别) 在单站点即可达千万级, 多站点汇总后会把 PostgreSQL 中心库变成重型搜索库。中心库同时承担:

- 业务元数据 (设备/任务/账号/部门/卷/巡检)
- 同步作业状态 (sync_package / file_index_jobs)
- 审计日志 (audit_log)
- 一致性校验 (consistency_report)

如果把 `tbl_file*` 也用 `sync_package` 推到 `unified_tbl_file`, 会同时破坏中心库查询性能、可用性、可维护性、安全性四类质量属性。

## Decision

- PostgreSQL 17 是中心库, **唯一职责**是业务元数据 + 同步/索引作业状态 + 审计日志。
- OpenSearch/ES 是文件索引库, **唯一职责**是 `tbl_file*` / `tbl_folder*` 的检索文档存储 (`disc_file_index`)。
- `/api/search` 调用 `SearchPort`, 由 port 决定 PG/ES 路由。
- `lib/sync/package-schema.ts` 的 `FORBIDDEN_PACKAGE_TABLES = ['tbl_file', 'tbl_folder']` 保持强制。
- R.84 决策矩阵 29 张 `tbl_file*` / `tbl_folder*` 全部归 `file_index_es` 类别。

## Consequences

### Positive

- PG 普通业务查询 P95 ≤ 1s (架构质量路线图 §3 性能场景)。
- ES 故障仅阻塞文件搜索, PG 主业务不受影响 (R.84 §可用性 场景)。
- 同步主链路不动, 新增文件字段只改 ES mapping + indexer mapper + API DTO (可修改性)。
- `tbl_file*` 跨权限过滤由 ES adapter 在 query 层强制注入, 不允许绕过 (安全性)。

### Negative

- 增加一个外部依赖 (OpenSearch/ES), 需要生产硬化 (R.87)。
- 跨站点文件搜索延迟受 ES 影响, P95 ≤ 2s (可接受)。
- 索引一致性由 `file_index_jobs` 表负责, 必须做水位/删除补偿 (R.86)。

### Compliance

- ✅ R.84 决策矩阵: 29 张 `tbl_file*` 全部归 `file_index_es`。
- ✅ 严禁进 PG `unified_*` (FORBIDDEN_PACKAGE_TABLES)。
- ✅ `/api/search` 通过 `SearchPort`, ES 不可用返回 `blocked_by_external_system`。

## Follow-ups

- R.85: 创建 `SearchPort` + OpenSearch adapter + file-indexer 最小闭环。
- R.86: `file_index_jobs` 水位/删除/tombstone。
- R.87: 监控/告警/生产硬化。

## Notes

`requirements.md` 明确要求 "文件索引信息走专业搜索引擎, 不允许把整张文件表塞进关系库" — 本 ADR 是该需求的实现契约。
