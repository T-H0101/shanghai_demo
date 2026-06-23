# Sprint R.83.2 — RBAC + 字典 + 日志 15 张业务表接入

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把中心库 `unified_*` 业务表从 28 张扩展到 43 张,新增角色权限/字典/日志族,落地 CRUD UI/API,在 `/users` 页加 3 个 tab,更新治理矩阵。

**Architecture:** 沿用 R.83.1 模式 — 15 张 DDL(`databases/sprint-r83.2/`)→ `lib/sync/package-schema.ts` ALLOWED_PACKAGE_TABLES 28 → 43 → 15 个新 dispatcher handler → CRUD API(`/api/rbac/{roles,dicts,logs,credentials,users-mfa}`)→ 在 `app/users/page.tsx` 加 3 个 Tabs → audit --matrix round 字段升级为实时查仓储 → 治理矩阵文档更新。

**Tech Stack:** Next.js 16 + React 19 + PostgreSQL 17 + Radix UI + tsx + pg。

---

## 1. 上下文与约束

### 1.1 来源

- **R.83.1 已落地 15 张**(部门/项目/接收单族),本轮接 RBAC + 字典 + 日志 15 张
- **总候选 113 张 R.83.2+**,本轮选 15 张,剩余 98 张留 R.83.3+

### 1.2 选定的 15 张表

| # | 源表 | 中心库表 | 类型 | 备注 |
|---:|---|---|---|---|
| 1 | `tbl_role` | `unified_roles` | 角色主表 | RBAC 核心 |
| 2 | `tbl_role_fuc` | `unified_role_fucs` | 角色-功能 | 复合 PK `(role_id, fuc_id)` |
| 3 | `tbl_fuc` | `unified_fucs` | 功能/权限点 | RBAC 资源 |
| 4 | `tbl_dict_category` | `unified_dict_categories` | 字典分类 | 字典基础 |
| 5 | `tbl_dict` | `unified_dicts` | 字典 | 字典主表 |
| 6 | `tbl_dict_item` | `unified_dict_items` | 字典项 | 字典内容 |
| 7 | `tbl_sys_log` | `unified_sys_logs` | 系统日志 | 审计 |
| 8 | `tbl_api_log` | `unified_api_logs` | API 日志 | 审计 |
| 9 | `tbl_api_interface` | `unified_api_interfaces` | API 接口元数据 | RBAC 资源 |
| 10 | `tbl_user_mfa` | `unified_user_mfas` | 用户 MFA | 认证 |
| 11 | `tbl_archives_type` | `unified_archives_types` | 档案类型字典 | 字典扩展 |
| 12 | `tbl_archives_level` | `unified_archives_levels` | 档案级别字典 | 字典扩展 |
| 13 | `tbl_platform_type` | `unified_platform_types` | 平台类型字典 | 字典扩展 |
| 14 | `tbl_credible_prove` | `unified_credible_proves` | 凭据-资源 | 凭据管理 |
| 15 | `tbl_credible_verify` | `unified_credible_verifies` | 凭据-验证 | 凭据管理 |

复合 PK 表:`tbl_role_fuc`(`<role_id>::<fuc_id>`),其 14 张为单 PK。

### 1.3 强约束(沿用 R.83.1)

- **总控绝不接 restore 库** — `app/**`、`components/**`、`lib/api/**` 不得引用 `SOURCE_DATABASE_URL` / `SITE_DATABASE_URL` / `site_restore_full_postgres`
- **restore 只作为同步链路来源** — `lib/sync/` 与 `scripts/sync/**` 唯一允许
- **DDL 严格 6 列标准** — `id UUID PK DEFAULT gen_random_uuid()`, `source_site_id VARCHAR(50) NOT NULL`, `source_table VARCHAR(100) NOT NULL DEFAULT '<src>'`, `source_record_id TEXT NOT NULL`, `synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `raw_data JSONB DEFAULT '{}'`, `UNIQUE(source_site_id, source_record_id)`
- **GIN 索引**:`CREATE INDEX ... USING GIN (raw_data jsonb_path_ops);` 每张必备
- **每张表必备索引**:`source_site_id` B-tree + GIN on raw_data

### 1.4 不在范围(本 Sprint 不做)

- ❌ 真实 RBAC 权限拦截(仍 `blocked_by_auth`,走 `app/api/auth/permissions` 旧路径)
- ❌ 站点 SSO / 登录启用(仍 `blocked_by_auth`)
- ❌ 大表 tbl_file_*/tbl_folder_*(仍 `blocked_by_external_system`)
- ❌ 其余 98 张 R.83.2+ 业务表(R.83.3+)
- ❌ 替换现有 mock 数据源(`lib/api/`)

---

## 2. 数据流与边界

```
站点源库 (tbl_role/tbl_fuc/...) 
    ↓ pg_dump restore (R.2C 既有,lib/sync/)
