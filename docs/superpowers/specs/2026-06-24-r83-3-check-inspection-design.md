# Sprint R.83.3 — tbl_check_* 检查巡检族 15 张业务表接入设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中心库 `unified_*` 从 43 张扩到 58 张(R.83.3 +15,聚焦检查巡检族),落实 PG17 中心库对 requirements §4.3 盘笼检查主路径的覆盖。

**Architecture:** 沿用 R.83.1/R.83.2 模板 — 15 张 DDL(`databases/sprint-r83.3/`)→ `ALLOWED_PACKAGE_TABLES` 43→58 → 15 个新 dispatcher handler → 5 个 CRUD API(`/api/check/{categories,sub-categories,items,sectors,templates,tasks,patrols,logs}` 整合)→ 在 `/check` 页加 1 个统一 tab(或新建 `/admin/check` 页)→ audit 矩阵 15 行 R.83.3 标记。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg。

**Base branch:** `codex/center-db-governance`(基于 R.83.2 完成态,HEAD = `22a3a3e`)。

---

## 1. 上下文与约束

### 1.1 来源

- R.83.1 已落地 15 张(部门/项目/接收单族)
- R.83.2 已落地 15 张(RBAC + 字典 + 日志 + 凭据族)
- R.83.3 选 `tbl_check_*` 检查巡检族 15 张(覆盖 requirements §4.3 盘笼检查主路径)
- 剩余 83 张候选业务表留 R.83.4+

### 1.2 选定的 15 张表

| # | 源表 | 中心库表 | 类型 | 备注 |
|---:|---|---|---|---|
| 1 | `tbl_check_category` | `unified_check_categories` | 业务 | 检查分类 |
| 2 | `tbl_check_sub_category` | `unified_check_sub_categories` | 业务 | 子分类 |
| 3 | `tbl_check_item` | `unified_check_items` | 业务 | 检查项 |
| 4 | `tbl_check_sector` | `unified_check_sectors` | 业务 | 检查扇区 |
| 5 | `tbl_check_template` | `unified_check_templates` | 业务 | 检查模板 |
| 6 | `tbl_check_task` | `unified_check_tasks` | 业务 | 检查任务 |
| 7 | `tbl_check_task_item` | `unified_check_task_items` | 业务 | 任务项 |
| 8 | `tbl_check_task_file` | `unified_check_task_files` | 业务 | 任务文件 |
| 9 | `tbl_check_file` | `unified_check_files_2` | 业务 | **重命名**:`unified_check_files` 已被 R.83.1 `tbl_receipt_files` 占用 |
| 10 | `tbl_check_files` | `unified_check_files_pl` | 业务 | **重命名**:同上 |
| 11 | `tbl_check_log` | `unified_check_logs` | 业务 | 检查日志 |
| 12 | `tbl_check_patrol_strategy` | `unified_check_patrol_strategies` | 业务 | 巡检策略 |
| 13 | `tbl_check_patrol_task` | `unified_check_patrol_tasks` | 业务 | 巡检任务 |
| 14 | `tbl_check_patrol_task_item` | `unified_check_patrol_task_items` | 业务 | 巡检任务项 |
| 15 | `tbl_check_patrol_log` | `unified_check_patrol_logs` | 业务 | 巡检日志 |

**命名冲突处理**:`unified_check_files` 已存在(R.83.1 `tbl_receipt_files` 映射),所以 `tbl_check_file` / `tbl_check_files` 需要 suffix 区分。本表统一加后缀:
- 单数 `tbl_check_file` → `unified_check_files_2`
- 复数 `tbl_check_files` → `unified_check_files_pl`

其他 13 张无冲突,沿用 R.83.2 pattern(`unified_<stripped>`)。

所有 15 张均为单 PK 表(无复合 PK)。

### 1.3 新增关键约束:R.83.3 必须做真实端到端同步验证(Task 11)

**R.83.1/R.83.2 留下的 gap**:之前只跑了 `pnpm smoke:sync`(mock 1 task + 1 device),**没有**真实把站点源库 `tbl_role` / `tbl_dict` 等 30 张业务表的数据 upsert 到中心库。`/sync` 页现有"触发同步"按钮实际只 POST `/api/sync/trigger` 写 control_command 队列,Agent 是否拉取执行未知。

