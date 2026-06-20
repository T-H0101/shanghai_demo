# HANDOFF TO CODEX — 项目上下文交接总结

> **接手方**: Codex (或其他 AI agent)
> **生成日期**: 2026-06-11
> **当前最新远端 commit**: **`8a66b6c`** (`fix: review sites real data integration`)
> **本地 main**: 与 `origin/main` 一致

---

## 0. 一句话定位

本项目是**集团层统一管控平台** (Next.js 16.2.6 + React 19 + TypeScript + PostgreSQL 17), **不替代**各站点原有系统, 提供数据同步 / 统一视图 / 任务管控 / 日志管理。当前已完成同步链路 + 一致性校验 + e2e 测试基线, 但**大部分业务能力仍 blocked**。

---

## 1. 关键历史结论 (R.1 → R.9A)

### 1.1 R.1 — CLAUDE.md 上升为强约束 (2026-06-09)
- `requirements.md` 确立为**最高验收标准**
- 引入 **9 大强约束** (CLAUDE.md §一-九)
- 引入 **8 选 1 需求状态枚举** (complete / partial / not_started / blocked_by_source_schema / blocked_by_site_change / blocked_by_auth / blocked_by_external_system / out_of_scope)
- 引入 **禁止误导措辞** (R.1 §7, e.g. 不允许把 mock 说成"完成")

### 1.2 R.2 — 需求追踪矩阵 (2026-06-09)
- 43 个原子需求 × 18 字段追踪
- 初版完成率 22.0% (后被 R.3 推翻)

### 1.3 R.3 — 全链路真实性审计 (2026-06-10)
- **不要相信之前任何完成率数字**
- 重算后: **complete=7, total=45, 完成率 15.6%**
- 发现 4 个 🔴 bug: /api/tasks/[id] 404, /api/search 404, /api/sites 100% mock, executor 假执行

### 1.4 R.4 — Bug 修复周 (2026-06-10)
- 4 个 bug 全部修复
- R.2 中 out_of_scope 违规修正: REQ-2.2.2 / 3.2.1 改回 blocked_by_auth
- /api/sites 改为真实读 (database → derived)
- executor 改为真连站点库 (`status=20` paused)
- 完成率维持 15.6% (修 bug 不增能力)

### 1.5 R.5 — 前端事件测试强约束 (2026-06-10)
- CLAUDE.md §10 新增: 10 项验证 / 10 项禁止 / 9 项验收模板
- 6 个 e2e 占位脚本

### 1.6 R.6 — 前端 e2e 实施 (2026-06-10)
- 6 个 e2e 脚本真实可运行, **70/70 通过**
- 完成率维持 15.6% (修 e2e 不增能力)

### 1.7 R.7 — 数据一致性校验 Job (2026-06-10)
- `scripts/check-sync-consistency.ts` 7 表 source vs unified
- `sync_consistency_log` 表 + `GET /api/sync/consistency` API
- SH01 真实结果: 7/7 matched

### 1.8 R.7A — 一致性差异 + 控制真执行 Post-Review
- 3 个 mismatched 表全部是历史测试污染
- "任务真控制" 降级为"DB 字段写入可行, 真实执行未证实"

### 1.9 R.7B — 清理中心库污染 + Schema 基线
- 清理 13 行测试污染 (unified_tasks 7 / devices 4 / volumes 2)
- `disc_files.sql` 纳入 schema 静态基线
- 引入 5 级 Schema Source Priority (CLAUDE.md 附录 C)

### 1.10 R.7C — 同步与控制基线冻结
- `scripts/check-project-baseline.ts` 13 项自动检查
- 强制 `pnpm baseline:check` 提交前必跑

### 1.11 R.8 — 每小时自动同步与一致性校验调度器
- `scripts/scheduler/sync-scheduler.ts` (export → push → consistency → log)
- `sync_scheduler_log` 表 + `GET /api/sync/scheduler/logs` API
- 端到端 success, SH01 matched

### 1.12 R.8A-1 — R.8 Post-Review + 多站点架构确认
- e2e 78/78 (修复 R.6 遗留 1 个 fail)
- 多站点架构结论文档化 (SH01 单站点测试库, 170 表)
- `/sites` 页面**仍用 mockSites** (R.8A-1 范围不修)

### 1.13 R.9A — /sites 页面真实化 (2026-06-11)
- 页面从 `import { sites as mockSites }` 改为 `fetch /api/sites`
- 4 个写操作按钮 (注册/启用禁用/SSO/创建) 全部 disabled + toast
- 派生态: 顶部 Badge + 列表说明 + 详情 amber 框
- 一致性校验改为真实 R.7 API
- e2e:sites 9 → **22**, e2e:all 78 → **91**

