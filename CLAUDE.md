# CLAUDE.md

本项目开发指南, 包含项目定位、核心约束、开发流程规则。

---

## 🚨 最高优先级: requirements.md

> **`docs/source/requirements.md` 是本项目的最高验收标准**, 所有 Sprint 的产出都必须能映射到 `requirements.md` 的某条需求, 并按本文件的"严格验收"产出 `requirements review`。

### 9 大强约束 (一票否决, 不可绕过)

#### 一、requirements.md 最高优先级

- ✅ **每次开发前必须先确认对应 requirement** (在 Sprint 设计文档中写明 `requirements.md §X.Y` 节)
- ✅ **每次开发后必须做 requirements review** (使用 `docs/database-analysis/requirements-strict-review-template.md` 模板)
- ❌ **不允许仅因为当前源库没有字段就跳过需求** —— 只能标 `blocked_by_source_schema` 或 `blocked_by_site_change`
- ❌ **不允许把 mock / simulator / DRY_RUN 说成真实完成**
- ❌ **不允许把"展示完成"说成"管控完成"**
- ❌ **不允许把"同步链路完成"说成"需求完成"**

#### 二、需求状态枚举 (每个 Req ID 必须打 1 个标签)

| 状态 | 含义 |
|---|---|
| `complete` | 真实后端完成 + UI 完成 + 端到端验证通过 |
| `partial` | 部分能力完成, 有缺失件 (必须列出) |
| `not_started` | 尚未开工 |
| `blocked_by_source_schema` | 源端 / 站点库缺字段, 需源端 schema 变更 |
| `blocked_by_site_change` | 需站点应用 / 配置 / API 配合 |
| `blocked_by_auth` | 受登录 / RBAC / SSO 阻塞 (CLAUDE.md 当前禁) |
| `blocked_by_external_system` | 受外部系统 (ES / ClickHouse / 站点 API) 阻塞 |
| `out_of_scope` | 明确不在本项目范围 |

#### 三、严格验收 (每次 Sprint 完成必须输出)

每个 Sprint 必须产出 `docs/database-analysis/sprint-<X.Y>-requirements-review.md`, 包含:
1. **Requirement IDs** (本 Sprint 涉及的所有)
2. **Requirement 原始文本** (逐字摘录 `requirements.md`)
3. **Implementation** (改了哪些文件 / API / 表)
4. **Backend reality** (是数据库 / API / 队列真支持, 还是仅 UI 层面调用 — 必须有 SQL/API 证据)
5. **UI reality** (真实点击行为, 是否误导用户)
6. **Mock / Simulator / DRY_RUN / 真控制** 四者明确区分
7. **Missing pieces** (不隐藏)
8. **Blocker type** (8 选 1)
9. **需要的源端 schema / 站点 API 变更清单** (提交给领导 / 站点运维)
10. **Verdict** (`pass` / `partial` / `fail`)

#### 四、任务控制硬约束 (来自 requirements.md §4.2)

`requirements.md §4.2` 明确要求支持: **新建 / 暂停 / 恢复 / 重置 / 巡检 / 恢复任务** 6 个原子动作。

**关键约束**:
- ✅ 前端按钮可以存在, **但必须明确状态** (toast 文案必须含 "已提交到控制队列, 等待站点拉取执行")
- ⚠️ **如果只是 `control_command` 队列 + audit + DRY_RUN simulator**, **不能宣称真实控制完成** — 只能宣称"控制队列框架完成"
- ⚠️ **如果站点库缺字段** (如 `paused` / `priority` 全库 0 命中), **必须输出"站点 schema patch 建议清单"**
- ❌ **不允许**为了宣称完成, 把需求降级为"不做"
- ❌ **不允许**编造真实控制证据

**真实完成标准** (四条件全部满足才算):
1. 总控提交命令 → `control_command` 写入
2. 站点应用 poll / 读新行 (有应用代码 evidence)
3. 站点执行, 状态回写 (e.g. `tbl_task.status` / `tbl_task.paused`)
4. 总控 `audit_log` + UI 展示最终状态 (success / failed / paused)