**R.83.3 强制要求**:

1. **在 `/sync` 页加新按钮"立即同步 SH01"**,点击后真把 source_restore 站点的 43 张白名单数据 pg_dump 出来,通过 dispatcher upsert 到中心库。
2. **新增 `/api/sync/dump-now` 后端端点**:接收 `siteCode`,spawn `scripts/sync/export-restore-dump.ts` + `scripts/sync/ingest-dump.ts` 子进程,返回每个表的 upsert 行数。
3. **前端 self-check 必须真实点击该按钮**(用 Playwright 或 fetch + DOM 断言),不能直接脚本调 API。
4. **验证 43 张白名单表在中心库 rowCount > 0**(用 docker exec psql)。
5. **DDL 自检、API 自检、UI 自检 + 这条端到端同步自检 = R.83.3 的不变量**。

**严禁**:只跑 dispatcher 单元测试 / 只查 ALLOWED_PACKAGE_TABLES 元数据 / 用 mock 数据假装同步成功。

### 1.3 强约束(沿用 R.83.1/R.83.2)

- **总控绝不接 restore 库** — `app/**`、`components/**`、`lib/api/**` 不得引用 `SOURCE_DATABASE_URL` / `SITE_DATABASE_URL` / `site_restore_full_postgres`
- **restore 只作为同步链路来源** — `lib/sync/` 与 `scripts/sync/**` 唯一允许
- **DDL 严格 6 列标准** — `id UUID PK DEFAULT gen_random_uuid()`, `source_site_id VARCHAR(50) NOT NULL`, `source_table VARCHAR(100) NOT NULL DEFAULT '<src>'`, `source_record_id TEXT NOT NULL`, `synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `raw_data JSONB DEFAULT '{}'`, `UNIQUE(source_site_id, source_record_id)`
- **GIN 索引**:`CREATE INDEX ... USING GIN (raw_data jsonb_path_ops);` 每张必备
- **每张表必备索引**:`source_site_id` B-tree + GIN on raw_data
- **命名**:源表 `tbl_check_files`(复数) → 中心表 `unified_check_files_pl`,需在 DDL 注释中明确标注源表名

### 1.4 不在范围(本 Sprint 不做)

- ❌ 真实检查任务控制执行(暂停/恢复/重置) — `blocked_by_site_change`,R.83.4+ 或独立 Sprint
- ❌ 大表 tbl_file_*/tbl_folder_*(仍 `blocked_by_external_system`)
- ❌ 剩余 83 张 R.83.4+ 业务表
- ❌ 替换现有 mock 数据源(`lib/api/`)
- ❌ 真实 RBAC 拦截(仍 `blocked_by_auth`)
- ❌ 站点 SSO / 登录启用(仍 `blocked_by_auth`)

---

## 2. 数据流与边界

```
站点源库 (tbl_check_*) 
    ↓ pg_dump restore (R.2C 既有,lib/sync/)
中心库 unified_check_categories/unified_check_items/... (本 Sprint 新增)
    ↓ GET /api/check/{resources}
app/check/page.tsx (新增) 或在 /users 加 tab
    ↑ POST/PUT/DELETE 回写中心库 (本 Sprint 新增)
    ↑ audit --matrix (round 字段实时查 ALLOWED_PACKAGE_TABLES 顺序)