### 1.14 R.9A-Review — Post-Review (2026-06-11, commit 8a66b6c)
- 7 项验证全绿
- 修正一处文档小 bug: 完成率 20.9% → **15.6%** (与 R.3/R.4/R.6/R.7 一致)
- 当前最新远端 commit = `8a66b6c`

---

## 2. requirements 完成率 (R.3/R.4/R.9A-Review 口径)

```
complete: 7 (15.6%)
partial: 13 (28.9%)
not_started: 8 (17.8%)
blocked_by_source_schema: 6 (13.3%)
blocked_by_site_change: 5 (11.1%)
blocked_by_auth: 9 (20.0%)
blocked_by_external_system: 2 (4.4%)
out_of_scope: 0 (0%)
─────────────────────────────────
total: 45
公式: complete / (total - out_of_scope) × 100% = 7/45 = 15.6%
```

**🚨 强约束**:
- ❌ **不允许**写 `20.9%` (R.9A 初版错误, 已修)
- ❌ **不允许**写 `85%` 或 "业务完成度 85%" (R.3 已推翻)
- ❌ **不允许**把 mock / simulator / DRY_RUN 算入 complete
- ✅ **唯一口径**: 15.6% (7/45)
- ✅ **可表达**: "requirements 完成率 15.6%" / "同步链路完成度 X%" / "展示链路完成度 X%" / "控制队列框架完成度 X%"

---

## 3. 当前可信基线 (5 项铁律)

| # | 基线 | 角色 | 验证方式 |
|---|---|---|---|
| 1 | **`docs/source/requirements.md`** | 最高验收标准 | 每 Sprint 必须引用 §X.Y |
| 2 | **`CLAUDE.md`** (9 大强约束 + §10 测试强约束 + 附录 C) | 强制开发规范 | 提交前自查 |
| 3 | **`databases/disc_files.sql`** (147 张表) | schema 静态基线 | 字段不存在时查这里 |
| 4 | **`star_storage_db`** (170 张表, 5434, starxdb) | 完整测试站点库 | 站点侧 SQL 验证 |
| 5 | **`unified_disc_platform`** (中心库, 5432, unified) | 总控汇总库 | 跨站点聚合验证 |

**`source_restore` (5432, 13 张表)** ⚠️ **不是完整站点库**, 仅同步白名单测试源, 禁止作为需求完成证据。

### 3.1 5 级 Schema Source Priority (CLAUDE.md 附录 C)
```
1. requirements.md       (最高标准)
2. disc_files.sql        (schema 静态基线, 147 表)
3. star_storage_db       (运行时真实数据, 170 表)
4. source_restore        (同步白名单, 13 表, 不代表完整)
5. unified_disc_platform (总控汇总, 可能含历史测试污染)
```

### 3.2 5 库一句话定位
- **requirements.md** → 决定**做什么**
- **disc_files.sql** → 决定**结构应该长什么样**
- **star_storage_db** → 决定**站点真实数据是什么** (生产测试)
- **source_restore** → 决定**同步测试从哪取数**
- **unified_disc_platform** → 决定**总控展示给用户什么**

---

## 4. 已完成 (可信证据)

| 能力 | 实现位置 | 证据 |
|---|---|---|
| 同步链路 | 13 张白名单表 + dispatcher + package | `pnpm smoke:sync` passed |
| HMAC 鉴权 | `/api/sync/package` + 站点 `/api/site-control/*` | `lib/sync/hmac.ts` + Sprint 2G.1 |
| 数据一致性校验 | 7 表 source vs unified | **7/7 matched** (SH01) |
| 基线检查 | 13 项自动检查 | **13/13 passed** |
| e2e 事件测试 | 6 个脚本 (Dashboard/Tasks/Sync/Control/Sites/Search) | **91/91 passed** |
| /sites 真实化 | `app/sites/page.tsx` | `dataSource=derived`, 7 站点, 4 按钮 disabled |
| R.7 一致性 API | `GET /api/sync/consistency?siteCode=...` | 真实报告 |
| R.8 调度器 | `scripts/scheduler/sync-scheduler.ts` | `sync_scheduler_log` 写入 |
| 任务控制 (审计层) | `control_command` 表 + 6 commandType | audit_log + 站点轮询 (DRY_RUN) |

---

## 5. 未完成 / 阻塞 (不能宣称完成)

### 5.1 Auth 全套 (Sprint 5.x 解锁)
- ❌ ADFS 接入 (REQ-2.2.1)
- ❌ JWT 令牌 (REQ-2.2.2)
- ❌ RBAC 权限 (REQ-3.2.1)
- ❌ 账号生命周期 / 部门管理 / SSO 跳转真接入
- **状态**: `blocked_by_auth`