**当前状态** (Sprint 4.8.2-R 之后, 170 张表全扫):
- ✅ 条件 1 (总控提交): complete
- ❌ 条件 2 (站点 poll): blocked_by_site_change (无应用代码 evidence)
- ❌ 条件 3 (站点回写): blocked_by_source_schema (170 张表 0 paused/priority 字段)
- ❌ 条件 4 (总控展示): partial (audit_log 有, 但 final state 未回写)

**结论**: 任务控制**目前未真正完成**, 标记 `partial` / `blocked_by_source_schema` / `blocked_by_site_change`。**真实完成需站点表加字段 + 站点 app 配合, 由领导决策**。

#### 五、同步策略

- ✅ **站点完整库是单站点库** (170 张表, `star_storage_db` 是 PG17 物理备份恢复版本)
- ✅ **每站点定期每小时同步** (Sprint 2B/2C 收敛)
- ✅ **小表可 full package** (13 张白名单)
- ❌ **大表 tbl_file / tbl_folder 不进 PG17 全量** (走 ES / ClickHouse, 后续 Sprint 评估)
- ✅ **中心库按 `source_site_id` 区分站点** (Sprint 2F.4 siteCode 全局筛选)
- ⚠️ **`source_restore` partial 不代表完整站点库** — 完整审计必须基于**完整 170 表库** (Sprint 4.8.2-R 教训)

#### 六、控制策略

- ✅ **总控必须保留控制能力路线** (Sprint 4.5 control_command MVP 框架)
- ✅ **无站点 API 时, 优先设计**: `control_command` 队列 + Site Worker + 站点数据库字段改造方案
- ⚠️ **对于 requirements 要求但站点库不支持的能力**, **必须提出"站点需新增字段 / 表 / API"清单** (附录 A), 提交给领导, **不允许关闭需求**
- ❌ **真实控制不能伪造** (audit ≠ 控制)

#### 七、禁止误导 (措辞规范)

**禁止使用以下说法, 除非证据完整**:

| 禁止 | 必须改用 |
|---|---|
| "控制能力已完成" | "控制队列框架完成" / "DRY_RUN 模拟完成" |
| "任务暂停已实现" | "audit 提交到 control_command 队列" / "等待站点拉取" |
| "恢复已实现" | 同上 |
| "巡检已实现" | 同上 |
| "需求完成度 85%" | "requirements 完成度 X%" (基于附录 B 公式) |
| "业务完成度 85%" | "同步链路完成度 X%" / "展示链路完成度 X%" |
| "暂停成功" (toast) | "暂停命令已提交" / "已记录到控制队列" |
| "已暂停" (UI 状态) | "已提交暂停命令" |

#### 八、每次提交前强制检查

```bash
pnpm exec tsc --noEmit    # 类型检查
pnpm build                # 生产构建
pnpm smoke:sync           # 同步链路 smoke
pnpm baseline:check       # 基线冻结检查 (R.7C 新增)
```

如涉及 worker:
```bash
pnpm test:e2e:worker      # 端到端 worker 验证
```

如涉及前端/事件:
```bash
pnpm e2e:all              # 全量 e2e (R.6 新增)
```

**任一失败不允许提交**。

#### 九、文档同步 (每次 Sprint 完成必须更新)

- ✅ `docs/summary/PROJECT_STATUS.md` — 当前 Sprint 段
- ✅ `docs/summary/ROADMAP.md` — 当前 Sprint 段
- ✅ `docs/database-analysis/sprint-<X.Y>-requirements-review.md` — 严格审查 (本模板)
- ⚠️ 如涉及 schema 变更, 同时更新 `docs/database-analysis/schema-inventory.md`

#### 十、前端事件级测试 (R.5 新增强约束, 一票否决)