```

### 2.1 中心库 DDL 模式

沿用 R.83.1 模板:

```sql
CREATE TABLE IF NOT EXISTS unified_<stripped> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT '<src>',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_<pk> BIGINT,         -- 源 PK 列加 src_ 前缀保留
  -- 业务字段...
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_<stripped>_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_<stripped> IS 'Unified mirror of source <src>';
COMMENT ON COLUMN unified_<stripped>.src_<pk> IS '...';
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_site ON unified_<stripped> (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_raw_gin ON unified_<stripped> USING GIN (raw_data jsonb_path_ops);
```

### 2.2 Dispatcher handler(15 个)

`lib/sync/package-dispatcher.ts` 增加 15 个 dispatch function:
- `dispatchCheckCategory`、`dispatchCheckSubCategory`、`dispatchCheckItem`、`dispatchCheckSector`、`dispatchCheckTemplate`、`dispatchCheckTask`、`dispatchCheckTaskItem`、`dispatchCheckTaskFile`、`dispatchCheckFile2`(单数 → `unified_check_files_2`)、`dispatchCheckFilesPl`(复数 → `unified_check_files_pl`)、`dispatchCheckLog`、`dispatchCheckPatrolStrategy`、`dispatchCheckPatrolTask`、`dispatchCheckPatrolTaskItem`、`dispatchCheckPatrolLog`

每个 handler 包含:
- `selectSource()`:从源库读
- `transform()`:映射到 `unified_*` 行
- `inlineUpsert()`:把行写入中心库(`sourceIdColumn: 'source_record_id'`)

全部 15 张为单 PK 表(无复合 PK),沿用 R.83.2 dispatcher 模板。

### 2.3 CRUD API(2 个聚合端点)

| 路径 | 方法 | 数据源 |
|---|---|---|
| `/api/check/inspections` | GET/POST/PUT/DELETE | unified_check_categories + unified_check_sub_categories + unified_check_items + unified_check_sectors + unified_check_templates + unified_check_tasks + unified_check_task_items + unified_check_task_files + unified_check_files_2 + unified_check_files_pl + unified_check_logs(11 张) |
| `/api/check/patrols` | GET/POST/PUT/DELETE | unified_check_patrol_strategies + unified_check_patrol_tasks + unified_check_patrol_task_items + unified_check_patrol_logs(4 张) |

> 划分依据:inspections = 单次检查流程(11 张);patrols = 定期巡检流程(4 张)。两套端点对应两套业务流程,逻辑上独立。
> 认证占位:沿用 CLAUDE.md 第 10 节 — Sprint 5.x 解锁前不接真实 RBAC,仅占位 + `blocker: blocked_by_auth`。

### 2.4 前端 UI

新增独立页面 `app/check/page.tsx`,5 个 Tabs:

```
Tabs: [概览] [检查分类] [检查任务] [巡检策略] [日志]
```

每个 tab 显示对应统一表的内容(顶部 siteCode 多选 + 表格列表 + 详情 drawer)。

**导航入口**:
- 在 `components/layout/app-shell.tsx` 的 nav 数组追加 `{ href: '/check', label: '盘笼检查', icon: <CheckCircle /> }`
- (若 `app-shell.tsx` 不存在 nav 数组,使用最近似的 nav 组件)

**复用**:
- 顶部 siteCode 多选沿用 `/sites/page.tsx` 的 `siteCode` 多选 pattern
- 表格组件沿用 R.83.2 的 `<Table>` `<TableBody>` 等
- 详情 drawer 沿用 `<DetailPanel>`

**禁用按钮规范(CLAUDE.md 第 10 节)**:
- 任务控制(暂停/恢复/重置):不在本 Sprint,本 tab 不出现
- 真实 RBAC 拦截:disabled + tooltip "需 Sprint 5.x 解锁"
- 新建/编辑/删除:真后端能力(中心库 upsert),不写假按钮

---

## 3. 文件结构

### 3.1 新建

| 文件 | 用途 |
|---|---|
| `databases/sprint-r83.3/01-check-inspection-tables.sql` | 15 张 DDL |
| `app/api/check/inspections/route.ts` | CRUD inspections 11 张 |
| `app/api/check/patrols/route.ts` | CRUD patrols 4 张 |
| `app/api/check/__tests__/self-check.ts` | 2 端点 self-check |
| `app/check/page.tsx` | 5 个 Tabs 新页面 |
| `components/check/__tests__/self-check.ts` | /check 页 UI self-check |
| `scripts/test-r83.3-whitelist.ts` | 白名单 58 项自检 |

### 3.2 修改

| 文件 | 改动 |
|---|---|
| `databases/sprint-2b0/init-docker.sh` | 加入 R.83.3 DDL 到迁移链 |
| `lib/sync/package-schema.ts` | ALLOWED_PACKAGE_TABLES 43 → 58 |
| `lib/sync/package-dispatcher.ts` | 15 个新 dispatcher handler |
| `components/layout/app-shell.tsx`(或最近似 nav 组件) | nav 数组加 `/check` 项 |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 15 行 `round=R.83.3` 标记 + 桶分布表更新(98 → 83) |
| `README.md` | §5.3.7 R.83.3 入口 |
| `docs/summary/PROJECT_STATUS.md` | R.83.3 段 |
| `docs/summary/ROADMAP.md` | R.83.3 标记 |
| `package.json` | 加 `test:r83.3-whitelist` `test:r83.3-api` `test:r83.3-ui` |

---

## 4. 测试计划

### 4.1 Self-check 脚本

| 脚本 | 检查数 | 不变量 |
|---|---:|---|
| `scripts/test-r83.3-whitelist.ts` | 10 checks | 58 项白名单完整(43 + 15)、新 15 项存在、tbl_file/tbl_folder 仍 forbidden |
| `app/api/check/__tests__/self-check.ts` | 22 checks | 2 端点 × 5 happy + 2 negative = 22 |
| `components/check/__tests__/self-check.ts` | 15 checks | /check 页 5 tab 渲染 + API 200 + 无误导措辞 + 无 restore_db ref |
| `databases/sprint-r83.3/__tests__/ddl-self-check.ts` | 15 张表 × 6 项 = 90 checks | 6 列标准 + UNIQUE + GIN + B-tree + COMMENT ON TABLE |

总 ≈ 137 checks。

### 4.2 真实 e2e

```bash
pnpm exec tsc --noEmit           # type check
pnpm build                      # production build
pnpm smoke:sync                 # sync smoke
pnpm test:r83.3-whitelist       # 10 checks
pnpm test:r83.3-api             # 22 checks
pnpm test:r83.3-ui              # 15 checks
pnpm audit:center-db -- --strict --matrix
```

### 4.3 不通过的处理

任何 self-check fail:
- 当 subagent 修复,再跑直到 100%
- 不到 100% 不允许 commit

---

## 5. 验收清单

- [ ] 15 张 DDL 在中心库落地(实查)
- [ ] ALLOWED_PACKAGE_TABLES 43 → 58
- [ ] 15 个 dispatcher handler 编译过、tsc clean
- [ ] smoke:sync 跑通且真同步至少 1 行
- [ ] 2 个 CRUD API 端点在 self-check 全过
- [ ] `/check` 页 5 个 Tabs 渲染正确
- [ ] 治理矩阵文档 15 行 round=R.83.3 标记 + 桶分布更新(83 张剩余)
- [ ] matrix JSON `unifiedCount ≥ 58`
- [ ] audit --strict --matrix 全 pass(无 fail,允许预期 warn)
- [ ] README §5.3.7 加 R.83.3 入口
- [ ] spec self-review 无 placeholder/contradiction
- [ ] requirements review 产出 `docs/database-analysis/sprint-r83.3-requirements-review.md`,verdict 与状态准确

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `unified_check_files` 命名冲突 | suffix `_2` / `_pl` 显式区分,DDL 注释明确 |
| 2 端点(inspections + patrols)字段差异大 | 子路由按业务流分组,每个 endpoint sourceTables 数组清晰列出 |
| /check 新页 nav 注入位置不定 | 子 agent 先 Read `components/layout/app-shell.tsx`,确认 nav 模式后再追加 |
| 巡检策略 / 任务的源表字段类型未知 | 子 agent 按 R.83.2 模板推断(BIGINT / INTEGER / VARCHAR / TIMESTAMPTZ),实际跑通 ddl-self-check |
| 远端 GitHub 443 持续断 | 暂不推,本地 commit 完成后写明状态,待网络恢复统一推(HTTP/1.1 强制已验证可用) |

---

## 7. 不变量(完成后必须 true)

| 不变量 | 验证 |
|---|---|
| `unified_*` 表数 ≥ 58 | `psql ... "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` |
| ALLOWED_PACKAGE_TABLES 数 = 58 | `pnpm test:r83.3-whitelist` |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 |
| 任何 `app/api/check/**` 文件不引用 restore_db | grep |
| 2 个 CRUD API self-check 全过 | `pnpm test:r83.3-api` |
| /check 页 UI self-check 全过 | `pnpm test:r83.3-ui` |
| 治理矩阵 15 行 R.83.3 标记 | grep |
| R.83.3 requirements review 产出 | `docs/database-analysis/sprint-r83.3-requirements-review.md` |
| 主分支未污染 | `git log main..codex/center-db-governance` |