# R.83 中心库补 15 张业务表 + 治理矩阵设计

> 范围锁定日: 2026-06-23
> 上游 Sprint: R.82(commit ec57472,中心库站点主数据口径修正)
> 下游 Sprint: 后续 R.83.x 共 14 轮(每轮 15 张),本 Sprint 是模板建立轮

---

## 1. 目标与边界

### 1.1 真实起点(均以 Docker SQL 实测为依据,不靠估算)

| 维度 | 真实数字 | 出处 |
|---|---|---|
| 完整站点库表数 | 170 | `site_restore_full_postgres.star_storage_db` `information_schema.tables` |
| 表前缀 | 100% `tbl_*` | 同上 |
| 已是 `tbl_file_*` / `tbl_folder_*` 衍生 | 29 张 | 同上,排除条件 |
| 候选业务小表(≤32KB) | 101 张 | 同上 |
| 中心库当前白名单 | 13 张 | `lib/sync/package-schema.ts:19-33` |
| 中心库未接入业务小表 | 88 张 | 141(全业务小表) − 13 − 12 已是同步框架部分覆盖 |
| R.82 验证 | `pnpm audit:center-db --strict` 通过,2 个 warn(orphan 与未分类) | R.82 review |

### 1.2 一票否决边界

| 边界 | 规则 |
|---|---|
| **总控平台绝不接 restore 库** | `app/**`、`components/**`、`lib/api/**` 任何代码、产品页、API 路由**不得**引用 `SOURCE_DATABASE_URL`、`SITE_DATABASE_URL`、`site_restore_full_postgres` |
| restore 库**只**作为同步链路来源 | `lib/sync/` 与 `scripts/sync/**` 是唯一允许连接 restore 库的代码区,数据必须先落到中心库 `unified_*` 表,产品页再读中心库 |
| **不加新业务页面** | 15 张表的产品页可见性,优先复用现有页面(`/users`、`/tasks`、`/volumes`),如必须新增页面需**单独 spec 提案**,不混在本 Sprint |
| 不改 UI 风格 | CLAUDE.md 第 10.1 节 |
| 不降级需求 | 只能 `blocked_*` 或 `out_of_scope`,不允许"不做" |

### 1.3 不在本 Sprint 范围

- ES / ClickHouse 接入 tbl_file / tbl_folder 大表(后续 R.84+ 轮)
- Site Agent 增量推送框架(R.83 走 pg_dump 全量;Site Agent 是后续 Sprint)
- 站点 schema 改造 / 站点 API 改造(全部 `blocked_by_site_change`)
- ADFS / LDAP / SSO 接入(CLAUDE.md 列为 `blocked_by_auth`)
- 14 轮后续表接入(本 Sprint 只交付模板 + 第 1 轮 15 张)

---

## 2. Requirements 映射

| Req ID | 现状 | R.83 后变化 | 备注 |
|---|---|---|---|
| REQ-2.1.1 站点配置 | `partial` | `partial` | 本 Sprint 不动站点 CRUD |
| REQ-2.1.3 站点监控 | `partial` | `partial` | 同上 |
| REQ-2.3.1 同步范围 | `partial`(13/170) | `partial` → 升级说明(15 → 28) | **数字变化不直接升 req 状态**,需等真实数据流入才算 |
| REQ-2.3.2 同步策略 | `partial` | `partial` | 不变 |
| REQ-3.1 账号管理 | `partial`(unified_users 已通) | `partial` → 升级(15 张补齐后,`tbl_depa` `tbl_workspace` `tbl_user_role` 进中心库) | 仍 partial,等 RBAC/ADFS |
| REQ-3.2 权限分配 | `partial` | `partial` | 同上 |
| REQ-3.3 部门管理 | `partial` | `partial`(基础设施 `tbl_depa` 等补齐) | 仍 partial |
| REQ-4.2 统一任务管理 | `partial` | `partial`(`tbl_task_receipts` `tbl_task_files` 等进入后,补 task detail) | 不升 |
| REQ-5.1 日志管理 | `partial` | `partial` | 不变 |
| REQ-6.2 安全需求 | `partial` | `partial`(`audit:center-db` 已守门) | 不变 |
| REQ-6.3 兼容性 | `partial` | `partial` | 不变 |