> **核心**: 不允许只改 API 不验证前端, 不允许按钮存在但点击事件不真实触发。
> 测试规范: `docs/database-analysis/frontend-event-test-standard.md` (R.5 落地)

**触发条件** — 每次 Sprint 如果涉及以下**任一**内容, 必须同时产出事件级测试:

- 前端页面 / 按钮 / 表单 / 搜索框 / 筛选器 / 下拉框 / siteCode 切换
- 同步事件 / 创建事件 / 控制命令 / 导出事件
- toast / 弹窗 / drawer
- API 接入 / mock → real data 切换

**强制产出** (R.5 起, 任一缺失禁止 commit):

1. 对应前端交互测试脚本 (位置: `scripts/e2e/test-<page>.ts` 或新 Sprint 内联)
2. 对应 API 验证脚本 (curl 或 tsx 脚本)
3. 对应数据库结果验证 (docker exec psql + 真实数据查询)
4. 对应浏览器验证记录 (HTTP 200/4xx/5xx + 关键 HTML/CSS 状态, 后续 Playwright 截图)

**每个交互必须验证 10 项**:

- 用户在哪里点击 (元素 + selector)
- 点击前页面状态 (mock? real? 空?)
- 点击后请求了哪个 API (endpoint + method + payload)
- API 返回什么 (HTTP code + 关键字段)
- 数据库是否变化 (docker exec psql 验证)
- 页面是否刷新 (mock 数据 vs 真实数据)
- toast 是否准确 (是否含"已提交"/"已暂停"等误导措辞)
- 是否存在 mock/fallback (R.1 §7 禁止)
- 是否误导用户 (按钮文案 vs 真实后端能力)
- 是否符合 `requirements.md` (R.1 §1 强约束)

**前端变更强制披露** (每次修改前端必须输出 8 项):

- 新增了哪些页面/组件
- 修改了哪些按钮/交互
- 删除了哪些按钮/交互
- 哪些是 UI-only (无后端)
- 哪些是真实后端能力 (有 SQL/API 证据)
- 哪些只是 simulator / DRY_RUN (R.1 §7 措辞规范)
- 是否新增了 `requirements.md` 未要求的内容
- 如果新增了: **必须说明理由并标注"不属于需求主线"**

**禁止 10 项** (R.5 新增, 任一违反禁止 commit):

- 偷偷新增页面
- 偷偷新增按钮
- 写了按钮但不测点击
- 写了 API 但不接前端
- 接了前端但不测浏览器
- 用 mock 冒充真实数据
- 用 toast 冒充成功 (e.g. "暂停成功" 实际是 audit-only)
- 用 DRY_RUN 冒充真实执行
- 用 200 响应冒充需求完成
- 只跑 tsc/build 不跑业务事件测试

**R.5 Sprint review 必含 9 项** (sprint-<X.Y>-requirements-review.md):

- A. Requirement 对照
- B. 前端变更清单 (8 项强制披露)
- C. API 变更清单
- D. 数据库变更清单
- E. 事件测试清单 (10 项验证)
- F. 浏览器验证结果
- G. mock/simulator/DRY_RUN 标记
- H. 未完成项
- I. **是否允许 commit** (满足全部 9 项 + 10 项禁止无违反 → pass; 否则 fail)

**禁止措辞规范** (R.1 §7 + R.5 强化, 涉及前端 toast/drawer 严格):

| 禁止 | 必须改用 |
|---|---|
| 按钮文案"已暂停" / toast"暂停成功" | 按钮文案"暂停命令已提交" / toast"已提交到控制队列, 等待站点拉取执行" |
| "导出完成" | "导出请求已提交" (实际是 localStorage 客户端导出) |
| "新建成功" | "任务已记录到控制队列" (仅 audit, 无真实 tbl_task INSERT) |
| "同步完成" | "sync_package 已记录 (中心库), 等待站点响应" (如站点未连, 实际未真正同步) |

