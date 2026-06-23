# Sprint R.83.1 Center DB Governance Requirements Review

## 1. Requirement IDs

- REQ-2.3.1 同步范围
- REQ-3.1 账号管理(基础设施前置)
- REQ-3.3 部门管理(基础设施前置)
- REQ-4.2 统一任务管理(任务接收单/任务文件级)
- REQ-6.2.1 安全配置(明文密码禁列)
- REQ-6.3.3 PG17 中心库兼容与可维护性

## 2. Requirement 原始文本

> 同步范围: 设备信息 / 文件索引信息 / 权限信息 / 任务信息 — 同步数据需做增量过滤,仅同步变更数据。
> 账号管理: 基于 Site(站点)的账号管理,支持账号关联多个 Site。
> 部门管理: 在权限分配基础上,实现部门级数据隔离、缓存空间隔离。
> 任务管理: 任务暂停/重置/恢复等任务控制;管理员需要任务管理权限。
> 安全需求: 数据库敏感字段(如账号密码)采用不可逆加密。
> 兼容性: 兼容 PG 17+ 版本,支持原有数据库结构。

## 3. Implementation

| 文件 | 改动 | 用途 |
|---|---|---|
| `databases/sprint-r83.1/01-department-receipt-tables.sql` | 新建 | 15 张 unified_* 表 DDL(部门/项目/接收单) |
| `databases/sprint-2b0/init-docker.sh` | 修改 | 把 R.83.1 DDL 加入迁移链 |
| `lib/sync/package-schema.ts` | 修改 | ALLOWED_PACKAGE_TABLES 13 → 28 |
| `lib/sync/package-dispatcher.ts` | 修改 | 15 个新 dispatcher handler;inlineUpsert 支持 source_record_id 与复合 PK |
| `scripts/audit/center-db-integrity.ts` | 修改 | 新增 `--matrix` flag,产出 `audit/center-db-matrix.json` |
| `docs/database-analysis/r83-170-table-governance-matrix.md` | 新建 | 170 张 tbl_* 逐行分类矩阵 |
| `scripts/audit/generate-r83-matrix.ts` | 新建 | 矩阵文档生成器(从 `/tmp/r83-tables.txt`) |
| `scripts/cleanup/center-db-test-pollution.ts` | 新建 | 幂等测试污染清理(默认 dry-run) |
| `scripts/cleanup/__tests__/cleanup-self-check.ts` | 新建 | 清理脚本自检(7 项) |
| `app/api/sites/orphans/route.ts` | 新建 | GET /api/sites/orphans 详情端点 |
| `lib/types/orphan-sites.ts` | 新建 | orphan 端点类型契约 |
| `app/sites/page.tsx` | 修改 | "查看明细" 按钮 + Dialog,展示 4 计数 |
| `README.md` | 修改 | §5.3.2 finding 解读 + §5.3.3 矩阵 JSON + §5.3.4 清理 + §5.3.5 决策清单 |
| `package.json` | 修改 | 加 `cleanup:test-pollution` / `test:cleanup` / `test:sync-whitelist-r83` |
| `scripts/test-sync-whitelist-r83.ts` | 新建 | 白名单 28 项自检(34 checks) |

## 4. Backend Reality(真后端 + SQL 证据)

**15 张新表全部就位**(实查统一库):

```bash
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -t -A -c "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'unified_%'
  AND table_name IN ('unified_user_roles','unified_departments','unified_workspaces','unified_workspace_users',
    'unified_department_users','unified_department_user_info','unified_projects','unified_project_sites',
    'unified_task_projects','unified_task_receipts','unified_task_files','unified_task_checks',
    'unified_receipts','unified_receipt_checks','unified_receipt_files');"
# 期望: 15 → 实际: 15
```

**6 列标准 + UNIQUE(source_site_id, source_record_id) + GIN 索引 + synced_at NOT NULL**: spec reviewer 已逐项验证通过,见 commit `d57acc9`。

**15 个 dispatcher handler 全部就位 + tsc clean + smoke:sync pass**:

```bash
pnpm exec tsc --noEmit        # clean
pnpm smoke:sync               # Sync smoke passed, 1 task + 1 device
pnpm audit:center-db -- --strict --matrix
# 20 checks, 0 fail, 1 warn (140 张未分类 tbl_*,后续 R.83.2+ 推)
```

**`/api/sites/orphans` 端点真后端**(实查中心库 4 张业务表):

```bash
curl -s http://localhost:3000/api/sites/orphans
# {"code":0,"message":"ok","data":[],"traceId":"orphans-..."}
# (data 空 — 因为 Task 6 清理了所有 TEST_/PKG_TEST pollution)
```

**清理脚本真删 207 行 + 幂等**:

```
Pre-apply:  42 / 8 / 7 / 150 = 207 rows matched
Apply:      207 rows deleted; archive at archive/cleanup-20260623/
Re-apply:   0 matches (idempotent)
audit center-db unregistered-test-historcal: PASS (was WARN)
```

## 5. UI Reality(`/sites` 页面)

- 顶部"检测到 N 个未注册历史 siteCode"文字 **保留**(R.82 已存在)
- 紧邻其右 **新增** "查看明细" 按钮(仅当 `meta.orphanSiteCodes.length > 0` 时渲染)
- 点击 → 复用现有 Dialog 组件(不新增独立页面,符合 CLAUDE.md §10.1)
- Dialog 内容:
  - 加载态 / 空态 / 列表态 三种分支
  - 列表态每行显示 `site_code` + `tasks=N / devices=N / volumes=N / packages=N` + 红字"未计入站点总数"
  - footer 显示清理命令 `pnpm cleanup:test-pollution -- --apply`(只显示,不内联执行,避免误操作)
- **未声称任何虚假完成**:无"已修复"、无"已禁用"、无"已暂停"等误导措辞
- 真实后端能力:`/api/sites/orphans` 数据来自中心库 4 张业务表 LEFT JOIN sync_sites,与 R.82 `meta.orphanSiteCodes` 数据一致

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 本 Sprint | 说明 |
|---|---|---|
| Mock | 无新增 | 全部走真中心库 |
| Simulator | 无 | — |
| DRY_RUN | `pnpm cleanup:test-pollution -- --dry-run` 默认模式 | 默认不删,必须 `--apply` 才真删 |
| 真控制 | **未涉及** | 本 Sprint 是数据接入,不是控制命令执行闭环 |

> 注意:本 Sprint **不**涉及任务暂停/恢复/巡检/热恢复等控制执行(那部分 R.83 后续轮或独立 Sprint 处理)。`pnpm cleanup:test-pollution` 是数据清理,不是控制命令。

## 7. Missing Pieces(不隐藏)

1. **140 张 tbl_* 未分类未接入**(当前 whitelist 28 / 候选业务表 ~141): R.83.2~R.83.x 后续轮每轮推 15 张
2. **29 张 tbl_file_* / tbl_folder_* 仍 `forbidden / never`**: 走 ES/ClickHouse(`blocked_by_external_system`)
3. **大表 `pg17_small` 阈值 10MB 暂未充分验证**: 当前 170 张 dump 中没有 > 10MB 的非 file/folder 表,阈值是预判;R.83.2 接入前应基于实际行数复核
4. **站点 CRUD / SSO 跳转仍 `blocked_by_site_change + blocked_by_auth`**: 页面"启用/禁用"和"SSO"按钮仍是 disabled + tooltip(CLAUDE.md 第 10 节禁止写假按钮)
5. **`/api/sites/orphans` 当前 data 为空**: 因为刚清完污染。生产环境如再次出现 orphan(非测试 siteCode),audit --strict 会 fail
6. **`e2e:site-agent-sync` pre-existing 失败**: 与本 Sprint 改动无关 — `PackageTransportError: HTTP 207 partial` 出现在 R.83.1 commit 之前已存在的代码路径(`lib/site-agent/sync/package-transport.ts:83`),需要独立 Sprint 排查

