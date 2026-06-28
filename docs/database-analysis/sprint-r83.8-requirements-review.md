# Sprint R.83.8 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3 同步
- REQ-3 资源管理
- REQ-4.2 任务管理(任务细节、状态)
- REQ-6.3 PG17 兼容

## 2. Requirement 原始文本

> 任务管理应支持任务项、打印状态、证书状态
> 槽位管理应支持 slot 文件/文件夹 的层级组织
> 同步链路应保持端到端一致

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.8/01-task-slot-tables.sql` | 新建 | 15 张 DDL |
| `databases/sprint-r83.8/__tests__/ddl-self-check.ts` | 新建 | DDL 自检(15 张 6 列 + UNIQUE + GIN + B-tree + COMMENT) |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 加入 R.83.8 DDL 迁移 |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 118 → 133 |
| `lib/sync/dump/manifest.ts` | 修改 | DUMP_ALLOWED_TABLES 118 → 133 |
| `lib/sync/dump/ingest.ts` | 修改 | TABLE_MAPPING +15 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 dispatch handlers + REGISTRY |
| `app/api/sync/dump-now/route.ts` | 修改 | srcToUnified +15 |
| `scripts/sync/real-e2e-multi-site-test.ts` | 修改 | TABLE_MAPPING +15 |
| `app/api/task-detail/route.ts` | 新建 | CRUD 3 张 task 表 |
| `app/api/slot-files/route.ts` | 新建 | CRUD 6 张 slot_file 表 |
| `app/api/slot-folders/route.ts` | 新建 | CRUD 6 张 slot_folder 表 |
| `app/api/__tests__/r83.8-api-test.ts` | 新建 | 3 端点 self-check(≥18 checks) |
| `app/check/page.tsx` | 修改 | 加 2 Tabs(任务详情 + 槽位管理)共 15 tabs |
| `components/check/__tests__/self-check.ts` | 修改 | 加 tab 文字验证 |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段加 R.83.8 范围(118-132)+ 15 irregular plural overrides |
| `scripts/audit/__tests__/matrix-round-source.ts` | 修改 | R.83.8 检查 + threshold 133 |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 R.83.8 标记 + 桶分布 23→8 |
| `package.json` | 修改 | `test:r83.8-whitelist` `test:r83.8-api` |

## 4. Backend Reality

**15 张新表全部就位**(实查统一库):
- ddl-self-check 跑通 **15/15 PASS**,exit 0
- 6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN + B-tree + COMMENT

**白名单 + dump manifest + dispatcher**:133 项全部就位,15 个新 dispatcher handler 编译过,tsc clean,smoke pass

**3 个 CRUD API**:
- 每个端点 6 checks(GET/POST/PUT/DELETE happy + DELETE negative + envelope)
- 总 ≥18 checks
- 无 SOURCE_DATABASE_URL 引用

**/check 15 Tabs**:复用现有布局(概览/检查分类/检查任务/巡检策略/日志/存储卷/调度运维/数据接收/告警媒体/系统配置/ISO 与文件/导入导出/监控运维/任务详情/槽位管理)

**audit matrix**:
- `pnpm audit:center-db --strict --matrix` exit 0(unifiedCount ≥ 135)
- 15 irregular plural overrides 保证命名一致
- bucket 23→8 + fallback R.83.9+

**多站点真同步**:沿用 R.83.4-7 验证基础设施,UNIQUE(source_site_id, source_record_id) 保证 SH01 + BJ02 独立。

## 5. UI Reality

`/check` 15 Tabs 全部 read-only display。无虚假按钮,无误导措辞(已 grep 验证)。任务控制按钮不在 R.83.8 范围。

## 6. Verdict

**`partial`** — R.83.8 完成 15 张任务详情 + 槽位管理族业务表接入 + 3 个 CRUD API + 2 个 Tabs。沿用前 7 轮多站点真同步验证基础设施。

按 §附录 B 完成度公式:
- 同步链路完成度: **133 / 170 = 78.2%**(白名单)
- unified_* 中心库: **135 张**(13 既有 + 120 R.83.x + 2 既有其他)
- 端到端真实同步完成度: **沿用 R.83.3+R.83.4** 真点击 + 多站点
- 后续 Sprint: R.83.9 推剩余 8 张业务表 + 大表走 ES

### 命名一致性披露

- slot 文件/文件夹表保持单数(`unified_slot_file_*` / `unified_slot_folder_*`),因为源表语义已是单数(`tbl_slot_file_15` 等);
- task 表用 R.83.7 复数化规则(`unified_task_items` / `unified_task_prints` / `unified_task_certif_statuses`);
- 矩阵文档 row 列同步对齐到 R.83.8 chosen names。

## 10. 不变量(R.83.8 完成后必须 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 135 | `psql COUNT` | ✅ 135 |
| `ALLOWED_PACKAGE_TABLES` 数 = 133 | `pnpm test:r83.8-whitelist` | ✅ 14/14 PASS |
| `DUMP_ALLOWED_TABLES` = 133 | grep manifest | ✅ |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | ✅ 0 new fail |
| 3 个 CRUD API self-check | `pnpm test:r83.8-api` | ✅ 18/18 PASS |
| /check 15 Tabs 渲染 | `pnpm test:r83.8-ui` | ✅ |
| 15 R.83.8 行治理矩阵标记 | grep | ✅ 15 |
| 桶分布 23 → 8 | grep | ✅ |
| 主分支未污染 | `git rev-parse --short main` = `7f81424` | ✅ |