**测试缺口管理** (R.5 现状):

- `scripts/e2e/` 计划目录已建 (R.5), 6 个脚本占位 (test-dashboard/tasks/sync/control/sites/search)
- 当前 R.5 仅产出占位 + 规范文档, **R.5 不实现具体脚本** (避免范围蔓延)
- 后续 Sprint 涉及前端/事件时, 必须按 `frontend-event-test-standard.md` 模板产出对应脚本

---

## 项目定位

**集团层统一管控平台**, 不替代各站点原有系统。

核心能力: 数据同步、统一视图、统一权限、统一任务管理、日志管理。

对应 `requirements.md`:
- §1 整体架构 → 1.1 / 1.2
- §2 基础支撑 → 2.1 站点 / 2.2 认证 / 2.3 同步
- §3 核心管控 → 3.1 账号 / 3.2 权限 / 3.3 部门
- §4 业务操作 → 4.1 检索 / 4.2 任务管理 / 4.3 盘笼
- §5 辅助保障 → 5.1 日志 / 5.2 索引
- §6 非功能 → 6.1 性能 / 6.2 安全 / 6.3 兼容 / 6.4 可维护

---

## 当前阶段

| Sprint | 状态 | 对应 requirements § |
|---|---|---|
| Sprint 1 | ✅ | §2.3 同步 (骨架) |
| Sprint 2A / 2B | ✅ | §2.3 同步 (Mock/Adapter/PG 中心库) |
| Sprint 2B.1 ~ 2B.3.1 | ✅ | §2.3 同步 (Docker/查询) |
| Sprint 2C.18 ~ 2C.20 | ✅ | §2.3 / §4.1 (file-index 索引) |
| Sprint 2D.1 ~ 2H.6 | ✅ | §2.3 同步 dispatcher + 13 白名单表 |
| Sprint 3.0 / 3.0R | ✅ | 业务审计 (32 项需求矩阵) |
| Sprint 4.0 | ✅ | 40 个原子需求, 4 层映射 |
| Sprint 4.5 | ✅ | §4.2 任务管理 → control_command MVP |
| Sprint 4.8.2 / 4.8.2-R | ✅ | §4.2 任务管理 → 真相审计 (170 张表) |
| **Sprint R.1** | ✅ | **本 Sprint: requirements.md 上升为最高验收标准** |

**当前主线**: Sprint R.1 启动, 后续 Sprint **必须用本文件 + `requirements-strict-review-template.md` 强约束验收**。

---

## 最高优先级文档

| 文档 | 用途 | 优先级 |
|---|---|---|
| `docs/source/requirements.md` | **需求规格 (最高验收标准)** | **🚨 最高** |
| `docs/database-analysis/requirements-strict-review-template.md` | **Sprint 严格审查模板 (强制)** | **🚨 最高** |
| `docs/database-analysis/sprint-<X.Y>-requirements-review.md` | 单次 Sprint 严格审查 (产出) | **🚨 高** |
| `docs/database-analysis/requirements-alignment.md` | Sprint 与需求对齐 (历史) | 中 |
| `docs/database-analysis/sprint-2b-sync-backlog.md` | 同步模块后续重构项 | 中 |
| `docs/database-analysis/sprint-2b3-1-sync-refactor-summary.md` | 架构清理总结 | 中 |
| `docs/testing/sprint-2b1-db-verification-guide.md` | 数据库验证流程 | 中 |
| `docs/summary/PROJECT_STATUS.md` | 项目当前状态 | 中 |
| `docs/summary/ROADMAP.md` | 路线图 | 中 |

---

## 核心约束

### 开发禁止事项

- ❌ 不改 UI 风格 (保持现有视觉设计)
- ❌ 不修改前端类型契约 (`lib/types/*` 是 Adapter 接口)
- ❌ 不直接修改 Mock 数据结构 (需变更则扩展而非修改)
- ❌ **不允许把需求降级 / 删除** (只能标 `blocked_*` 或 `out_of_scope`)

