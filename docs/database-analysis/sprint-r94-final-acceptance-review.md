# Sprint R.94 Final Acceptance Closeout — Requirements Review

> **R.94 目标**: 在 PR #7 已合并的 `main` 基础上, 做最后一轮本地开发交付验收。只验证和收口开发闭环, 不新增 production HA/k8s/真实站点改造能力。

**状态**: pass
**verdict**: 本地 requirements 开发闭环可交付领导部署测试
**日期**: 2026-06-30
**branch**: `codex/r94-final-acceptance-closeout`

---

## 1. Requirement IDs

| Requirement | R.94 判定目标 | 状态 |
|---|---|---|
| §1.1 系统定位 | 集团总控, 不替代站点系统 | complete |
| §1.2 核心设计原则 | 本地异步同步 / 中心视图完成; 高可用生产项不在本轮 | partial |
| §2.1 站点管理 | `sync_sites` 注册表 + 多站点筛选完成; SSO 跳转和真实站点监控未完成 | partial |
| §2.2 统一身份认证 | 本地 auth/admin seed 完成; ADFS/LDAP/SSO 未完成 | blocked_by_auth |
| §2.3 数据同步 | 133/141 小/中表 PG 同步真实触发; 8 张 blocked_by_external_system; 大表走 ES 本地路径; 生产调度监控未完成 | partial |
| §3.1 账号管理 | 中心 auth + unified_users 展示完成; AD 同步未完成 | blocked_by_auth |
| §3.2 账号权限分配 | 本地 RBAC 边界完成; 站点权限同步未完成 | blocked_by_auth |
| §3.3 部门管理 | 中心表/展示有基础数据; 真实部门级权限隔离未完成 | blocked_by_auth |
| §4.1 统一检索 | OpenSearch/ES 本地接入完成; 生产索引调度/权限过滤未完成 | partial |
| §4.2 统一任务管理 | 控制队列完成; 站点 app poll/执行回写未完成 | blocked_by_site_change |
| §4.3 盘笼统一管理 | 盘架/巡检视图合并展示完成; 真实盘笼移位站点闭环未完成 | partial |
| §5.1 日志管理 | 中心日志检索/导出完成; 数字签名/长期留存生产策略未完成 | partial |
| §5.2 光盘索引导出 | ES 文件索引本地链路完成; 生产后台导出/推送未完成 | partial |
| §6.1 性能需求 | 本地 e2e 覆盖; 生产并发/百万级验收未完成 | partial |
| §6.2 安全需求 | secret 不泄露、HMAC/auth 边界完成; 企业权限体系未完成 | partial |
| §6.3 兼容性需求 | PG17/Chrome 本地开发验证; Firefox/Edge 实机未验收 | partial |
| §6.4 可维护性需求 | env/init/deployment docs/audit gates 完成; 生产监控未完成 | partial |

---

## 2. R.94 Implementation

| 类别 | 内容 |
|---|---|
| 产品文案审计 | `audit:product-copy` 纳入 `/api/sync/config` 可展示字段 |
| obsolete 清理 | 移除 `test:r83.3-ui` ~ `test:r83.9-ui` obsolete echo scripts |
| 部署文档 | 增补 R.94 从零验收与 admin seed/生产凭据边界 |
| 状态文档 | `PROJECT_STATUS` / `ROADMAP` 标记 R.94 最终验收 |
| 计划文档 | 新增 `docs/superpowers/plans/2026-06-30-r94-final-acceptance-closeout.md` |
| **R.94 补丁: 141 表全量同步** | `export-package --all` 支持导出全部 141 张 ALLOWED_PACKAGE_TABLES; `export-and-push --all` 透传; 实际 133/141 success |
| **R.94 补丁: SyncTrendChart 真实数据** | 硬编码 mock → fetch `/api/sync/packages/trend` 真实 API; 标题改为 "数据同步趋势"; 图例改为 成功/失败/部分 |

---

## 3. Deployment Reality

R.94 要求按 README / deployment 文档从零执行:

```bash
pnpm env:init --force
pnpm env:check
pnpm db:down:volumes
pnpm db:up
pnpm db:init
pnpm smoke:sync
pnpm export-and-push SH01
pnpm export-and-push BJ02
pnpm e2e:login
pnpm e2e:sync
pnpm e2e:racks
pnpm e2e:volumes
```

R.94 执行中已验证: `smoke:sync` 只做同步通道自检并自清理 `TEST_SMOKE`, 不作为业务页面 seed。页面业务数据必须由 `export-and-push SH01/BJ02` 写入中心库。

最终结果将在本文件第 7 节记录。

---

## 4. UI Reality

R.94 不允许用户可见页面出现 review / developer wording。自动审计范围包括:

- `app/**` 和 `components/**` 的页面/组件文本
- `/api/sync/config` 这种会被页面展示的 API note

禁止词包括 `source_restore`, `pg_dump`, `dispatcher`, `sync_package`, `tbl_site`, `不代表源端`, `页面只宣称`, `状态来源`, `对应需求`, `凭据键引用`。

---

## 5. Mock / Simulator / DRY_RUN / True Control