### 5.2 检索 / 日志分析 (Sprint 2D.6 解锁)
- ❌ Elasticsearch 接入 (REQ-4.1.1, 4.1.2)
- ❌ ClickHouse 接入 (tbl_sys_log / tbl_api_log)
- ❌ `/api/search` 当前显式 501 `not_implemented` (R.4 修复)
- **状态**: `blocked_by_external_system`

### 5.3 任务控制 (Sprint 4.8.2-R 真相审计)
- ❌ 暂停 / 恢复 / 重置 **DB 字段写入可行, 真实执行未证实** (无站点 app 消费 evidence)
- ❌ 巡检 (inspect_start) / 恢复任务 (recovery_start) 需站点 app poll
- ❌ 优先恢复 (priority) 需 `tbl_task.priority` 字段 (源端 0 命中)
- **状态**: `blocked_by_site_change` + `blocked_by_source_schema`

### 5.4 站点登记表
- ❌ `unified_site_registry` 表**未落库** (R.8A-1 已设计, 暂不实施)
- 当前 `/sites` 显示 7 derived 站点 (SH01/BJ02/PKG_TEST 等), IP/联系人/数据中心为 "—"
- **状态**: `blocked_by_source_schema` (源端 `tbl_site` 0 行)

### 5.5 写操作能力
- ❌ 站点新增 / 编辑 / 删除: 按钮 disabled
- ❌ 站点启用 / 禁用: 按钮 disabled (REQ-2.1.1 partial)
- ❌ SSO 跳转: 按钮 disabled (REQ-2.1.2 blocked_by_auth)
- 页面 toast 显式 "功能未接入", 绝不允许显示 "成功"

---

## 6. 测试 / 验证基线

### 6.1 提交前必跑 (CLAUDE.md §8)

```bash
pnpm exec tsc --noEmit    # 0 错
pnpm build                # 成功
pnpm smoke:sync           # 同步链路
pnpm baseline:check       # 13 项基线
```

### 6.2 涉及前端/事件/Worker 时必跑

```bash
pnpm e2e:all              # 6 脚本 91 用例
pnpm test:e2e:worker      # worker 端到端
```

### 6.3 一致性 (R.7)

```bash
set -a; source .env.local; set +a
pnpm check:sync-consistency -- --siteCode=SH01   # 7/7 matched
```

### 6.4 关键脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动 dev server (http://localhost:3000) |
| `pnpm db:up` | 启动 PostgreSQL (unified + site_restore) |
| `pnpm scheduler:sync:once` | 跑一次同步调度 |
| `pnpm worker:site` | 启动站点 worker (DRY_RUN) |
| `pnpm e2e:sites` | 单跑 sites e2e (22 用例) |
| `pnpm e2e:all` | 全跑 6 脚本 (91 用例) |

### 6.5 端口 / 凭据

| 库 | 端口 | 凭据 |
|---|---|---|
| `unified_disc_postgres` | 5432 | `unified / <center_password>` |
| `site_restore_full_postgres` (star_storage_db) | 5434 | `starxdb / starxdb` |
| `source_restore` | 5432 | `unified / <source_password>` (13 表) |

---

## 7. 项目结构 (速查)

```
app/           # Next.js 页面路由 (/sites /tasks /racks /volumes /sync /control /logs /search)
components/    # UI 组件 (ui/, dashboard/, platform/, layout/)
lib/
  api/        # API providers (含 dto/, api-providers.ts)
  mock/       # Mock 数据 (R.9A 后 /sites 不再使用)
  sync/       # 同步模块 (config/query/dispatcher/hmac)
  types/      # TypeScript 类型 (含 site.ts R.9A 扩展 status="derived")
  db/         # PostgreSQL 连接
  control/    # 控制命令 (executor.ts R.3 修复为真连站点库)
docs/
  source/     # requirements.md (最高标准)
  database-analysis/  # Sprint review / traceability / R.x 文档
  superpowers/      # Sprint 设计/计划
  testing/           # 测试指南
  summary/           # PROJECT_STATUS / ROADMAP / **本文件 HANDOFF_TO_CODEX.md**
  audit/             # 审计报告 (含 consistency/SH01-*.json)
scripts/
  e2e/        # 6 个 e2e 脚本 (R.6 实施, R.9A 增强 sites)
  scheduler/  # R.8 调度器
  check-*.ts  # R.7 consistency / R.7C baseline
databases/    # SQL 静态基线 (含 disc_files.sql 147 表)
```

---

## 8. Codex 接手第一步 (按顺序)