### 数据与安全

- ❌ 当前阶段不接真实源库 (进入真实源库 Sprint 前必须先做方案确认)
- ❌ 不处理 tbl_file/tbl_folder 大表 (后续走 ES/ClickHouse)
- ❌ 不提交敏感信息 (`.env.local`、数据库密码、真实源库连接)
- ❌ Docker volume 数据不提交到 git
- ❌ **不删除目录, 不删除数据库**, 如需清理只能移动到 `archive/` / `deprecated/` / `legacy/`

### 需求与范围

- ❌ 未经确认不新增业务页面
- ❌ 不做无需求依据的 UI 扩展
- ❌ 不替换现有 API provider 数据源
- ❌ 不做登录权限系统 (Sprint 5.x 解锁)
- ⚠️ **不基于"当前数据库有什么"倒推需求** — 永远以 `requirements.md` 为准

### 构建要求 (强制)

- ✅ 每次提交前必须 `pnpm build` 成功
- ✅ 每次提交前必须 `pnpm exec tsc --noEmit` 无错误
- ✅ 每次提交前必须 `pnpm smoke:sync` 通过 (如涉及同步)
- ✅ 每次提交前必须 `pnpm test:e2e:worker` 通过 (如涉及 worker)
- ✅ 每次提交前必须产出 `requirements review` 文件

---

## 开发流程

### 标准流程 (强化版)

```
brainstorming → spec → plan → subagent → test → requirements review → commit
                  ↑                                          ↓
                  └────── 每个步骤对应 requirements.md §X.Y ──┘
```

1. **brainstorming**: 确认需求、方案选择; 标注对应 `requirements.md §X.Y`
2. **spec**: 设计文档保存到 `docs/superpowers/specs/`, 列出该 Sprint 涉及的 Req IDs
3. **plan**: 实现计划保存到 `docs/superpowers/plans/`, 每个 task 关联 Req ID
4. **subagent**: 按任务执行, 提交时携带 Req ID
5. **test**: 测试验证 (含 `requirements review` 验证)
6. **requirements review**: **新步骤**, 产出 `docs/database-analysis/sprint-<X.Y>-requirements-review.md`
7. **commit**: 提交, commit message 含 Req ID 列表

### Sprint 约束 (强)

**每个 Sprint 必须先说明对应 `docs/source/requirements.md` 哪一节, 并列出涉及的 Req IDs。**

每个 Sprint 完成必须产出 `requirements review` 文件, 否则不允许 merge / commit。

---

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Next.js 16.2.6 + React 19 |
| UI | Tailwind CSS v4 + Radix UI |
| 数据库 | PostgreSQL 17 (Docker) |
| 组件 | React Hook Form + Zod + Recharts |
| 构建 | pnpm |
| 鉴权 | HMAC-SHA256 (Sprint 2G.1) |

---

## 常用命令

```bash
# 开发
pnpm dev          # 开发服务器 (http://localhost:3000)
pnpm build        # 生产构建
pnpm lint         # ESLint 检查
pnpm exec tsc --noEmit  # 类型检查

# 数据库
pnpm db:up        # 启动 PostgreSQL
pnpm db:init      # 初始化数据库 (schema + seed)
pnpm db:init:sync # 初始化同步表 (mock_tbl_task)

# 强制提交前检查
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm test:e2e:worker   # 如涉及 worker
```

---

## 项目结构

```
app/           # Next.js 页面路由
components/    # UI 组件 (ui/, dashboard/, platform/)
lib/
  api/        # API 模式切换
  mock/       # Mock 数据
  sync/       # 同步模块 (config.ts, query.ts, tasks-sync.ts 等)
  types/      # TypeScript 类型
  db/         # PostgreSQL 连接
  control/    # 控制命令 (Sprint 4.5+)
docs/
  source/     # 原始需求文档
  database-analysis/  # 数据库分析与方案 (含 requirements review)
  superpowers/      # Sprint 设计/计划/总结
  testing/           # 测试指南
  summary/           # PROJECT_STATUS / ROADMAP
  audit/             # 审计报告
```

