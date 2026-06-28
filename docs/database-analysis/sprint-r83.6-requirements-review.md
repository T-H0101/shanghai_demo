# Sprint R.83.6 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3 同步
- REQ-3 资源管理(ISO + 元数据 + 系统族)
- REQ-4.1 检索 / 视图
- REQ-6.3 PG17 兼容

## 2. Requirement 原始文本

> ISO 镜像位置与同步任务应有完整记录
> 元数据(系统级)应可被总控同步与展示
> 系统配置(`tbl_sys` / `tbl_sys_env`)与库族(`tbl_lib_group`)应纳入统一视图
> 文件操作相关表(挂载/缓冲/CD 柜/胶片/FT 文件/FT 系统/打包/临时槽位)需有结构化记录
> 后备窗口(`tbl_back_window`)应可被检索

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.6/01-iso-meta-system-tables.sql` | 新建 | 15 张 DDL(ISO + meta + system family) |
| `databases/sprint-r83.6/__tests__/ddl-self-check.ts` | 新建 | DDL 自检(15 张 6 列 + UNIQUE + GIN + B-tree + COMMENT) |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 88 → 103 |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 88 → 103 |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING +15 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 dispatch handlers + REGISTRY |
| `app/api/sync/dump-now/route.ts` | 修改 | srcToUnified +15 |
| `app/api/system-config/route.ts` | 新建 | CRUD 4 张系统配置表(unified_sys_configs + 3) |
| `app/api/iso/route.ts` | 新建 | CRUD 3 张 ISO 表(unified_iso_locations + 2) |
| `app/api/file-ops/route.ts` | 新建 | CRUD 8 张文件操作表(unified_mount_dirs + 7) |
| `app/api/__tests__/r83.6-api-test.ts` | 新建 | 3 端点 × 6 checks + 3 negative = 18+ checks |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(系统配置 + ISO 与文件)共 11 tabs |
| `components/check/__tests__/self-check.ts` | 修改 | 加 tab 文字 + API smoke 验证 |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段加 R.83.6 范围(88-102)+ 14 irregular plural + 14 IRREGULAR_UNIFIED_TO_SOURCE 映射 |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | R83_6_SOURCES + 2 新 checks + threshold >=103 |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 R.83.6 标记 + 桶分布 53→38 + 复数化命名一致性(`unified_sys_configs` 重命名) |

## 4. Backend Reality

**15 张新表全部就位**(实查统一库 105 张 unified_*):
- ddl-self-check 跑通 **15/15 PASS**,exit 0
- 6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN + B-tree + COMMENT

**白名单 + dump manifest + dispatcher**:103 项全部就位,15 个新 dispatcher handler 编译过,tsc clean,smoke pass

**3 个 CRUD API**:
- 每个端点 6 checks(GET/POST/PUT/DELETE happy + DELETE negative + envelope)= 总 18+ checks
- 无 SOURCE_DATABASE_URL 引用

**/check 11 Tabs**:复用现有布局(概览/检查分类/检查任务/巡检策略/日志/存储卷/调度运维/数据接收/告警媒体/系统配置/ISO 与文件)

**audit matrix**:
- `pnpm audit:center-db --strict --matrix` 0 fail(unifiedCount = 105)
- 14 irregular plural overrides 保证命名一致
- 14 IRREGULAR_UNIFIED_TO_SOURCE 映射(包括 `unified_sys_configs ← tbl_sys` 语义化重命名)

## 5. UI Reality

`/check` 11 Tabs 全部 read-only display。无虚假按钮,无误导措辞(已 grep 验证)。任务控制按钮不在 R.83.6 范围。

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | R.83.3 Task 11 已修复 |
| Simulator | 无 | — |
| DRY_RUN | 无 | — |
| **真控制** | **沿用 R.83.4 Task 9** | **103 张白名单 dump-now 真同步 + 多站点隔离** |

## 7. Missing Pieces(不隐藏)

1. **38 张 `R.83.7+` 业务表未接入**: 剩余 3 轮推(每轮 15 张)
2. **29 张 tbl_file_*/tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **5 个 pre-existing dispatcher bug**: R.83.3 遗留,独立 Sprint 修复
4. **敏感字段 hash 改造**: 沿用 R.83.2 状态,`blocked_by_security`
5. **任务控制闭环**: 仍 `blocked_by_site_change`,需站点 app 配合

## 8. Blocker Type

- `partial`(R.83.6 15 张表 + 3 API + 2 Tabs 接入完成)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 38 张 R.83.7+ 业务表: 需后续 Sprint 推
- 5 pre-existing dispatcher bugs: 需独立 Sprint

## 9. Verdict

**`partial`** — R.83.6 完成 15 张 ISO + 元数据 + 系统族业务表接入 + 3 个 CRUD API + 2 个 Tabs。沿用 R.83.4 多站点真同步验证基础设施。

按 §附录 B 完成度公式:
- 同步链路完成度: **103 / 170 = 60.6%**(白名单)
- 端到端真实同步完成度: **沿用 R.83.3+R.83.4+R.83.5** 真点击 + 多站点
- 后续 Sprint: R.83.7+ 推剩余 38 张业务表 + 大表走 ES

### 命名一致性披露

R.83.6 spec 使用复数命名(`unified_iso_locations`、`unified_sys_configs`、`unified_back_windows` 等)。特别说明:
- `tbl_sys` 在源库中是单数,语义上对应"系统配置",因此映射到 `unified_sys_configs`(而非 `unified_sys`)以增强语义清晰度
- `tbl_ft_sys` → `unified_ft_systems`(复数 + 与 `tbl_ft_file`/`tbl_ft_sys` 保持一致)
- 矩阵文档 row 列已同步对齐到复数命名,避免文档与代码命名不一致

## 10. 不变量(R.83.6 完成后必须 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 105 | `psql COUNT` | ✅ 105 |
| `ALLOWED_PACKAGE_TABLES` 数 = 103 | `pnpm test:r83.6-whitelist` | ✅ 12/12 PASS |
| `DUMP_ALLOWED_TABLES` = 103 | grep manifest | ✅ |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | ✅ 0 fail(unifiedCount=105) |
| 3 个 CRUD API self-check | `pnpm test:r83.6-api` | ✅ 18/18 PASS |
| /check 11 Tabs 渲染 | `pnpm test:r83.6-ui` | ✅ 39/39 PASS |
| audit matrix 22 checks | `pnpm test:matrix-round` | ✅ 22/22 PASS |
| 15 R.83.6 行治理矩阵标记 | grep | ✅ 15 |
| 桶分布 53 → 38 | grep | ✅ |
| 主分支未污染 | `git log main..HEAD` | ✅ ahead |

## 11. 完整端到端链路(R.83.6 真同步证据)

| 链路环节 | 命令 | 结果 |
|---|---|---|
| DDL apply | `psql < databases/sprint-r83.6/01-iso-meta-system-tables.sql` | ✅ 15 张表已建 |
| 白名单 sanity | `pnpm test:r83.6-whitelist` | ✅ 12/12 PASS |
| Dump manifest | `pnpm sync:dump:export` | ✅ 103 张源表导出 |
| Dump ingest | `pnpm sync:dump:ingest` | ✅ R.83.6 15 张 dispatcher 写入 |
| 多站点隔离 | `pnpm test:r83.4-e2e` | ✅ SH01 + BJ02 UNIQUE 隔离 |
| 总控 11 Tabs | `pnpm test:r83.6-ui` | ✅ 39/39 PASS(playwright 截图) |
| API CRUD | `pnpm test:r83.6-api` | ✅ 18/18 PASS |
| Audit matrix | `pnpm test:matrix-round` | ✅ 22/22 PASS |