> **本 Sprint 不变任何 req 状态**。它把"中心数据库不满足需求"这个可观察事实**从 13 张提升到 28 张**,为后续 req 升 `complete` 创造前置条件。

---

## 3. 15 张业务表清单(首轮)

**选表原则**: 业务依赖优先 + 复用现有 `unified_users` / `unified_tasks` / `unified_volumes` 父子表关系,补齐部门、项目、任务接收单、文件级别与项目归属。

### 3.1 名单(均经 `databases/disc_files.sql` 实查存在)

| # | 源表 | unified 中心表名 | 领域 | 主键 | 预期行数(本地) |
|---|---|---|---|---|---|
| 1 | `tbl_user_role` | `unified_user_roles` | 用户角色 | `id` | < 50 |
| 2 | `tbl_depa` | `unified_departments` | 部门 | `id` | < 20 |
| 3 | `tbl_workspace` | `unified_workspaces` | 工作区 | `id` | < 20 |
| 4 | `tbl_workspace_user` | `unified_workspace_users` | 工作区成员 | `user_id,workspace_id` | < 200 |
| 5 | `tbl_depa_user` | `unified_department_users` | 部门成员 | `user_id,depa_id` | < 200 |
| 6 | `tbl_depa_user_info` | `unified_department_user_info` | 部门成员扩展 | `user_id,depa_id` | < 200 |
| 7 | `tbl_project` | `unified_projects` | 项目 | `id` | < 50 |
| 8 | `tbl_project_site` | `unified_project_sites` | 项目-站点关系 | `project_id,site_id` | < 100 |
| 9 | `tbl_task_projects` | `unified_task_projects` | 任务-项目关系 | `task_id,project_id` | < 500 |
| 10 | `tbl_task_receipts` | `unified_task_receipts` | 任务接收单 | `id` | < 500 |
| 11 | `tbl_task_files` | `unified_task_files` | 任务文件级别 | `id` | < 5,000 |
| 12 | `tbl_task_check` | `unified_task_checks` | 任务校验 | `id` | < 500 |
| 13 | `tbl_receipt` | `unified_receipts` | 接收单 | `id` | < 500 |
| 14 | `tbl_receipt_check` | `unified_receipt_checks` | 接收单校验 | `id` | < 500 |
| 15 | `tbl_receipt_file` | `unified_receipt_files` | 接收单文件 | `id` | < 1,000 |

> **关键约束**: 15 张表全部 ≤ 16KB(本地测试库),属轻量级,**不需要**走 ES/ClickHouse,直接进 PG17 中心库即可。

### 3.2 不在首轮的表(为后续轮保留)

- `tbl_check_task` / `tbl_check_category` / `tbl_check_files` 等检查大类(可独立成 R.83.2)
- `tbl_volume_group` / `tbl_volume_workspace` 等存储领域(可独立成 R.83.3)
- `tbl_data_receive_*` 接收日志(可独立成 R.83.4)
- `tbl_early_warning_*` 预警(可独立成 R.83.5)

---

## 4. 组件设计(7 个)

### 4.1 C1 — 170 表治理矩阵文档

**路径**: `docs/database-analysis/r83-170-table-governance-matrix.md`

**字段**(每张表一行):

| 列 | 类型 | 说明 |
|---|---|---|
| `src_table` | text | 站点源表名 |
| `domain` | enum | users / departments / workspaces / projects / tasks / receipts / volumes / devices / checks / logs / others |
| `target_storage` | enum | `pg17_small` / `opensearch` / `clickhouse` / `forbidden` / `out_of_scope` |
| `unified_table` | text | 中心库表名(若进 PG17),否则 `—` |
| `blocker` | enum | none / blocked_by_source_schema / blocked_by_external_system / out_of_scope |
| `round` | text | 计划接入轮次(`R.83.1` … `R.83.14` 或 `deferred`) |
| `notes` | text | < 80 字 |