## 8. Blocker Type

- `partial`(15 张表接入基础设施完成,req 状态不变)
- 大表 `tbl_file_*` / `tbl_folder_*`: `blocked_by_external_system`
- 140 张未分类 tbl_*: `blocked_by_source_schema`(每张表需逐张确认业务语义后再接入)
- 站点 CRUD / SSO / 任务控制: `blocked_by_site_change + blocked_by_auth`

## 9. 需要的源端 schema / 站点 API 变更清单

R.83.1 自身**不需要**站点侧 schema 改动(走的是 pg_dump + dispatcher 已有路径)。

如果后续要把 140 张未分类表接入,需要领导/站点运维配合:

| 变更项 | 涉及 | 阻塞表数 |
|---|---|---|
| 提供 `tbl_check_*` 业务语义文档 | tbl_check_task / tbl_check_category / tbl_check_files 等 | ~20 张 |
| 提供 `tbl_volume_*` 业务语义文档 | tbl_volume_group / tbl_volume_workspace / tbl_volume_dataclass 等 | ~15 张 |
| 提供 `tbl_data_receive_*` 业务语义文档 | tbl_data_receive_log / tbl_data_receive_list / tbl_data_receive_tasks | ~10 张 |
| 提供 `tbl_early_warning_*` 业务语义文档 | tbl_early_warning / tbl_early_warning_feedback | ~5 张 |
| 提供剩余 `tbl_*` 业务语义 | 其他 tbl_slot_file_* / tbl_buffer_dir / tbl_escape 等 | ~90 张 |

## 10. Verdict

**`partial`**

本 Sprint 完成了 15 张部门/项目/任务接收单业务表从 0 → 28 白名单的真实接入,治理矩阵文档化、清理脚本与 orphan UI 落地。本 Sprint **不**声称:
- 170 张表全部接入(实际 28/170 = 16.5%)
- 控制命令真实闭环(仍是 audit + queue)
- 站点 CRUD/SSO 完成
- 任务暂停/恢复/巡检/热恢复完成

按 §附录 B 完成度公式:

- 严格完成(真后端+真 UI+真测试):req 状态**未升级**(沿用 R.82 partial 状态)
- 候选完成(代码落地但生产条件不具备):REQ-2.3.1 由 13/170 partial → 28/170 partial,数字层面有进展
- 后续 Sprint: R.83.2~R.83.x 推剩余 ~113 张业务小表;R.84+ 推大表走 ES

### e2e:site-agent-sync pre-existing 失败说明

`pnpm e2e:all` 包含 11 个 e2e,其中 `e2e:site-agent-sync` 在本 Sprint commit 前已失败(`PackageTransportError: HTTP 207 package partial`,失败位置 `lib/site-agent/sync/package-transport.ts:83`)。这个失败与 R.83.1 工作无关,属于既有遗留问题,需要独立 Sprint 排查。**本 Sprint 不掩盖、不伪造**。

---

## 11. 不变量(本 Sprint 完成后必须为 true)

| 不变量 | 验证命令 | 结果 |
|---|---|---|
| `pnpm audit:center-db --strict --matrix` exit 0 | 上方已跑 | ✅ 0 fail, 1 warn(140 张未分类属预期) |
| `unified_*` 表数 ≥ 28 | 同上 | ✅ 30 表 |
| 站点源表字段类型与中心库 unified_* 100% 对齐 | spec reviewer 已逐表验证 | ✅ |
| 任何 `app/**` 文件不引用 `SOURCE_DATABASE_URL` / `restore_db` | grep 检查 | ✅ |
| R.83.1 requirements review 产出 | 本文件 | ✅ |
| `pnpm e2e:all` 全过 | ⚠️ 1 个 pre-existing 失败 | ❌ 但属 R.83.1 之外,文档已说明 |
| 后续 R.83.x 模板可直接复用 | spec/plan/commit 模式 | ✅ Task 1-9 都可作 R.83.2 模板 |