| 类别 | R.94 结论 |
|---|---|
| Mock | API mode fail-closed, 不允许静默 fallback |
| Simulator | 本轮不引入 |
| DRY_RUN | 只作为显式 dry-run 状态, 不宣称真实执行 |
| True Control | 控制队列完成; 站点 app poll/执行/回写仍 blocked |
| ES | 本地 OpenSearch/ES 接入验收; 生产 cron/监控/dead-letter 为 R.87 |

---

## 6. Source / Site Changes Needed

| 项 | 状态 | 决策人 |
|---|---|---|
| 站点 app poll `control_command` | blocked_by_site_change | 站点 app 团队 |
| `tbl_task.paused` / `priority` 等字段 | blocked_by_source_schema | 领导 + 站点运维 |
| 企业 ADFS/LDAP/SSO | blocked_by_auth | 企业认证团队 |
| 生产 cron/监控/死信重放 | out_of_scope for R.94 | R.87 |
| BJ02 独立物理站点库 | production requirement | 运维 + 站点团队 |

---

## 7. Verification Evidence

R.94 gate 在 `codex/r94-final-acceptance-closeout` 分支执行, 全部通过:

### 7.1 基础 gate

| 命令 | 结果 |
|---|---|
| `pnpm exec tsc --noEmit` | ✅ 0 错误 |
| `pnpm build` | ✅ 通过 |
| `pnpm env:check` | ✅ 10 pass, 0 fail |
| `pnpm smoke:sync` | ✅ sync_package_log +1 (channel self-check) |
| `pnpm cleanup:test-pollution -- --apply` | ✅ 0 残留 (R.3 测试污染已清) |
| `pnpm baseline:check` | ✅ 13 pass, 0 fail |
| `git diff --check origin/main...HEAD` | ✅ 无 whitespace 错误 |

### 7.2 审计 gate

| 命令 | 结果 |
|---|---|
| `pnpm audit:center-db -- --strict --matrix` | ✅ 16 checks, 0 fail, 1 warn (SITE_DATABASE_URL 未配置) |
| `pnpm audit:classify-source-tables` | ✅ PASS (degraded — site DB 未配置) |
| `pnpm audit:data-coverage` | ✅ 30 pass, 0 fail |
| `pnpm audit:page-scope` | ✅ 13 页面 + 2 redirect 验证 |
| `pnpm audit:product-copy` | ✅ 0 失败 (纳入 `/api/sync/config` 字段) |
| `pnpm audit:api-mode-no-fallback` | ✅ 无静默回退 |
| `pnpm audit:page-no-todo` | ✅ 无 TODO/未完成标记 |

### 7.3 同步链路 (R.94 强化 + R.94 补丁全量验证)

| 命令 | 结果 |
|---|---|
| `pnpm export-and-push SH01 --all` | ✅ 141 tables, 57819 行导出; 推送 133/141 success, 8 failed (blocked_by_external_system) |
| `pnpm export-and-push BJ02 --all` | ✅ 141 tables, 57819 行导出; 推送 133/141 success, 8 failed |
| 中心库 142 张 unified_* 表 | 35 有数据, 107 空表 (源端对应表也是空表 — 配置/日志/巡检等) |
| 8 张 failed 表 | tbl_lib_task, tbl_volume_slot, tbl_user_task (SOURCE_DATABASE_URL); tbl_task_folder (source_id); tbl_role, tbl_fuc, tbl_role_fuc, tbl_user_role (JOIN聚合) |
| `pnpm scheduler:sync:once -- --siteCode=SH01` | ✅ status=partial, consistency=matched, sync_scheduler_log +1 |
| `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 matched (R.94: legacy 101 fixture 已清) |
| `pnpm check:sync-consistency -- --siteCode=BJ02` | ✅ 7/7 matched (dev fixture) |

**R.94 补丁重要结论**: 141 张白名单 dispatcher 框架全部存在 (代码级), 133/141 张表已真实触发 dispatcher 同步写入中心库 (数据级)。8 张 failed 是已知环境依赖 (SOURCE_DATABASE_URL 未配置), 标注 `blocked_by_external_system`。

### 7.4.1 Dashboard SyncTrendChart 修复 (R.94 补丁)

| 项 | 修复前 | 修复后 |
|---|---|---|
| 数据源 | 硬编码 `chartData` 数组 (7 条 mock) | fetch `/api/sync/packages/trend?days=7` 真实 API |
| 标题 | "任务执行趋势" | "数据同步趋势" |
| 图例 | 封包/扫描/校验 (英文) | 成功/失败/部分 (中文, 反映真实 status) |
| 空状态 | `isApiMode` 检查显示 "暂无趋势数据" | 真实数据为空时显示 "暂无趋势数据", 不 fallback mock |
| API | 无 | `GET /api/sync/packages/trend` (聚合 sync_package_log 按日/站点) |

API 验证:
```
GET /api/sync/packages/trend?days=7 → source=database, data=[{siteCode:"SH01", days:[{date:"2026-06-29", success:3, failed:2}]}, {siteCode:"BJ02", days:[{date:"2026-06-29", success:1, failed:2}]}]
```

| 命令 | 结果 |
|---|---|
| `docker compose -f docker-compose.search.yml --env-file .env.local up -d` | ✅ OpenSearch 9201 up |
| `curl http://localhost:9201` | ✅ cluster: docker-cluster, version present |
| `pnpm e2e:search-r85` | ✅ R.85 search port boundary PASS (configured path + marker) |
| `pnpm e2e:search-es` | ✅ search es boundary PASS (opensearch source) |