**必须事实来源**:
- 101 张小表从 `site_restore_full_postgres.star_storage_db` 实查得到
- 29 张 `tbl_file_*` / `tbl_folder_*` 标 `forbidden`(R.82 已锁定)
- 12 张已同步框架部分覆盖(如 `tbl_user` / `tbl_site` / `tbl_platform`)标 `pg17_small` 且 `round = already`

### 4.2 C2 — `audit:center-db --matrix` 输出 JSON

**路径**: `scripts/audit/center-db-integrity.ts`(扩展现有脚本,不新建)

**新增 flag**: `--matrix` 同时输出 `audit/center-db-matrix.json`,字段与 C1 一一对应。

**新增检查项**:
- 治理矩阵已分类率 = 已填 `target_storage` 的表数 / 170
- 已分类率 < 100% 时输出 `warn`(不 fail,因为后续轮还要补)
- 中心库 `unified_*` 表总数 < 28 时输出 `warn`

### 4.3 C3 — DDL patch: 15 张 `unified_*` 表

**路径**: `databases/sprint-r83.1/15-department-receipt-tables.sql`

**强约束**:
1. 必须引用 `databases/disc_files.sql` 同名列(逐字段比对),不允许改类型、不允许丢字段
2. 每张表必须有:
   - `id` 主键(若源表 `id` 是 `text` / `bigint` / `integer`,沿用,不动)
   - `source_site_id VARCHAR(50) NOT NULL`(每个 unified_* 表都有;**注:与 R.82 既有 unified_users / unified_tasks / unified_volumes / unified_devices 保持一致**;若未来需要更长站点代码,后续 Sprint 单独扩列,不允许单点改 15 张表)
   - `source_record_id TEXT NOT NULL`(原始主键,字符串保留避免精度问题)
   - `synced_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `raw_data JSONB`(完整保留源行,R.5.2 §7 不删)
   - 唯一约束 `(source_site_id, source_record_id)`
3. `JSONB` 索引:`CREATE INDEX ... USING GIN (raw_data)` 用于全文检索扩展
4. 表注释 + 列注释 `COMMENT ON COLUMN/TABLE` 全补(便于 DBA 排查)
5. 必须在 `pnpm db:init` 路径里被引入(`docker-compose.yml` 第 N 段)

### 4.4 C4 — 同步白名单扩展 13 → 28

**路径**: `lib/sync/package-schema.ts`(更新常量)

**新增 15 项**:
```ts
export const ALLOWED_PACKAGE_TABLES = [
  // 既有 13 张
  'tbl_task', 'tbl_disc_lib', 'tbl_magzines', 'tbl_slots',
  'tbl_hd_info', 'tbl_lib_task', 'tbl_disc', 'tbl_logical_volume',
  'tbl_volume_slot', 'tbl_user_task', 'tbl_user', 'tbl_site', 'tbl_platform',
  // R.83.1 新增 15 张
  'tbl_user_role', 'tbl_depa', 'tbl_workspace', 'tbl_workspace_user',
  'tbl_depa_user', 'tbl_depa_user_info', 'tbl_project', 'tbl_project_site',
  'tbl_task_projects', 'tbl_task_receipts', 'tbl_task_files', 'tbl_task_check',
  'tbl_receipt', 'tbl_receipt_check', 'tbl_receipt_file',
] as const  // 28 项
```

**同步 dispatcher 规则**: 已有 `lib/sync/dispatcher.ts` 自动按 `unified_<source>` 命名生成,本 Sprint 不改 dispatcher;但需要验证每张新表都能跑通 `pg_dump → ingest`。

### 4.5 C5 — 测试污染清理脚本

**路径**: `scripts/cleanup/center-db-test-pollution.ts`(新建)

**规则**:
- 幂等,重复跑结果一致
- 删除前必须 dump 到 `archive/cleanup-<YYYYMMDD>/<table>.jsonl`
- 只清 `unified_tasks` / `unified_devices` / `unified_volumes` / `sync_package_log` 四张表的 `site_code ~ /^(TEST_|PKG_TEST$)/` 行
- 默认 `--dry-run`,需显式 `--apply` 才真删
- 任何删除输出 `[INFO] deleted N rows from <table>` 必须人工 review 后再 commit

### 4.6 C6 — `/api/sites/orphans` 详情端点

**路径**: `app/api/sites/orphans/route.ts`(新建)

**约束**:
- GET only,只读
- 数据源 = 中心库业务表(绝不连 restore)
- 返回 `{ site_code, sources: { tasks, devices, volumes, packages } }[]`
- 与 `/api/sites` 已有的 `meta.orphanSiteCodes` 数据一致,**不重复实现**

### 4.7 C7 — `/sites` 页面 orphan 明细 Drawer

**路径**: `app/sites/page.tsx`(在现有 Dialog 复用)

**约束**:
- 不新增独立页面(CLAUDE.md 第 10.1)
- 点击"查看明细"按钮 → 复用现有 Dialog 显示列表
- 每行展示 siteCode + 4 个计数 + 红字提示"未计入站点总数"
- 不加"一键清理"按钮(避免误操作;清理走 `pnpm cleanup:test-pollution` 命令)

### 4.8 C8 — README 同步自检流程补全

**路径**: `README.md` §5.3.1(扩展)

**新增段落**:
- `audit:center-db` 输出 finding 解读表(7 个常见情况:pass / warn / fail 分别对应什么动作)
- `audit:center-db --matrix` 用法
- 矩阵 JSON 字段含义
- "提交决策清单"模板(给领导/站点运维看的 5 字段模板)

---

## 5. 数据流

### 5.1 DDL 与同步(direction: source → center)

```
site_restore_full_postgres.star_storage_db (源)
   ↓ pg_dump 仅限 ALLOWED_PACKAGE_TABLES 28 张
