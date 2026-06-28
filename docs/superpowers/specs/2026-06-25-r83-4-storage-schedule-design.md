# Sprint R.83.4 — 存储卷族 + 调度/注册族 + 设备业务族 15 张业务表接入设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中心库 `unified_*` 从 60 张扩到 75 张(R.83.4 +15,聚焦存储卷族 + 调度/注册/接口族 + 设备业务族),覆盖 requirements §4.2 任务调度 + §3 资源管理 + §1.2 多站点资源隔离。

**Architecture:** 沿用 R.83.3 模板 — 15 张 DDL(`databases/sprint-r83.4/`)→ `ALLOWED_PACKAGE_TABLES` 58→73 → 15 个新 dispatcher handler → 2 个 CRUD API(`/api/volume/{groups,users,workspaces}` + `/api/schedule/{jobs,registers}`)→ **复用 `/check` 页(优先复用,R.83.4 不新建独立页面)或加 tab 到 `/admin`** → audit 矩阵 15 行 R.83.4 标记。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg + Playwright。

**Base branch:** `codex/center-db-governance` HEAD = `64baf59`(R.83.3 review commit)。

---

## 1. 上下文与约束

### 1.1 来源

- R.83.1 部门/项目/接收单 15 张 + R.83.2 RBAC/字典/日志/凭据 15 张 + R.83.3 检查巡检 15 张 = 已落地 45 张业务表 + 13 既有 = 60 张 unified_*
- R.83.4 选 **存储卷族 5 张 + 调度/注册/接口 5 张 + 设备业务 5 张 = 15 张**
- 剩余 68 张候选业务表留 R.83.5+

### 1.2 选定的 15 张表(全部为单 PK 表,无复合 PK)

| # | 源表 | 中心库表 | 大小 | 业务族 |
|---:|---|---|---:|---|
| 1 | `tbl_volume_group` | `unified_volume_groups` | 16kB | 存储卷族 |
| 2 | `tbl_volume_dataclass` | `unified_volume_dataclasses` | 8kB | 存储卷族 |
| 3 | `tbl_volume_depa` | `unified_volume_depas` | 8kB | 存储卷族 |
| 4 | `tbl_volume_user` | `unified_volume_users` | 24kB | 存储卷族 |
| 5 | `tbl_volume_workspace` | `unified_volume_workspaces` | 8kB | 存储卷族 |
| 6 | `tbl_schedule_job` | `unified_schedule_jobs` | 16kB | 调度族 |
| 7 | `tbl_register_management` | `unified_register_managements` | 16kB | 注册族 |
| 8 | `tbl_interface_task` | `unified_interface_tasks` | 24kB | 接口族 |
| 9 | `tbl_hot_backup_record` | `unified_hot_backup_records` | 16kB | 备份族 |
| 10 | `tbl_hot_restore_record` | `unified_hot_restore_records` | 16kB | 恢复族 |
| 11 | `tbl_device_device` | `unified_device_devices` | 16kB | 设备族 |
| 12 | `tbl_drivers` | `unified_drivers` | 64kB | 驱动族 |
| 13 | `tbl_drivers_burn` | `unified_drivers_burns` | 32kB | 驱动族 |
| 14 | `tbl_raid_group` | `unified_raid_groups` | 16kB | RAID 族 |
| 15 | `tbl_hd_manager` | `unified_hd_managers` | 32kB | 硬盘族 |

**命名规则**:
- `tbl_volume_slot` 已是 R.83.1 既有(`unified_volume_slots` 已有,本次不动)
- 5 张 volume 表用 `volume_<role>`(group/dataclass/depa/user/workspace)无冲突
- `tbl_drivers_burn` → `unified_drivers_burns`(复数化)
- 其他 13 张直接 `unified_<stripped>`

### 1.3 强约束(沿用 R.83.3)

