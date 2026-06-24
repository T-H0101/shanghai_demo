# Sprint R.83.2 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3.1 同步范围
- REQ-3.1 账号管理(基础设施前置)
- REQ-3.2 权限管理
- REQ-6.2.1 安全配置(敏感字段标注,本轮标 blocker 未修)
- REQ-6.3.3 PG17 中心库兼容与可维护性

## 2. Requirement 原始文本

> 同步范围: 设备信息 / 文件索引信息 / 权限信息 / 任务信息 — 同步数据需做增量过滤,仅同步变更数据。
> 账号管理: 基于 Site(站点)的账号管理,支持账号关联多个 Site。
> 权限管理: 角色、权限点、角色-权限关联,支持权限分配。
> 安全需求: 数据库敏感字段(如账号密码)采用不可逆加密。
> 兼容性: 兼容 PG 17+ 版本,支持原有数据库结构。

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.2/01-rbac-dict-log-tables.sql` | 新建 | 15 张 unified_* 表 DDL(RBAC + 字典 + 日志 + 凭据族) |
| `databases/sprint-r83.2/__tests__/ddl-self-check.ts` | 新建 | DDL 自检脚本(15 张 + 6 列标准 + UNIQUE + GIN + B-tree + COMMENT) |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 把 R.83.2 DDL 加入迁移链(R.83.1 之后) |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 28 → 43 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 个新 dispatcher handler;inlineUpsert 复用 R.83.1 模式 |
| `app/api/rbac/roles/route.ts` | 新建 | CRUD: roles + role_fucs + fucs + user_mfas 联合资源 |
| `app/api/rbac/dicts/route.ts` | 新建 | CRUD: dict_categories + dicts + dict_items + archives_types + archives_levels + platform_types |
| `app/api/rbac/logs/route.ts` | 新建 | GET only: sys_logs + api_logs + api_interfaces |
| `app/api/rbac/credentials/route.ts` | 新建 | CRUD: credible_proves + credible_verifies |
| `app/api/rbac/users-mfa/route.ts` | 新建 | CRUD: user_mfas(独立子资源) |
| `app/api/rbac/__tests__/self-check.ts` | 新建 | 5 端点 self-check(26 checks) |
| `components/rbac/role-permissions-tab.tsx` | 新建 | 角色权限 tab(read-only) |
| `components/rbac/dictionaries-tab.tsx` | 新建 | 字典 tab(read-only) |
| `components/rbac/logs-credentials-tab.tsx` | 新建 | 日志与凭据 tab(read-only) |
| `components/rbac/__tests__/self-check.ts` | 新建 | 3 tab UI + API smoke(25 checks) |
| `app/users/page.tsx` | 修改 | 加 3 个 Tabs(角色权限 / 字典 / 日志与凭据) |
| `scripts/audit/center-db-integrity.ts` | 修改 | round 字段升级为实时查 ALLOWED_PACKAGE_TABLES 仓储 + doc override |
| `scripts/audit/__tests__/matrix-round-source.ts` | 新建 | matrix round 字段 self-check(14 checks) |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 修改 | 15 行 `round=R.83.2` 标记 + 桶分布表更新 |
| `docs/superpowers/specs/2026-06-23-r83-2-rbac-onboard-design.md` | 新建 | 设计文档 |
| `docs/superpowers/plans/2026-06-23-r83-2-rbac-onboard.md` | 新建 | 实施 plan |
| `scripts/test-r83.2-whitelist.ts` | 新建 | 白名单 43 项自检(8 checks) |
| `README.md` | 修改 | §5.3.6 R.83.2 入口 |
| `docs/summary/PROJECT_STATUS.md` | 修改 | R.83.2 段 |
| `docs/summary/ROADMAP.md` | 修改 | R.83 中心库治理段 |
| `package.json` | 修改 | 加 `test:r83.2-whitelist` `test:r83.2-api` `test:r83.2-ui` `test:matrix-round` |

## 4. Backend Reality(真后端 + SQL 证据)

**15 张新表全部就位**(实查统一库):

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'unified_dict_categories','unified_dicts','unified_dict_items','unified_sys_logs','unified_api_logs',
  'unified_api_interfaces','unified_user_mfas','unified_archives_types','unified_archives_levels',
  'unified_platform_types','unified_fucs','unified_roles','unified_role_fucs','unified_credible_proves',
  'unified_credible_verifies'
) ORDER BY table_name;"
# 实际 15 张
```

**6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN 索引 + synced_at NOT NULL**:`pnpm exec tsx databases/sprint-r83.2/__tests__/ddl-self-check.ts` 跑通 **15/15 PASS**,exit 0。

**15 个 dispatcher handler 全部就位 + tsc clean + smoke:sync pass**:

```bash
pnpm exec tsc --noEmit        # clean
pnpm smoke:sync               # Sync smoke passed, 1 task + 1 device
pnpm audit:center-db -- --strict --matrix
# 20 checks, 0 fail, 2 warn (大表 + 125 张未分类 tbl_*,后续 R.83.3+ 推)
```

**5 个 CRUD API 真后端**(实查 self-check 结果):

```bash
pnpm test:r83.2-api
# Summary: 26/26 PASS, 0 FAIL
# 5 端点 × 5 happy-path + logs 仅 GET = 26 checks 全过
```

**3 个 UI Tabs 真渲染**(实查 /users 页面 HTML):

```bash
pnpm test:r83.2-ui
# Summary: 25/25 PASS, 0 FAIL
# 5 tab trigger 文字 + API 200 + 无误导措辞 + 无 restore_db ref = 25 checks 全过
```

**audit matrix 实时查仓储**:

```bash
pnpm test:matrix-round
# Summary: 14 PASS, 0 FAIL
# 15 R.83.2 + 15 R.83.1 + 13 already round 字段全部正确
```

## 5. UI Reality(`/users` 页面)

- 顶部 5 个 Tab:`统一用户视图 | Auth 账号管理 | 角色权限 | 字典 | 日志与凭据`
- 新增 3 个 Tab 内部:
  - `RolePermissionsTab` — 顶部 `角色权限 (N)` + 刷新按钮;表格列:站点 / 源记录 ID / 角色名 / 同步时间;数据源:`/api/rbac/roles`
  - `DictionariesTab` — 顶部 `字典 (N)` + 刷新按钮;表格列:站点 / 源记录 ID / 字典名 / 字典值 / 同步时间;数据源:`/api/rbac/dicts`
  - `LogsCredentialsTab` — 顶部 `日志与凭据 (N)` + 刷新按钮;表格列:站点 / 源记录 ID / 日志级别 / 模块 / 消息 / 时间;数据源:`/api/rbac/logs`(GET only)
- 空态:`暂无数据。从 /sites 触发同步后会显示。`
- 底部 footer 提示数据源列表(3-6 张统一表)
- **未声称任何虚假完成**:
  - 无"已禁用" / "已暂停" / "已修复" / "控制成功" / "暂停成功" 等误导措辞(grep 0 命中)
  - 任务控制按钮不在 R.83.2 范围(暂停/恢复/巡检/热恢复仍是 audit + queue 框架,本 Sprint 不涉及)
  - 站点 SSO / 启用/禁用 按钮保持 disabled(沿用 R.5 规范)

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | 全部走真中心库 |
| Simulator | 无 | — |
| DRY_RUN | 无 | 本 Sprint 不涉及清理,无 DRY_RUN 需求 |
| 真控制 | **部分** | CRUD API 真后端(中心库 upsert/delete/select 真支持),但**仅 UI 列表展示**,不暴露 CRUD 按钮给用户(只读 tab,符合 §R.5 规范) |

> 注意:本 Sprint **不**涉及任务暂停/恢复/巡检/热恢复等控制执行(那部分 R.83 后续轮或独立 Sprint 处理)。

## 7. Missing Pieces(不隐藏)

1. **98 张 `R.83.3+` 业务表未接入**(当前 whitelist 43 / 候选业务表 ~141): R.83.3+ 后续轮每轮推 15 张
2. **29 张 tbl_file_* / tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **UI 是只读列表,无 CRUD 弹窗**: 设计上 API 支持 CRUD,但 UI 仅暴露 GET(避免假按钮 + 与 R.5 规范一致);用户实际操作仍可 curl 调通;后续 Sprint 按需加表单
4. **敏感字段 `mfa_secret` / `prove_value` 走中心库 raw_data 未加密**: `audit:center-db` 当前 `SENSITIVE_RAW_KEYS` 未含这两个 key;`mfa_secret` 已存在于 `tbl_user_mfa` 列;`prove_value` 已存在于 `tbl_credible_prove` 列;本轮标 `blocked_by_security`,后续 R.83.3 改造为 hash 存储
5. **站点 CRUD / SSO 跳转仍 `blocked_by_site_change + blocked_by_auth`**: 沿用 R.83.1 状态
6. **`e2e:site-agent-sync` pre-existing 失败**: 与本 Sprint 改动无关 — `PackageTransportError: HTTP 207 partial` 出现在 R.83.1 commit 之前已存在的代码路径(`lib/site-agent/sync/package-transport.ts:83`),需要独立 Sprint 排查

## 8. Blocker Type