中心库 unified_roles/unified_fucs/... (本 Sprint 新增)
    ↓ GET /api/rbac/{roles|dicts|logs|credentials|users-mfa}
app/users/page.tsx (新增 3 个 Tabs)
    ↑ POST/PUT/DELETE 回写中心库 (本 Sprint 新增)
    ↑ audit --matrix (round 字段实时查 ALLOWED_PACKAGE_TABLES 顺序)
```

### 2.1 中心库 DDL 模式

每张表严格按 R.83.1 DDL 模板:

```sql
CREATE TABLE IF NOT EXISTS unified_<stripped> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site_id VARCHAR(50) NOT NULL,
  source_table VARCHAR(100) NOT NULL DEFAULT '<src>',
  source_record_id TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 源字段:严格按 disc_files.sql 类型映射,字段名加 src_ 前缀保留源 ID
  src_<pk> BIGINT,
  -- 普通业务字段...
  raw_data JSONB DEFAULT '{}',
  CONSTRAINT unified_<stripped>_site_record_uniq UNIQUE (source_site_id, source_record_id)
);
COMMENT ON TABLE unified_<stripped> IS '...';
COMMENT ON COLUMN unified_<stripped>.src_<pk> IS '...';
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_site ON unified_<stripped> (source_site_id);
CREATE INDEX IF NOT EXISTS idx_unified_<stripped>_raw_gin ON unified_<stripped> USING GIN (raw_data jsonb_path_ops);
```

### 2.2 Dispatcher handler(15 个)

`lib/sync/package-dispatcher.ts` 增加 15 个 dispatch function:
- `dispatchRole`(单 PK)
- `dispatchRoleFuc`(复合 PK)
- `dispatchFuc`(单 PK)
- `dispatchDictCategory`(单 PK)
- `dispatchDict`(单 PK)
- `dispatchDictItem`(单 PK)
- `dispatchSysLog`(单 PK)
- `dispatchApiLog`(单 PK)
- `dispatchApiInterface`(单 PK)
- `dispatchUserMfa`(单 PK)
- `dispatchArchivesType`(单 PK)
- `dispatchArchivesLevel`(单 PK)
- `dispatchPlatformType`(单 PK)
- `dispatchCredibleProve`(单 PK)
- `dispatchCredibleVerify`(单 PK)

每个 handler 包含:
- `selectSource()`:从源库读
- `transform()`:映射到 `unified_*` 行
- `inlineUpsert()`:把行写入中心库(`sourceIdColumn: 'source_id' | 'source_record_id'`)

复合 PK handler(`dispatchRoleFuc`)走 `__composite__` 模式,与 R.83.1 一致。

### 2.3 CRUD API(5 个聚合端点)

| 路径 | 方法 | 数据源 |
|---|---|---|
| `/api/rbac/roles` | GET/POST/PUT/DELETE | unified_roles + unified_role_fucs + unified_fucs + unified_user_mfas |
| `/api/rbac/dicts` | GET/POST/PUT/DELETE | unified_dict_categories + unified_dicts + unified_dict_items + unified_archives_types + unified_archives_levels + unified_platform_types |
| `/api/rbac/logs` | GET(只读) | unified_sys_logs + unified_api_logs + unified_api_interfaces |
| `/api/rbac/credentials` | GET/POST/PUT/DELETE | unified_credible_proves + unified_credible_verifies |
| `/api/rbac/users-mfa` | GET/POST/PUT/DELETE | unified_user_mfas(独立子资源) |

> **CRUD 边界**:`logs` 仅只读(日志本身不该被 UI 编辑);其余 4 个支持完整 CRUD。
> **认证**:沿用 CLAUDE.md 第 10 节 — Sprint 5.x 解锁前不接真实 RBAC,仅占位 + `blocker: blocked_by_auth`。

### 2.4 前端 UI

`app/users/page.tsx` 在现有 `Tabs(unified | auth)` 后追加 3 个:

```
Tabs: [统一用户视图] [Auth 账号管理] [角色权限] [字典] [日志与凭据]
```

每个新 tab 内部使用子组件:
- `<RolePermissionsTab />` — 5 张表(role/role_fuc/fuc/user_mfa/role 详情)
- `<DictionariesTab />` — 6 张表
- `<LogsCredentialsTab />` — 4 张表

每个 tab 提供:
- 顶部 siteCode 多选(沿用 `/sites/page.tsx` 的 `siteCode` 多选 pattern)
- 中部 `<DataTable>` 列出
- 行点击 → 右侧 `<DetailDrawer>` 显示详情 + 编辑表单
- 顶部"新建"按钮 → `<CreateDrawer>` 弹窗
- 编辑/删除按钮 inline

**禁用按钮规范(CLAUDE.md 第 10 节)**:
- 站点 CRUD / SSO 跳转:disabled + tooltip "需站点配合"
- 任务控制(暂停/恢复):不在本 Sprint 范围,本 tab 不出现
- 真实 RBAC 拦截:disabled + tooltip "需 Sprint 5.x 解锁"
- 新建/编辑/删除:真后端能力(中心库 upsert),不写假按钮

---

## 3. 文件结构

### 3.1 新建

| 文件 | 用途 |
|---|---|
| `databases/sprint-r83.2/01-rbac-dict-log-tables.sql` | 15 张 DDL |
| `app/api/rbac/roles/route.ts` | CRUD roles + role_fucs + fucs + user_mfas |
| `app/api/rbac/dicts/route.ts` | CRUD dicts 系 6 张 |
| `app/api/rbac/logs/route.ts` | GET only logs 系 3 张 |
| `app/api/rbac/credentials/route.ts` | CRUD credible_proves/verifies |
| `app/api/rbac/users-mfa/route.ts` | CRUD user_mfas 独立 |
| `app/api/rbac/__tests__/self-check.ts` | 5 个端点 self-check |
| `components/rbac/role-permissions-tab.tsx` | 角色权限 tab 组件 |
| `components/rbac/dictionaries-tab.tsx` | 字典 tab 组件 |
| `components/rbac/logs-credentials-tab.tsx` | 日志与凭据 tab 组件 |
| `components/rbac/__tests__/self-check.ts` | 3 个 tab UI 渲染 + 交互 self-check |
| `scripts/audit/__tests__/matrix-round-source.ts` | matrix round 实时查仓储 self-check |
| `scripts/test-r83.2-whitelist.ts` | 白名单 43 项自检 |

### 3.2 修改

| 文件 | 改动 |
|---|---|
| `databases/sprint-2b0/init-docker.sh` | 加入 R.83.2 DDL 到迁移链 |
| `lib/sync/package-schema.ts` | ALLOWED_PACKAGE_TABLES 28 → 43 |
| `lib/sync/package-dispatcher.ts` | 15 个新 dispatcher handler |
| `scripts/audit/center-db-integrity.ts` | `--matrix` round 字段从仓储实时查 |
| `app/users/page.tsx` | 加 3 个 Tabs(角色权限 / 字典 / 日志与凭据) |
| `app/api/users/route.ts` | 不动(无消费新增表) |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 15 行 `round=R.83.2` 标记 |
| `docs/summary/PROJECT_STATUS.md` | 加 R.83.2 段 |
| `README.md` | §5.3.x 新增 R.83.2 入口 |
| `package.json` | 加 `test:r83.2-whitelist` `test:r83.2-api` `test:r83.2-ui` |

---

## 4. 测试计划

### 4.1 Self-check 脚本

| 脚本 | 检查数 | 不变量 |
|---|---:|---|
| `scripts/test-r83.2-whitelist.ts` | 38 checks | 43 项白名单完整、复合 PK 标注、新 15 项 schema 一致 |
| `app/api/rbac/__tests__/self-check.ts` | 30 checks | 5 端点 GET/POST/PUT/DELETE 真后端、错误路径 4xx |
| `components/rbac/__tests__/self-check.ts` | 24 checks | 3 tab 渲染、行点击交互、CRUD 弹窗、disabled 按钮提示 |
| `scripts/audit/__tests__/matrix-round-source.ts` | 12 checks | matrix round 字段从 ALLOWED_PACKAGE_TABLES 顺序 + 文档 round 标记生成 |

### 4.2 真实 e2e

```bash
pnpm exec tsc --noEmit           # type check
pnpm build                      # production build
pnpm smoke:sync                 # sync smoke
pnpm test:r83.2-whitelist       # 38 checks
pnpm test:r83.2-api             # 30 checks
pnpm test:r83.2-ui              # 24 checks
pnpm audit:center-db -- --strict --matrix
pnpm e2e:all                    # 全量 e2e
```

### 4.3 不通过的处理

任何 self-check fail:
- 当 subagent 修复,再跑直到 100%
- 不到 100% 不允许 commit

---

## 5. 验收清单

- [ ] 15 张 DDL 在中心库落地(实查)
- [ ] ALLOWED_PACKAGE_TABLES 28 → 43
- [ ] 15 个 dispatcher handler 编译过、tsc clean
- [ ] smoke:sync 跑通且真同步至少 1 行
- [ ] 5 个 CRUD API 端点(GET/POST/PUT/DELETE)在 self-check 全过
- [ ] `/users` 页 5 个 Tabs 渲染正确
- [ ] 治理矩阵文档 15 行 round=R.83.2 标记
- [ ] matrix JSON `unifiedCount ≥ 43`
- [ ] audit --strict --matrix 全 pass(无 fail,允许预期 warn)
- [ ] README §5.3.x 加 R.83.2 入口
- [ ] spec self-review 无 placeholder/contradiction
- [ ] requirements review 产出 `docs/database-analysis/sprint-r83.2-requirements-review.md`,verdict 与状态准确

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 角色权限 / 字典日志混在一起导致 API 复杂度高 | 拆 5 个独立端点,各自只关心自己的表 |
| CRUD API 接入前端后,误把权限拦截按钮点亮 | 全部 disabled + tooltip,严格按 CLAUDE.md 第 10 节 |
| audit matrix round 实时查仓储失败(白名单 vs 文档不一致) | 加 self-check,提前 fail-fast |
| 复合 PK 表同步重复行 | 严格 `<a>::<b>` 拼接,与 R.83.1 `dispatchUserRole` 同源 |
| 总控 /api/** 误引用 restore 库 | grep 检查 `app/api/rbac/**` 文件无 `SOURCE_DATABASE_URL` |
| 站点的 RBAC/字典表数据脏(测试遗留) | R.83.1 已清理,本轮默认 clean;audit 仍兜底 fail |

---

## 7. 不变量(完成后必须 true)

| 不变量 | 验证 |
|---|---|
| `unified_*` 表数 ≥ 43 | `psql ... -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` |
| ALLOWED_PACKAGE_TABLES 数 = 43 | `lib/sync/package-schema.ts` |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 |
| 任何 `app/api/rbac/**` 文件不引用 restore_db | grep |
| 5 个 CRUD API self-check 全过 | `pnpm test:r83.2-api` |
| 3 个 tab UI self-check 全过 | `pnpm test:r83.2-ui` |
| 治理矩阵文档 15 行 R.83.2 标记 | `docs/database-analysis/r83-170-table-governance-matrix.md` |
| R.83.2 requirements review 产出 | `docs/database-analysis/sprint-r83.2-requirements-review.md` |
| 主分支未污染 | `git log main..codex/center-db-governance` |