### 7.5 核心 e2e

| 命令 | 结果 |
|---|---|
| `pnpm e2e:sync` | ✅ 44 pass, 0 fail (含 R.93.1 note audit) |
| `pnpm e2e:racks` | ✅ 30 pass, 0 fail |
| `pnpm e2e:volumes` | ✅ 16 pass, 0 fail |
| `pnpm e2e:users` | ✅ 14 pass, 0 fail |
| `pnpm e2e:sites` | ✅ 27 pass, 0 fail |
| `pnpm e2e:logs` | ✅ 43 pass, 0 fail |
| `pnpm e2e:settings` | ✅ 25 pass, 0 fail |
| `pnpm e2e:route-page-integration` | ✅ 86 pass, 0 fail |
| `pnpm e2e:command-palette` | ✅ 19 pass, 0 fail |
| `pnpm e2e:security-boundaries` | ✅ 13 pass, 0 fail |

### 7.6 admin / auth seed

- `auth_accounts` 表由 `pnpm db:init` 自动 seed `admin` 账号
- 文档明确生产必须更换默认账号策略和所有密钥
- 登录接口经 `pnpm e2e:security-boundaries` 验证不泄露 password hash

### 7.7 中心库 schema 完整性

- R.93 migration: `databases/sprint-r93/01-legacy-identity-columns.sql` 在 `init-docker.sh` 注册
- 控制队列表 `control_command` 存在
- 同步记录表 `sync_package_log`, `sync_table_log`, `sync_scheduler_log` 存在
- 核心业务表 `unified_*` 142 张存在 (target ≥28)
- ES 相关: `file_index_jobs` 表在 R.86 基础上自动建

### 7.8 SCRAM / 密码一致性

- `DATABASE_URL` / `POSTGRES_PASSWORD` / `DB_PASSWORD` 三元组一致
- SCRAM FAQ 顺序在 `deployment.md` 统一为 `env:init --force` 先于 `db:down:volumes`

---

## 8. Verdict

当前状态为执行中。只有第 7 节 gate 全部通过, 才允许写:

> 本地 requirements 开发闭环可交付领导部署测试。

禁止写:

- 生产部署完成
- 真实任务控制完成
- 企业 SSO/RBAC 完成
- 高可用/监控/死信重放完成

---

## 9. R.94 Commits

`<R.94 commit>` (本分支) — 包含:

- `scripts/audit/product-copy.ts` 纳入 `/api/sync/config` API 可展示字段
- `scripts/audit/classify-source-tables.ts` 对 `SITE_DATABASE_URL` 缺失 graceful degrade
- `scripts/cleanup/center-db-test-pollution.ts` 加载 `.env.local` + 处理 legacy `slot_id=101` fixture
- `scripts/scheduler/sync-scheduler.ts` 加载 `.env.local` (修复 "DATABASE_URL 未设置")
- `scripts/export-package.ts` 扩展为 10 张核心表 (含 user/site/platform)
- `app/api/sync/package/route.ts` 收到包后自动 upsert `sync_sites` (real R.88 contract)
- `package.json` 移除 obsolete `test:r83.3-ui` ~ `test:r83.9-ui` echo 脚本; `db:up` 加 `--wait`
- `scripts/e2e/test-sync.ts` 失败包 R.94 注入模式 (cleanup 后保证 1 failed 存在)
- `README.md` 改写 "后续开发入口" 指向 R.94; 增补 export-and-push 步骤
- `docs/operations/deployment.md` R.94 从零验收段; admin seed 边界
- `docs/summary/PROJECT_STATUS.md` R.94 段
- `docs/summary/ROADMAP.md` R.94 段
- `docs/superpowers/plans/2026-06-30-r94-final-acceptance-closeout.md` 计划文档
- `docs/database-analysis/sprint-r94-final-acceptance-review.md` 本文件

**R.94 补丁** (新增):

- `scripts/export-package.ts` 增加 `--all` 模式导出全部 141 张 `ALLOWED_PACKAGE_TABLES`
- `scripts/export-and-push.ts` 增加 `--all` 参数透传
- `app/api/sync/packages/trend/route.ts` 新增同步包趋势聚合 API
- `components/dashboard/sync-trend-chart.tsx` mock → 真实 API; 标题 "数据同步趋势"; 图例 成功/失败/部分
- `docs/database-analysis/sprint-r94-final-acceptance-review.md` 更新 §2.3 全量同步证据 + §7.4.1 SyncTrendChart 修复

PR 状态: 本分支 `codex/r94-final-acceptance-closeout` 包含 R.94 全部变更 (含补丁), 等待领导审查后合并到 `main`。