- **总控绝不接 restore 库** — `app/**`、`components/**`、`lib/api/**` 不得引用 `SOURCE_DATABASE_URL` / `SITE_DATABASE_URL` / `site_restore_full_postgres`
- **restore 只作为同步链路来源** — `lib/sync/` 与 `scripts/sync/**` 唯一允许
- **DDL 严格 6 列标准** — `id UUID PK DEFAULT gen_random_uuid()`, `source_site_id VARCHAR(50) NOT NULL`, `source_table VARCHAR(100) NOT NULL DEFAULT '<src>'`, `source_record_id TEXT NOT NULL`, `synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `raw_data JSONB DEFAULT '{}'`, `UNIQUE(source_site_id, source_record_id)`
- **GIN 索引** + B-tree(source_site_id) + COMMENT ON TABLE
- **多站点隔离**:`UNIQUE(source_site_id, source_record_id)` 已保证;验证测试中需实际验证 SH01/BJ02 同步后不互冲

### 1.4 不在范围(本 Sprint 不做)

- ❌ 真实控制闭环(任务暂停/恢复) — `blocked_by_site_change`,独立 Sprint
- ❌ 大表 tbl_file_*/tbl_folder_*(仍 `blocked_by_external_system`)
- ❌ 剩余 68 张 R.83.5+ 业务表
- ❌ 替换现有 mock 数据源
- ❌ 真实 RBAC 拦截(仍 `blocked_by_auth`)
- ❌ 站点 SSO / 登录启用(仍 `blocked_by_auth`)

---

## 2. 数据流与边界

```
站点源库 (15 张 tbl_*) 
    ↓ pg_dump restore (scripts/sync/ — 唯一允许)