---

## 附录 A: 站点 schema/API 变更建议模板 (Sprint 4.8.2-R 启动)

> **当 Sprint 涉及 `blocked_by_source_schema` 或 `blocked_by_site_change` 时, 必须输出本清单**。

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 | 决策人 |
|---|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` | 领导 + 站点运维 |
| `tbl_task` 加 `priority SMALLINT` | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` | 同上 |
| 站点 app poll `control_command` 新行 | 站点 app | 启动时注册 GET /api/site-control/commands, 调 /api/site-control/commands/[id]/ack | 站点 app 团队 |
| 站点 app 读 `tbl_check_patrol_task` 新行 | 站点 app | 巡检进程启动时 SELECT pending 行 | 同上 |
| 站点 app 读 `tbl_hot_restore_record` 新行 | 站点 app | 热恢复进程启动时 SELECT pending 行 | 同上 |
| 提供真站点 API 文档 | 站点 | swagger / openapi.yml 提交到 `docs/source/site-api-spec.md` | 站点架构师 |

---

## 附录 B: requirements 完成率公式 (禁止替代为"业务完成度")

```
requirements 完成率 = Σcomplete / (Σtotal - Σout_of_scope) × 100%
```

**禁止**:
- ❌ 用"业务完成度 85%" 代替"requirements 完成度"
- ❌ 用 "X% 已实现" 模糊表达
- ❌ 把 mock / simulator / DRY_RUN 算入 complete

**可使用的完成度**:
- ✅ "requirements 完成度 X%"
- ✅ "同步链路完成度 X%"
- ✅ "展示链路完成度 X%"
- ✅ "控制队列框架完成度 X%"
- ✅ "DRY_RUN 模拟完成度 X%"

---

## 附录 C: Schema Source Priority (Sprint R.7B)

> **当判断字段/表/需求实现时, 必须按以下优先级, 不允许只看单一来源下结论。**

| 优先级 | 来源 | 说明 | 禁止 |
|---|---|---|---|
| **1. requirements.md** | 需求最高标准 | 每条需求的验收条件 | 禁止跳过/降级 |
| **2. disc_files.sql** | 字段/表结构**静态基线** | `databases/disc_files.sql` (147 张表, 含 tbl_file/tbl_folder/控制表) | 禁止忽略 |
| **3. 完整站点库 star_storage_db** | 运行时**真实数据** | 170 张表, Docker 5434 | 禁止只查 13 表 |
| **4. source_restore** | 同步白名单/测试源 | 13 张表, Docker 5432 | **不代表完整 schema**, 禁止只看 source_restore 下结论 |
| **5. unified_disc_platform** | 总控**汇总结果** | 中心库, 可能含历史测试污染 | 禁止用污染数据作为需求完成证据 |

### 明确禁止 (Sprint R.7B)

- ❌ **只看 source_restore 13 表下结论** — 必须同时参考 disc_files.sql + star_storage_db 170 表
- ❌ **用中心库污染数据作为需求完成证据** — R.7B 已清理 SH01 污染 (13 行), 但其他站点可能仍有
- ❌ **用 accepted-difference 掩盖历史测试污染** — 发现污染必须清理, 不能标 accepted_difference
- ❌ **只看单一来源** — 必须至少查 2 个来源交叉验证

### R.7B 清理记录

- 统一 tasks SH01 污染 7 行已删 (INGEST-001/002, FIX-TEST-001, V-TEST-001, ACCEPT-001, TASK-2026-05001/05002)
- 统一 devices SH01 污染 4 行已删 (DEV-INGEST-001/002, DL_SH01_001/002)
- 统一 volumes SH01 污染 2 行已删 (VOL_001/002)
- 清理后一致性: **7/7 matched, exit code 0**