### 8.1 必须做 (建立全局观)

1. **读取 `CLAUDE.md`**
   - 9 大强约束 (§一-九)
   - §10 前端事件测试强约束
   - 附录 A: 站点 schema/API 变更建议模板
   - 附录 B: requirements 完成率公式
   - 附录 C: Schema Source Priority (5 级)

2. **创建 / 同步 `AGENTS.md`** (Codex 风格)
   - 引用 CLAUDE.md 全部约束
   - 增加 Codex 特有指令 (e.g. 工具调用、subagent 边界)
   - 与 CLAUDE.md 不冲突

3. **读取 `docs/summary/PROJECT_STATUS.md`**
   - 当前 Sprint 状态
   - 累计进度

4. **读取 `docs/database-analysis/requirements-traceability.md`**
   - 45 个原子需求 × 18 字段
   - 当前状态 (15.6% 完成率)

### 8.2 严禁做 (接手边界)

- ❌ **不做业务代码** (R.1 约束: 不允许未确认新增业务功能)
- ❌ **不修改 requirements.md** (最高标准, 不可改)
- ❌ **不修改 CLAUDE.md 9 大强约束** (可加, 不许删)
- ❌ **不写 secret / 真实密码到 .env / 配置文件**
- ❌ **不接 tbl_file / tbl_folder 全量同步** (Sprint 2D.6 走 ES)
- ❌ **不修改 source_restore / star_storage_db 数据** (R.7B 约束)
- ❌ **不删除目录 / 数据库** (需清理走 archive/ deprecated/ legacy/)
- ❌ **不把 mock / simulator / DRY_RUN 算入 complete** (R.1 §7)

### 8.3 必须跑 (建立可信基线)

```bash
# 0. 环境
pnpm install
pnpm db:up
pnpm db:init

# 1. 类型 + 构建
pnpm exec tsc --noEmit
pnpm build

# 2. 同步 + 一致性
pnpm smoke:sync
set -a && source .env.local && set +a
pnpm check:sync-consistency -- --siteCode=SH01

# 3. 基线检查
pnpm baseline:check

# 4. e2e 全量
pnpm e2e:all
```

**期望结果**:
- tsc: 0 错
- build: 成功
- smoke: passed
- consistency: 7/7 matched
- baseline: 13/13
- e2e: 91/91

如果**任一失败**, **不要继续**, 立即在 issue 中报告失败原因, 等待人类决策。

### 8.4 验证完成后

1. 报告所有 6 项结果
2. 如果发现新问题, 先开 issue, 不要直接修
3. 新 Sprint 启动时, 必须先在脑暴阶段引用 `requirements.md §X.Y` 对应需求
4. 每次 Sprint 完成产出 `docs/database-analysis/sprint-<X.Y>-requirements-review.md` (R.1 13 段模板)
5. 更新 `docs/summary/PROJECT_STATUS.md` + `ROADMAP.md`
6. 严禁使用 "业务完成度" 措辞, 必须用 "requirements 完成率 15.6% (不变)" 口径

---

## 9. 一句话风险提示

> 如果 Codex 接手后看到"业务完成度 85%"或"任务控制已完成"等措辞, **立即质疑并回退**。
> 真实完成度 (R.3 口径): **requirements 15.6%**, 任务控制**降级为"DB 字段写入可行, 真实执行未证实"**。
> 所有"已实现"必须配 SQL/API/UI 三重证据, 不允许单一声称。

---

## 10. 关键 Commit 历史 (R.x 阶段)

```
8a66b6c fix: review sites real data integration   ← HEAD (远端最新)
c84b979 fix: connect sites page to real sites api
690f0aa docs: clarify multisite architecture and stabilize e2e
d85c37e feat: add hourly sync scheduler with consistency checks
ef90c78 chore: freeze sync and control baseline checks
9676975 fix: clean test pollution and add schema baseline inventory
```

(R.1-R.8A-1 之前 commit 在 R.7B 之前, 详见 `git log`)

---

## 11. 联系 / 决策待办

| 项 | 阻塞 | 决策方 |
|---|---|---|
| ADFS 接入 (REQ-2.2.1) | 解锁带动 6 项 (~25 人天) | 领导 |
| 站点表加 `paused` / `priority` 字段 | 任务控制 6 原子真控制 | 领导 + 站点运维 |
| 站点 app poll `control_command` | 任务控制 6 原子真执行 | 站点 app 团队 |
| `tbl_site` 真实数据 | 站点登记 / 联系人 / 存储容量 | 站点运维 |
| ES / ClickHouse 接入 | 检索 + 日志分析 | 领导 |

---

**END OF HANDOFF**