中心库 unified_volume_groups/.../unified_hd_managers (本 Sprint 新增)
    ↓ GET /api/volume/* 或 /api/schedule/*
app/page.tsx (复用 /check 或 /admin) 
    ↑ POST/PUT/DELETE 回写中心库
    ↑ audit --matrix (round 字段实时查 ALLOWED_PACKAGE_TABLES)
```

### 2.1 中心库 DDL 模式

每张表严格按 R.83.3 模板:

```sql
CREATE TABLE IF NOT EXISTS unified_<stripped> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT '<src>',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_<pk> BIGINT,
  -- 业务字段 (按 disc_files.sql 推断;若不确定先按 6 列标准建表,业务字段后续补)
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_<stripped>_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_<stripped> IS 'Unified mirror of source <src>';
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_site ON unified_<stripped> (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_raw_gin ON unified_<stripped> USING GIN (raw_data jsonb_path_ops);
```

### 2.2 Dispatcher handler(15 个)

`lib/sync/package-dispatcher.ts` 增加 15 个 dispatch function,每个调用 `inlineUpsert(input, 'unified_<stripped>', { sourceIdField: 'id', columns, sourceIdColumn: 'source_record_id' })`。

15 个 dispatch:
- `dispatchVolumeGroup`、`dispatchVolumeDataclass`、`dispatchVolumeDepa`、`dispatchVolumeUser`、`dispatchVolumeWorkspace`
- `dispatchScheduleJob`、`dispatchRegisterManagement`、`dispatchInterfaceTask`
- `dispatchHotBackupRecord`、`dispatchHotRestoreRecord`
- `dispatchDeviceDevice`、`dispatchDriver`、`dispatchDriverBurn`、`dispatchRaidGroup`、`dispatchHdManager`

每个 dispatcher 字段按 disc_files.sql 类型映射(BIGINT / INTEGER / VARCHAR / TIMESTAMPTZ)。

### 2.3 CRUD API(2 个聚合端点)

| 路径 | 方法 | 数据源 |
|---|---|---|
| `/api/volume/storage` | GET/POST/PUT/DELETE | unified_volume_groups + unified_volume_dataclasses + unified_volume_depas + unified_volume_users + unified_volume_workspaces (5 张) |
| `/api/schedule/ops` | GET/POST/PUT/DELETE | unified_schedule_jobs + unified_register_managements + unified_interface_tasks + unified_hot_backup_records + unified_hot_restore_records + unified_device_devices + unified_drivers + unified_drivers_burns + unified_raid_groups + unified_hd_managers (10 张) |

> 划分依据:`/volume/storage` = 5 张存储卷族(单一业务域);`/schedule/ops` = 10 张调度/接口/备份/设备/驱动/RAID/硬盘(统一 ops 后端)。
> 认证占位:沿用 CLAUDE.md 第 10 节 — Sprint 5.x 解锁前不接真实 RBAC,`blocker: blocked_by_auth`。

### 2.4 前端 UI(优先复用)

**首选方案 — 复用 /check 页**:
- 在 /check 加 2 个新 Tabs:`存储卷` + `调度运维`
- 避免新建页面,减少 nav 复杂度

**备选方案 — 加 tab 到 /admin**:
- 如果 /check 已经是 5 tabs 不宜再扩,加到 /admin(若有)

**本 Sprint 决定**:复用 /check,加 2 个 Tabs(共 7 tabs)。

> "优先复用已有的页面" 符合用户流程约束。

**Tab 列表**:
```
Tabs: [概览] [检查分类] [检查任务] [巡检策略] [日志] [存储卷] [调度运维]
```

**禁用按钮规范(沿用 R.83.3)**:
- 任务控制(暂停/恢复/重置):不在 R.83.4 范围
- 真实 RBAC 拦截:disabled + tooltip "需 Sprint 5.x 解锁"
- 新建/编辑/删除:真后端能力(中心库 upsert),不写假按钮

---

## 3. 文件结构

### 3.1 新建

| 文件 | 用途 |
|---|---|
| `databases/sprint-r83.4/01-storage-schedule-tables.sql` | 15 张 DDL |
| `app/api/volume/storage/route.ts` | CRUD 5 张 storage 表 |
| `app/api/schedule/ops/route.ts` | CRUD 10 张 ops 表 |
| `app/api/volume/__tests__/self-check.ts` | 1 端点 self-check |
| `app/api/schedule/__tests__/self-check.ts` | 1 端点 self-check |
| `scripts/test-r83.4-whitelist.ts` | 白名单 73 项自检 |

### 3.2 修改

| 文件 | 改动 |
|---|---|
| `databases/sprint-2b0/init-docker.sh` | 加入 R.83.4 DDL 到迁移链 |
| `lib/sync/package-schema.ts` | ALLOWED_PACKAGE_TABLES 58 → 73 |
| `lib/sync/package-dispatcher.ts` | 15 个新 dispatcher handler |
| `lib/sync/dump/manifest.ts` | DUMP_ALLOWED_TABLES 58 → 73(允许 dump-now 真实拉这 15 张) |
| `lib/sync/dump/ingest.ts` | TABLE_MAPPING 58 → 73(命名映射) |
| `app/api/sync/dump-now/route.ts` | 源 → 统一 表名映射加 15 项 |
| `scripts/sync/real-e2e-test.ts` | 验证表名加 15 项 |
| `app/check/page.tsx` | 加 2 个 Tabs(存储卷 + 调度运维) |
| `components/check/__tests__/self-check.ts` | 加 2 tab 渲染验证 |
| `scripts/audit/center-db-integrity.ts` | round 字段加 R.83.4 范围(58-72) |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 15 行 R.83.4 标记 + 桶分布 83→68 |
| `README.md` | §5.3.8 R.83.4 入口 |
| `docs/summary/PROJECT_STATUS.md` | R.83.4 段 |
| `docs/summary/ROADMAP.md` | R.83.4 标记 |
| `package.json` | 加 `test:r83.4-whitelist` `test:r83.4-api` `test:r83.4-ui` `test:r83.4-e2e` |

---

## 4. 测试计划

### 4.1 Self-check 脚本

| 脚本 | 检查数 | 不变量 |
|---|---:|---|
| `databases/sprint-r83.4/__tests__/ddl-self-check.ts` | 90 checks | 15 张表 × 6 项 |
| `scripts/test-r83.4-whitelist.ts` | 10 checks | 73 项白名单完整 |
| `app/api/volume/__tests__/self-check.ts` | 6 checks | GET/POST/PUT/DELETE/negative |
| `app/api/schedule/__tests__/self-check.ts` | 6 checks | GET/POST/PUT/DELETE/negative |
| `components/check/__tests__/self-check.ts` | 25 checks | 加 2 tab 渲染 |
| `scripts/sync/real-e2e-test.ts` | 15 checks | 73 张表 + multi-site 验证(BJ02 + SH01) |

总 ≈ 152 checks。

### 4.2 多站点隔离验证(关键)

R.83.4 必须验证 **SH01 与 BJ02 同步后数据不互冲**:

```bash
# Test 1: SH01 同步
TEST_SITE_CODE=SH01 pnpm test:r83.4-e2e
# → 中心库 unified_volume_groups WHERE source_site_id='SH01' 应该有数据

# Test 2: BJ02 同步(若 site_restore 有 BJ02 dump)
TEST_SITE_CODE=BJ02 pnpm test:r83.4-e2e
# → 中心库 unified_volume_groups WHERE source_site_id='BJ02' 应该独立有数据
# → SH01 的数据不应被覆盖
```

### 4.3 真实 e2e

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm test:r83.4-whitelist
pnpm test:r83.4-api
pnpm test:r83.4-ui
pnpm test:matrix-round
pnpm audit:center-db -- --strict --matrix
TEST_SITE_CODE=SH01 pnpm test:r83.4-e2e
```

### 4.4 不通过的处理

任何 self-check fail → 修复 → 重跑直到 100%。

---

## 5. 验收清单

- [ ] 15 张 DDL 在中心库落地(实查)
- [ ] ALLOWED_PACKAGE_TABLES 58 → 73
- [ ] DUMP_ALLOWED_TABLES 58 → 73(dump-now 真实拉 15 张新表)
- [ ] 15 个 dispatcher handler 编译过、tsc clean
- [ ] smoke:sync 跑通
- [ ] 2 个 CRUD API 端点 self-check 全过
- [ ] /check 页加 2 个 Tabs 渲染正确(共 7 tabs)
- [ ] 治理矩阵文档 15 行 R.83.4 标记 + 桶分布 83→68
- [ ] matrix JSON unifiedCount ≥ 75
- [ ] audit --strict --matrix 全 pass
- [ ] README §5.3.8 加 R.83.4 入口
- [ ] requirements review 产出 `docs/database-analysis/sprint-r83.4-requirements-review.md`

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `unified_volume_users` 与 R.83.1 `unified_department_users` 字段含义冲突 | 显式不同:volume_users 是卷用户权限,department_users 是部门成员 |
| dump-now 不拉新 15 张 | manifest.ts + ingest.ts 同步更新,real-e2e-test 验证 |
| 多站点 SH01 + BJ02 数据冲突 | UNIQUE(source_site_id, source_record_id) 保证,real-e2e 多 siteCode 验证 |
| 复用 /check 页导致 tab 太多(7 个) | 用户明确"优先复用",接受 7 tabs;若 7 太多后续可拆 /admin 子页 |
| 远端 GitHub 443 | HTTP/1.1 强制推送(R.83.2/R.83.3 已验证) |

---

## 7. 不变量(R.83.4 完成后必须 true)

| 不变量 | 验证 |
|---|---|
| `unified_*` 表数 ≥ 75 | `psql` COUNT |
| `ALLOWED_PACKAGE_TABLES` 数 = 73 | `pnpm test:r83.4-whitelist` |
| `DUMP_ALLOWED_TABLES` 数 = 73 | grep manifest |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 |
| 任何 `app/api/volume/**` `/api/schedule/**` 不引用 restore 库 | grep |
| 2 个 CRUD API self-check | `pnpm test:r83.4-api` |
| /check 7 个 Tabs 渲染 | `pnpm test:r83.4-ui` |
| **Task 真同步:SH01 + BJ02 独立数据,73 张表 rowCount 验证** | `pnpm test:r83.4-e2e` |
| 治理矩阵 15 行 R.83.4 标记 | grep |
| R.83.4 requirements review | 产出文件 |
| 主分支未污染 | `git log main..codex/center-db-governance` |