/tmp/<site>-table_backup.sql
   ↓ scripts/import:import-all
unified_disc_platform.{28 张 unified_*}
   ↓ /api/<table> 走 lib/db/query
前端页面读中心库
```

### 5.2 矩阵生成(direction: meta → docs)

```
SITE_DATABASE_URL → audit:center-db --matrix
  → 查 information_schema.tables
  → 比对 r83-170-table-governance-matrix.md 的人工分类
  → 写出 center-db-matrix.json
```

### 5.3 清理链

```
中心库业务表 → cleanup:center-db-test-pollution --dry-run
  → dump 行数 / 写到 archive/cleanup-<date>/
  → 人工 review 后 --apply
  → 重跑 audit:center-db --strict 期望 0 warn
```

---

## 6. 测试与验收(CLAUDE.md R.5 + 第 8 条)

### 6.1 提交前必跑(7 项)

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm audit:center-db -- --strict --matrix
pnpm cleanup:test-pollution -- --dry-run   # 期望 0 行需清理
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

任一失败禁 commit。

### 6.2 事件级测试(CLAUDE.md 第 10 条 10 项必答)

每个组件必须产出事件级 e2e 脚本,以 C4(白名单扩展)为例:

| # | 检查项 | 期望 |
|---|---|---|
| 1 | 用户在哪点击 | N/A(后端 API,无 UI) |
| 2 | 触发入口 | `pnpm scheduler:sync:once -- SH01` |
| 3 | API | `POST /api/scheduler/sync` |
| 4 | 返回 | `{code: 0, data: {tablesIngested: [28 个表名]}}` |
| 5 | DB | `unified_user_roles` 等 15 张新表 `COUNT(*) > 0` |
| 6 | 一致性 | `pnpm check:sync-consistency --siteCode=SH01` 报告 28 表都 matched |
| 7 | toast | N/A(后台任务) |
| 8 | mock/fallback | 无 |
| 9 | 误导用户 | 无 |
| 10 | requirements | 满足 REQ-2.3.1 范围扩展 |

### 6.3 R.83 requirements review 必含

按 `docs/database-analysis/requirements-strict-review-template.md`,产出 `docs/database-analysis/sprint-r83.1-requirements-review.md`,包含:

- 涉及 Req IDs(REQ-2.3.1 / REQ-3.1 / REQ-3.3 / REQ-4.2 / REQ-6.3)
- 每个组件的 Backend Reality + UI Reality
- 4 个新文件 DDL 行数 + 每个 unified_* 表 schema 快照
- e2e 全部 10 项验证记录
- mock / DRY_RUN / 真控制 区分(本 Sprint 无控制,**不会有**真控制)
- Missing pieces(剩下 73 张待 R.83.2~R.83.14 推)
- Blocker: `partial`(中心库接入进展,不能直接升 complete)
- Verdict: `partial`(基础设施层,需求仍 partial)

---

## 7. 风险与回退

| 风险 | 影响 | 缓解 |
|---|---|---|
| 源表字段类型与中心库不兼容(如 `text` vs `varchar`) | 同步中断 | C3 强制沿用源类型,不改 |
| 源表主键重复(多站点同 ID) | 数据冲突 | C3 强制 `(source_site_id, source_record_id)` 联合唯一 |
| `tbl_task_files` 等表实际行数远超本地预期 | 同步慢 | 测试环境先跑 `pnpm scheduler:sync:once -- SH01`,失败立刻回滚 DDL |
| 决策清单提交后领导要求扩展 | 时间 | 14 轮后续 Sprint 模板已建,后续成本低 |
| 新页需求被领导拒绝 | UI 不全 | C7 不新增独立页面,只复用现有 Dialog |

---

## 8. 提交清单(Commit list)

1. **commit 1**: `feat(schema): add 15 unified_* tables for departments, projects, receipts (R.83.1 DDL)`
2. **commit 2**: `feat(sync): extend package whitelist 13 → 28 with R.83.1 batch`
3. **commit 3**: `feat(audit): add matrix output to audit:center-db`
4. **commit 4**: `chore(audit): produce 170-table governance matrix doc`
5. **commit 5**: `feat(cleanup): add idempotent test-pollution cleanup script`
6. **commit 6**: `feat(api): add /api/sites/orphans detail endpoint`
7. **commit 7**: `feat(sites): surface orphan siteCode detail in Drawer`
8. **commit 8**: `docs(readme): extend §5.3.1 with finding interpretation + matrix guide`
9. **commit 9**: `test(e2e): add R.83.1 event-level verification + requirements review`

每个 commit 单独通过 §6.1 7 项检查。

---

## 9. 不变量(本 Sprint 完成后必须为 true)

1. `pnpm audit:center-db --strict --matrix` 通过,warn 数 ≤ 2
2. `unified_*` 表数 ≥ 28
3. 站点源表字段类型与中心库 `unified_*` 100% 对齐(按表逐列比对)
4. 没有任何 `app/**` 文件出现 `SOURCE_DATABASE_URL` 或 `restore_db` 字符串
5. R.83.1 requirements review 产出 + `pnpm e2e:all` 全过
6. 后续 14 轮模板(本 spec 第 4 节组件清单)可直接复用

---

## 10. 后续轮(本 Sprint 不做,但模板已立)

| Sprint | 范围 | 表数 |
|---|---|---|
| R.83.2 | 体检/检查大类(`tbl_check_*` 系列) | ~15 |
| R.83.3 | 存储/卷分组(`tbl_volume_group` 等) | ~15 |
| R.83.4 | 接收日志(`tbl_data_receive_*`) | ~15 |
| R.83.5 | 预警(`tbl_early_warning_*`) | ~15 |
| R.83.6 ~ R.83.x | 其他业务小表(每轮 15) | 余量 |
| **R.83 合计** | **~9-10 轮 × 15 张** | **~135** + R.83.1 的 15 = ~150 |

> 实际轮数取决于后续每轮 15 张能否凑齐领域内业务表;无法凑齐的轮可减少张数。剩余 `tbl_file_*` / `tbl_folder_*` 29 张走 ES/ClickHouse(`blocked_by_external_system`),为后续大表治理 Sprint 留位。170 张中部分 `tbl_*` 衍生表(`tbl_slot_file_*` 等)按业务依赖决定是否纳入后续轮。