- `partial`(15 张表接入基础设施完成,req 状态不变)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 98 张 R.83.3+ 业务表: `blocked_by_source_schema`(需逐张确认业务语义后再接入)
- 敏感字段 `mfa_secret` / `prove_value`: `blocked_by_security`(本轮未加密,需 R.83.3 改造)
- 站点 CRUD / SSO / 任务控制: `blocked_by_site_change + blocked_by_auth`

## 9. 需要的源端 schema / 站点 API 变更清单

R.83.2 自身**不需要**站点侧 schema 改动(走的是 pg_dump + dispatcher 已有路径)。

如果后续要把 98 张未分类表接入,需要领导/站点运维配合:

| 变更项 | 涉及 | 阻塞表数 |
|---|---|---|
| 提供 `tbl_check_*` 业务语义文档 | tbl_check_task / tbl_check_category / tbl_check_files 等 | ~20 张 |
| 提供 `tbl_volume_*` 业务语义文档 | tbl_volume_group / tbl_volume_workspace / tbl_volume_dataclass 等 | ~15 张 |
| 提供 `tbl_data_receive_*` 业务语义文档 | tbl_data_receive_log / tbl_data_receive_list / tbl_data_receive_tasks | ~10 张 |
| 提供 `tbl_early_warning_*` 业务语义文档 | tbl_early_warning / tbl_early_warning_feedback | ~5 张 |
| 提供剩余 `tbl_*` 业务语义 | 其他 tbl_slot_file_* / tbl_buffer_dir / tbl_escape 等 | ~48 张 |
| `tbl_user_mfa.mfa_secret` 改为 hash 存储 | `tbl_user_mfa` | 安全合规 |
| `tbl_credible_prove.prove_value` 改为 hash 存储 | `tbl_credible_prove` | 安全合规 |

## 10. Verdict

**`partial`**

本 Sprint 完成了 15 张 RBAC/字典/日志/凭据族业务表从 0 → 43 白名单的真实接入,5 个 CRUD API + 3 个 UI Tabs + audit matrix 实时查仓储 + 治理矩阵文档化全部落地。本 Sprint **不**声称:
- 170 张表全部接入(实际 43/170 = 25.3%)
- 控制命令真实闭环(仍是 audit + queue)
- 站点 CRUD/SSO 完成
- 任务暂停/恢复/巡检/热恢复完成
- UI CRUD 弹窗(API 真支持,UI 仅列表)

按 §附录 B 完成度公式:

- 严格完成(真后端+真 UI+真测试):req 状态**未升级**(沿用 R.83.1 partial 状态)
- 候选完成(代码落地但生产条件不具备):REQ-2.3.1 由 28/170 partial → 43/170 partial,数字层面有进展
- 后续 Sprint: R.83.3+ 推剩余 ~98 张业务小表 + 敏感字段 hash 改造;R.84+ 推大表走 ES

### e2e:site-agent-sync pre-existing 失败说明

`pnpm e2e:all` 包含 11 个 e2e,其中 `e2e:site-agent-sync` 在本 Sprint commit 前已失败(`PackageTransportError: HTTP 207 package partial`,失败位置 `lib/site-agent/sync/package-transport.ts:83`)。这个失败与 R.83.2 工作无关,属于既有遗留问题,需要独立 Sprint 排查。**本 Sprint 不掩盖、不伪造**。

---

## 11. 不变量(本 Sprint 完成后必须为 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `unified_*` 表数 ≥ 43 | `psql ... -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'unified_%'"` | ✅ 45 表 |
| `ALLOWED_PACKAGE_TABLES` 数 = 43 | `pnpm test:r83.2-whitelist` | ✅ 8/8 PASS |
| `pnpm audit:center-db --strict --matrix` exit 0 | 命令本身 | ✅ 20 checks, 0 fail, 2 warn(预期) |
| 任何 `app/api/rbac/**` 不引用 restore_db | grep 检查 | ✅ 0 命中 |
| 任何 `components/rbac/**` 不引用 restore_db | grep 检查 | ✅ 0 命中 |
| 5 个 CRUD API self-check 全过 | `pnpm test:r83.2-api` | ✅ 26/26 PASS |
| 3 个 tab UI self-check 全过 | `pnpm test:r83.2-ui` | ✅ 25/25 PASS |
| matrix round 字段实时查 | `pnpm test:matrix-round` | ✅ 14/14 PASS |
| 治理矩阵文档 15 行 R.83.2 标记 | `grep -c "R.83.2 |" docs/database-analysis/r83-170-table-governance-matrix.md` | ✅ 15 |
| R.83.2 requirements review 产出 | 本文件 | ✅ |
| 主分支未污染 | `git log main..codex/center-db-governance` | ✅ 9 commits ahead |
| 后续 R.83.x 模板可直接复用 | spec/plan/commit 模式 | ✅ Task 1-9 都可作 R.83.3 模板 |