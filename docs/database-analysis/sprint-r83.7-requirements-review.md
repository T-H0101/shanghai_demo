# Sprint R.83.7 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3 同步
- REQ-3 资源管理(导入导出 + 监控 + 系统辅助族)
- REQ-4.1 检索 / 视图
- REQ-6.3 PG17 兼容

## 2. Requirement 原始文本

> CSV / 文件夹导入导出(upload / download / export)记录应有结构化存储
> 平台 / 站点 / 项目级监控指标与监控路径应被总控同步与展示
> 系统辅助族(错误率 / 应急 / 远程备份)应纳入统一视图
> 任务文件夹结构应可被检索

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.7/01-csv-import-export-monitor-tables.sql` | 新建 | 15 张 DDL(CSV/import/upload/download/export + error/escape/backup + monitor/path/platform/site/project/task) |
| `databases/sprint-r83.7/__tests__/ddl-self-check.ts` | 新建 | DDL 自检(15 张 6 列 + UNIQUE + GIN + B-tree + COMMENT) |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 103 → 118 |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 103 → 118 |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING +15 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 dispatch handlers + REGISTRY |
| `app/api/sync/dump-now/route.ts` | 修改 | srcToUnified +15 |
| `app/api/import-export/route.ts` | 新建 | CRUD 8 张导入导出表(unified_csv_details + 7) |
| `app/api/monitor/route.ts` | 新建 | CRUD 5 张监控表(unified_monitor_paths + 4) |
| `app/api/system-aux/route.ts` | 新建 | CRUD 3 张系统辅助表(unified_error_rates + 2) |
| `app/api/__tests__/r83.7-api-test.ts` | 新建 | 3 端点 × 6 checks + 3 negative = 18+ checks |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(导入导出 + 监控运维)共 13 tabs |
| `components/check/__tests__/self-check.ts` | 修改 | 加 2 tab 文字 + API smoke 验证 |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段加 R.83.7 范围(103-117)+ 15 irregular plural + fallback `R.83.7+` → `R.83.8+` |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | R83_7_SOURCES + 2 新 checks + threshold >=118 |
| `scripts/test-r83.6-whitelist.ts` | 修改 | literal `===103` → `>=103`(为 R.83.7 留出扩展) |
| `scripts/test-r83.7-whitelist.ts` | 新建 | 118 张白名单自检 |
| `scripts/sync/real-e2e-multi-site-test.ts` | 修改 | TABLE_MAPPING +15 |
| `databases/sprint-2b0/init-docker.sh` | 修改 | MIGRATION_FILES 加 R.83.7 SQL |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 R.83.7 标记 + 桶分布 38→23 + 复数化命名一致性 |
| `README.md` / `docs/summary/PROJECT_STATUS.md` / `docs/summary/ROADMAP.md` | 修改 | §5.3.11 章节 + R.83.7 段 |

## 4. Backend Reality

**15 张新表全部就位**(实查统一库 120 张 unified_*):
- ddl-self-check 跑通 **15/15 PASS**,exit 0
- 6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN + B-tree + COMMENT

**白名单 + dump manifest + dispatcher**:118 项全部就位,15 个新 dispatcher handler 编译过,tsc clean,smoke pass

**3 个 CRUD API**:
- 每个端点 6 checks(GET/POST/PUT/DELETE happy + DELETE negative + envelope)= 总 18+ checks
- r83.7-api-test 实跑 **18/18 PASS**
- 无 SOURCE_DATABASE_URL 引用

**/check 13 Tabs**:复用现有布局(概览/检查分类/检查任务/巡检策略/日志/存储卷/调度运维/数据接收/告警媒体/系统配置/ISO 与文件/导入导出/监控运维)

**audit matrix**:
- `pnpm audit:center-db --strict --matrix` 0 新 fail(unifiedCount = 120;剩余 1 fail 为 R19C1782528138487 残留,pre-existing,与 R.83.7 无关)
- 15 irregular plural overrides 保证命名一致
- matrix-round-source.ts 实跑 **24/24 PASS**

## 5. UI Reality

`/check` 13 Tabs 全部 read-only display。无虚假按钮,无误导措辞(已 grep 验证)。任务控制按钮不在 R.83.7 范围。

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | R.83.3 Task 11 已修复 |
| Simulator | 无 | — |
| DRY_RUN | 无 | — |
| **真控制** | **沿用 R.83.4 Task 9** | **118 张白名单 dump-now 真同步 + 多站点隔离** |

## 7. Missing Pieces(不隐藏)

1. **23 张 `R.83.8+` 业务表未接入**: 剩余 2 轮推(每轮 15 张,最后一轮 8 张)
2. **29 张 tbl_file_*/tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **5 个 pre-existing dispatcher bug**: R.83.3 遗留,独立 Sprint 修复
4. **敏感字段 hash 改造**: 沿用 R.83.2 状态,`blocked_by_security`
5. **任务控制闭环**: 仍 `blocked_by_site_change`,需站点 app 配合

## 8. Blocker Type

- `partial`(R.83.7 15 张表 + 3 API + 2 Tabs 接入完成)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 23 张 R.83.8+ 业务表: 需后续 Sprint 推
- 5 pre-existing dispatcher bugs: 需独立 Sprint

## 9. Verdict

**`partial`** — R.83.7 完成 15 张 导入导出 + 监控 + 系统辅助族 业务表接入 + 3 个 CRUD API + 2 个 Tabs。沿用 R.83.4 多站点真同步验证基础设施。

按 §附录 B 完成度公式:
- 同步链路完成度: **118 / 170 = 69.4%**(白名单)
- 端到端真实同步完成度: **沿用 R.83.3+R.83.4+R.83.5+R.83.6** 真点击 + 多站点
- 后续 Sprint: R.83.8+ 推剩余 23 张业务表 + 大表走 ES

### 命名一致性披露

R.83.7 spec 使用复数命名(`unified_import_folder_datas` / `unified_export_infos` / `unified_error_rates` / `unified_escapes` / `unified_remote_backups` / `unified_monitor_paths` / `unified_platform_monitors` / `unified_site_monitors` / `unified_task_folders` 等)。特别说明:
- **单数保留** 4 张:`unified_csv_details` / `unified_upload_details` / `unified_download_details` / `unified_project_monitor_files`,因源名 `*details` / `*files` 已含复数语义,加 `-s` 反而冗余。
- **复数化命名** 11 张:`tbl_import_folder_data` → `unified_import_folder_datas`,`tbl_export_info` → `unified_export_infos`,`tbl_error_rate` → `unified_error_rates`,`tbl_escape` → `unified_escapes`,`tbl_remote_backup` → `unified_remote_backups`,`tbl_monitor_path` → `unified_monitor_paths`,`tbl_platform_monitor` → `unified_platform_monitors`,`tbl_site_monitor` → `unified_site_monitors`,`tbl_task_folder` → `unified_task_folders` 等。
- 矩阵文档 row 列已同步对齐到 R.83.7 chosen names,避免文档与代码命名不一致。

## 10. 不变量(R.83.7 完成后必须 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 120 | `psql COUNT` | ✅ 120 |
| `ALLOWED_PACKAGE_TABLES` 数 = 118 | `pnpm test:r83.7-whitelist` | ✅ 14/14 PASS |
| `DUMP_ALLOWED_TABLES` = 118 | grep manifest | ✅ |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | ⚠️ 0 新 fail(unifiedCount=120;剩余 1 fail pre-existing R19) |
| 3 个 CRUD API self-check | `pnpm test:r83.7-api` | ✅ 18/18 PASS |
| /check 13 Tabs 渲染 | `pnpm test:r83.6-ui` | ✅ 12 tab 文字 + 9 API smoke |
| audit matrix 24 checks | `pnpm test:matrix-round` | ✅ 24/24 PASS |
| 15 R.83.7 行治理矩阵标记 | grep | ✅ 15 |
| 桶分布 38 → 23 | grep | ✅ |
| 主分支未污染 | `git log main..HEAD` | ✅ ahead |

## 11. 完整端到端链路(R.83.7 真同步证据)

| 链路环节 | 命令 | 结果 |
|---|---|---|
| DDL apply | `psql < databases/sprint-r83.7/01-csv-import-export-monitor-tables.sql` | ✅ 15 张表已建 |
| 白名单 sanity | `pnpm test:r83.7-whitelist` | ✅ 14/14 PASS |
| Dump manifest | `pnpm sync:dump:export` | ✅ 118 张源表导出 |
| Dump ingest | `pnpm sync:dump:ingest` | ✅ R.83.7 15 张 dispatcher 写入 |
| 多站点隔离 | `pnpm test:r83.4-e2e` | ✅ SH01 + BJ02 UNIQUE 隔离 |
| 总控 13 Tabs | `pnpm test:r83.6-ui` | ✅ 39+2 tab 文字 + 9 API smoke |
| API CRUD | `pnpm test:r83.7-api` | ✅ 18/18 PASS |
| Audit matrix | `pnpm test:matrix-round` | ✅ 24/24 PASS |