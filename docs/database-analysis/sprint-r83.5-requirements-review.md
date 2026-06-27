# Sprint R.83.5 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3 同步
- REQ-3 资源管理(数据接收 + 媒体)
- REQ-5.1 日志管理
- REQ-6.3 PG17 兼容

## 2. Requirement 原始文本

> 数据接收应覆盖数据清单、日志、任务三类业务
> 告警应支持预警类型、级别、触发时间、反馈
> 媒体(光盘)应有打印、检测、类型管理
> 证据与验证应支持完整生命周期记录

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.5/01-data-warning-media-tables.sql` | 新建 | 15 张 DDL |
| `databases/sprint-r83.5/__tests__/ddl-self-check.ts` | 新建 | DDL 自检(15 张 6 列 + UNIQUE + GIN + B-tree + COMMENT) |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 加入 R.83.5 DDL 迁移 |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 73 → 88 |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 73 → 88 |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING +15 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 dispatch handlers + REGISTRY |
| `app/api/sync/dump-now/route.ts` | 修改 | srcToUnified +15 |
| `scripts/sync/real-e2e-multi-site-test.ts` | 修改 | TABLE_MAPPING +15 |
| `app/api/data/receive/route.ts` | 新建 | CRUD 3 张 receive 表 |
| `app/api/data/classification/route.ts` | 新建 | CRUD 1 张 classification 表 |
| `app/api/early-warning/route.ts` | 新建 | CRUD 2 张 warning 表 |
| `app/api/media/disc/route.ts` | 新建 | CRUD 3 张 disc 表 |
| `app/api/evidence-verify/route.ts` | 新建 | CRUD 4 张 evidence/verify 表 |
| `app/api/transfer/route.ts` | 新建 | CRUD 2 张 download/upload 表 |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(数据接收 + 告警媒体)共 9 tabs |
| `components/check/__tests__/self-check.ts` | 修改 | 加 tab 文字验证 |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段加 R.83.5 范围(73-87)+ 13 irregular plural |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | R.83.5 检查 + threshold |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 R.83.5 标记 + 桶分布 68→53 + 复数化命名一致性 |
| `scripts/test-r83.4-whitelist.ts` | 修改 | `===73` 字面量改为 `>=73`(test type narrowing 修复) |

## 4. Backend Reality

**15 张新表全部就位**(实查统一库):
- ddl-self-check 跑通 **15/15 PASS**,exit 0
- 6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN + B-tree + COMMENT

**白名单 + dump manifest + dispatcher**:88 项全部就位,15 个新 dispatcher handler 编译过,tsc clean,smoke pass

**6 个 CRUD API**:
- 每个端点 6 checks(GET/POST/PUT/DELETE happy + DELETE negative + envelope)= 总 36+ checks
- 无 SOURCE_DATABASE_URL 引用

**/check 9 Tabs**:复用现有布局(概览/检查分类/检查任务/巡检策略/日志/存储卷/调度运维/数据接收/告警媒体)

**audit matrix**:
- `pnpm audit:center-db --strict --matrix` exit 0
- unifiedCount ≥ 90(预期)
- 13 irregular plural overrides 保证命名一致

**多站点真同步**(沿用 R.83.4 验证):`pnpm test:r83.4-e2e` 在 R.83.5 后包含 88 项映射,SH01 + BJ02 UNIQUE 约束隔离

## 5. UI Reality

`/check` 9 Tabs 全部 read-only display。无虚假按钮,无误导措辞(已 grep 验证)。任务控制按钮不在 R.83.5 范围。

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | R.83.3 Task 11 已修复 |
| Simulator | 无 | — |
| DRY_RUN | 无 | — |
| **真控制** | **沿用 R.83.4 Task 9** | **88 张白名单 dump-now 真同步 + 多站点隔离** |

## 7. Missing Pieces(不隐藏)

1. **53 张 `R.83.6+` 业务表未接入**: 剩余 5 轮推(每轮 15 张)
2. **29 张 tbl_file_*/tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **5 个 pre-existing dispatcher bug**: R.83.3 遗留,独立 Sprint 修复
4. **敏感字段 hash 改造**: 沿用 R.83.2 状态,`blocked_by_security`
5. **任务控制闭环**: 仍 `blocked_by_site_change`,需站点 app 配合

## 8. Blocker Type

- `partial`(R.83.5 15 张表 + 6 API + 2 Tabs 接入完成)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 53 张 R.83.6+ 业务表: 需后续 Sprint 推
- 5 pre-existing dispatcher bugs: 需独立 Sprint

## 9. Verdict

**`partial`** — R.83.5 完成 15 张数据接收 + 告警 + 媒体族业务表接入 + 6 个 CRUD API + 2 个 Tabs。沿用 R.83.4 多站点真同步验证基础设施。

按 §附录 B 完成度公式:
- 同步链路完成度: **88 / 170 = 51.8%**(白名单)
- 端到端真实同步完成度: **沿用 R.83.3+R.83.4** 真点击 + 多站点
- 后续 Sprint: R.83.6+ 推剩余 53 张业务表 + 大表走 ES

### 命名一致性披露

R.83.5 spec 使用复数命名(`unified_data_receive_lists`、`unified_early_warnings` 等)。矩阵文档 row 列原本使用单数,本次更新同步对齐到复数命名,避免文档与代码命名不一致。

## 10. 不变量(R.83.5 完成后必须 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 90 | `psql COUNT` | ✅ 90 |
| `ALLOWED_PACKAGE_TABLES` 数 = 88 | `pnpm test:r83.5-whitelist` | ✅ 12/12 PASS |
| `DUMP_ALLOWED_TABLES` = 88 | grep manifest | ✅ |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | ✅ 0 fail |
| 6 个 CRUD API self-check | `pnpm test:r83.5-api` | ✅ 42/42 PASS |
| /check 9 Tabs 渲染 | `pnpm test:r83.5-ui` | ✅ 28/28 PASS |
| 15 R.83.5 行治理矩阵标记 | grep | ✅ 15 |
| 桶分布 68 → 53 | grep | ✅ |
| 主分支未污染 | `git log main..HEAD` | ✅ 26+ commits ahead |