# Project Status

> **截至**: 2026-06-10
> **Sprint**: Sprint R.3 修复完成 (executor 假执行 → 真执行)
> **当前主线**: Sprint 4.5 完成 (control_command 控制队列 MVP)

---

## Sprint R.3 — Executor 假执行修复 (2026-06-10 完成)

> **核心**: 修正 R.3 审计的误判 + 修复 executor.ts 让任务控制真执行。

### R.3 审计误判

- ❌ R.3 说"站点库无 paused 字段 → 真控制 0%"
- ✅ 真相: 站点用 `status=20` 整数枚举表达暂停 (来自 `real-field-mapper.ts` TASK_STATUS_0_2_3[20]='paused')
- ✅ executor 修复: 不再查 `paused` 列名, 改为 `UPDATE tbl_task SET status=20`

### 验证

- `tbl_task.id=9`: status 0→20 (暂停)→0 (恢复) ✅ 真改
- DRY_RUN=true: dry_run_success, 不改表 ✅
- DRY_RUN=false: success, 真改 tbl_task.status ✅

### 任务控制真实完成度修正

| 原子 | R.3 之前 | R.3 之后 |
|---|---|---|
| 暂停 (status=20) | 0% (假执行) | ✅ 真执行可行 |
| 恢复 (status=0) | 0% (假执行) | ✅ 真执行可行 |
| 重置 (status=1) | 0% (假执行) | ✅ 真执行可行 |
| 巡检 | 0% (无站点 app) | ⚠️ 仍需站点 app 配合 |
| 恢复任务 | 0% (无站点 app) | ⚠️ 仍需站点 app 配合 |
| 优先恢复 | 0% (无 priority 字段) | ⚠️ 仍需站点加 priority 字段 |

---

## Sprint R.7 — 数据一致性校验 Job (2026-06-10 完成)

> **核心**: REQ-2.3.3 实施, 7 表 source vs unified count_diff 校验, 真实 fail-closed。

### 新增产出

- ✅ `scripts/check-sync-consistency.ts` (~280 行) — 7 表 count_diff + JSON 输出 + log 写入
- ✅ `GET /api/sync/consistency?siteCode=SH01` — 读 log, 不每次跑全量
- ✅ DB 表 `sync_consistency_log` (11 字段, 3 状态 CHECK)
- ✅ `/sync` 页面新增一致性卡片 (consistency-card + 4 字段 + 4 状态 Badge)
- ✅ `package.json` 加 `check:sync-consistency` script
- ✅ e2e:test-sync 9→17 (R.7 新增 8 项)

### 真实校验结果 (SH01, R.7 跑出)

| 表 | src | unified | diff | 状态 |
|---|---|---|---|---|
| tbl_task | 37 | 44 | +7 | ❌ mismatched |
| tbl_disc_lib | 4 | 8 | +4 | ❌ mismatched |
| tbl_logical_volume | 3 | 5 | +2 | ❌ mismatched |
| tbl_magzines / tbl_slots / tbl_hd_info / tbl_disc | — | — | 0 | ✅ matched |
| **合计** | **519** | **532** | **+13** | **4 匹配 / 3 异常 / mismatched** |

### 7 项验证全绿

- ✅ `pnpm exec tsc --noEmit` — 0 错
- ✅ `pnpm build` — 24/24 静态页 (+/api/sync/consistency)
- ✅ `pnpm smoke:sync` — passed
- ✅ `pnpm test:e2e:worker` — 3 命令 dry_run_success
- ✅ `pnpm e2e:sync` — 17/17 (R.6 9 + R.7 8)
- ✅ `pnpm e2e:all` — 78/78 (R.6 70 + R.7 8)
- ✅ `pnpm check:sync-consistency -- --siteCode=SH01` — mismatched 真实写入 log

### R.7 范围严格

- ✅ 0 业务页面新增 (只是 /sync 加 1 Card)
- ✅ 0 修改同步协议 (R.2G.1 HMAC 维持)
- ✅ 0 接 tbl_file/tbl_folder 全量
- ✅ 0 伪造一致性结果 (mismatched 真实暴露)

### Requirements 影响

- REQ-2.3.3: not_started → **partial** (R.7 实施, 无 cron 自动化)
- 完成率: 15.6% 维持 (partial +1, not_started -1, 总数不变)

### 缺口 (R.8+ 候选)

- cron 自动每日校验 (REQ-2.3.3 完整)
- missing/extra 跨 DB 真实差异
- 失败告警 push (REQ-4.2.4)

---

## Sprint R.6 — 前端事件 e2e 实施 (2026-06-10 完成)

> **核心**: 把 Sprint R.5 占位脚本改成真实可运行 e2e, 验证 6 个核心页面/事件。

### 6 个 e2e 脚本 (70/70 通过)

| 脚本 | 测试用例 | 通过率 | 关键验证 |
|---|---|---|---|
| test-dashboard.ts | 9 | 9/9 ✅ | 6 tile 真实 + siteCode 切换 + dataSource 显式 |
| test-tasks.ts | 11 | 11/11 ✅ | 列表/详情/暂停按钮 + toast + 控制链路 |
| test-sync.ts | 9 | 9/9 ✅ | HMAC 401 + packages + table log + DRY_RUN 标记 |
| test-control.ts | 19 | 19/19 ✅ | 6 commandType POST + 状态机 + 前端 toast |
| test-sites.ts | 9 | 9/9 ✅ | /api/sites derived (R.4 修复) + 8 端点联动 |
| test-search.ts | 13 | 13/13 ✅ | 501 not_implemented + UI banner + 3 siteCode |
| **合计** | **70** | **70/70** | 0 失败 |

### 5 项验证全绿

- ✅ `pnpm exec tsc --noEmit` — 0 错
- ✅ `pnpm build` — 23/23 静态页
- ✅ `pnpm smoke:sync` — passed
- ✅ `pnpm test:e2e:worker` — 3 命令 dry_run_success + audit_log
- ✅ `pnpm e2e:all` — 70/70

### 修复 3 类问题 (R.6 实施中发现)

1. **TS2451 重复声明** — 6 文件加 `export {}` 让 tsc 当 module
2. **HTTP 201 接受** — POST control_command 返 201 (不是 200), 断言放宽
3. **同步包 failed 验证** — API limit=20 hardcoded, 改 docker exec psql 直查

### R.6 范围严格

- ✅ 0 业务代码
- ✅ 0 新增页面/API/表
- ✅ 0 修改业务逻辑
- ✅ 仅: 6 个 e2e 脚本 + 1 实施文档 + 1 review + 2 文档段

### 仍未覆盖 (R.7+ 候选)

- 真实浏览器 (Playwright) — R.6 沙箱无
- console.error / React warning — 需真实 DOM
- network 错误 (4xx/5xx UI 表现)
- 真实用户点击 + 浏览器渲染

---

## Sprint R.5 — 前端事件测试强约束 (2026-06-10 完成)

> **核心**: 在 CLAUDE.md 新增第 10 强约束 (一票否决), 落地测试标准 + 占位脚本, **0 业务功能**。

### CLAUDE.md §10 强约束 (一票否决)

每次 Sprint 涉及前端/按钮/表单/API/mock→real 必须**同时产出 4 类验证**: 交互测试 + API 验证 + DB 验证 + 浏览器验证。

### 强制产出 (R.5 起)

- ✅ `docs/database-analysis/frontend-event-test-standard.md` (9 节, 6 类事件 + 9 项验收模板)
- ✅ `scripts/e2e/README.md` (6 个占位脚本计划, ~10 人天缺口清单)
- ✅ 6 个占位脚本: `test-{dashboard,tasks,sync,control,sites,search}.ts`
- ✅ `package.json` 加 7 个 scripts: `e2e:{dashboard,tasks,sync,control,sites,search,all}`
- ✅ `CLAUDE.md` 加 10 项禁止 (偷偷新增/不测点击/不测浏览器/toast 冒充/200 冒充...)

### 9 项 Sprint 验收模板 (A-I)

A. Requirement 对照 / B. 前端变更 8 项披露 / C. API 变更 / D. DB 变更 / E. 事件测试 10 项 / F. 浏览器验证 / G. mock/simulator/DRY_RUN 标记 / H. 未完成项 / I. **是否允许 commit**

### 10 项禁止 (R.5 新增)

1. 偷偷新增页面
2. 偷偷新增按钮
3. 写了按钮但不测点击
4. 写了 API 但不接前端
5. 接了前端但不测浏览器
6. 用 mock 冒充真实数据
7. 用 toast 冒充成功
8. 用 DRY_RUN 冒充真实执行
9. 用 200 响应冒充需求完成
10. 只跑 tsc/build 不跑业务事件测试

### R.5 范围严格

- ✅ 0 业务代码
- ✅ 0 新增页面 / 0 新增 API / 0 新增表
- ✅ 0 修改业务逻辑
- ✅ 仅: 1 CLAUDE.md 强约束 + 1 测试标准 + 1 scripts/e2e README + 6 占位脚本 + 7 package.json scripts

### R.5 缺口 (R.5+ 候选)

| 缺口 | 估时 | 建议 Sprint |
|---|---|---|
| test-tasks.ts 实际实施 | 2d | R.5+ (前端按钮 Sprint) |
| test-control.ts 实际实施 | 1.5d | R.5+ (控制命令 Sprint) |
| test-dashboard.ts / test-sync.ts / test-sites.ts / test-search.ts | 4d | R.5+ |
| Playwright 浏览器截图 | 3d | R.6 |

---

## Sprint R.4 — Bug 修复周 (2026-06-10 完成)

> **核心**: 修 Sprint R.3 发现的 6 个真实 bug, 0 业务功能, 0 新增页面/表/API。

### 6 个🔴 bug 修复结果

| # | Bug | 修复 | 真实度变化 |
|---|---|---|---|
| 1 | /api/tasks/[id] 100% 404 | 接 unified_tasks 真实查, UUID 校验, siteCode 过滤 | 0/100 → 100/100 |
| 2 | /api/search 404 | 显式 not_implemented 路由 + blocker banner | 0/100 → 100/100 (显式阻塞) |
| 3 | /api/sites 100% mock | 真实读 unified_sites + 派生 fallback | 10/100 → 90/100 |
| 4 | executor L342 假执行 | schema 检测 + dry_run_success/unsupported 显式 + 真连 site pool | 0/100 (exec) → 100/100 (fail-closed) |
| 5 | priority commandType 缺失 | 加 task_priority_restore (5→6 原子) | 0% → partial |
| 6 | R.2 out_of_scope 违规 | REQ-2.2.2/3.2.1 改 blocked_by_auth | 违规修正 |

### R.4 严格验收 (符合 R.1 模板)

- ✅ tsc/build/smoke/e2e:worker 全绿
- ✅ 0 业务功能, 0 新增页面, 0 新增表, 0 修改需求
- ✅ 0 行业务代码 (R.4 仅改 bug 文件 + 文档)

### R.4 文档更新

- ✅ `docs/database-analysis/requirements-traceability.md` (R.4 修正)
- ✅ `docs/database-analysis/requirements-traceability.json` (R.4 修正)
- ✅ `docs/database-analysis/sprint-r.4-requirements-review.md` (R.4 审查)

---

## Sprint R.2 — Requirements Traceability Matrix (2026-06-09 完成)

> **核心**: 基于 R.1 9 大强约束, 建立正式 43 原子需求 × 18 字段追踪矩阵, 作为后续所有开发的唯一验收依据。

### 关键产出

- ✅ `docs/database-analysis/requirements-traceability.md` (人类可读, 含 43 原子 × 18 字段)
- ✅ `docs/database-analysis/requirements-traceability.json` (机器可读, 自动化校验)
- ✅ 任务控制 6 原子专项 (暂停/恢复/重置/巡检/恢复/优先) — **不能消失**
- ✅ 4 项站点 schema DDL patch 建议 (paused/priority/verify_result/checksum)
- ✅ Top 10 下一步开发项, 按 requirements.md 优先级 (非 UI 排序)
- ✅ `docs/database-analysis/sprint-r.2-requirements-review.md` (R.1 模板严格审查)

### 43 原子需求完成度 (R.1 公式)

| 指标 | 数值 | 公式 |
|---|---|---|
| **总需求数** | **43** | (43 atomic) |
| **complete** | **9** | 20.9% |
| **partial** | **11** | 25.6% |
| **not_started** | **7** | 16.3% |
| **blocked_by_source_schema** | **6** | 14.0% |
| **blocked_by_site_change** | **5** | 11.6% |
| **blocked_by_auth** | **7** | 16.3% |
| **out_of_scope** | **2** | 4.7% |
| **requirements 完成率** | **9 / 41 = 22.0%** | complete / (total - out_of_scope) |

### 任务控制 6 原子状态 (170 张表全扫后)

| 原子 | REQ-ID | 真控制 | 链路 | UI | audit | Blocker |
|---|---|---|---|---|---|---|
| 暂停 | REQ-4.2.2 | 0% | 100% | ✅ | 100% | blocked_by_source_schema |
| 恢复 | REQ-4.2.2 | 0% | 100% | ✅ | 100% | blocked_by_source_schema |
| 重置 | REQ-4.2.2 | 0% | 100% | ✅ | 100% | blocked_by_site_change |
| 巡检 | REQ-4.2.3 | 0% | 100% | ❌ | 100% | blocked_by_site_change |
| 恢复任务 | REQ-4.2.3 | 0% | 100% | ❌ | 100% | blocked_by_site_change |
| 优先恢复 | REQ-4.2.2 | 0% | 100% | ❌ | 100% | blocked_by_source_schema |

### 站点 schema patch 建议 (4 项 DDL)

1. `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` (+ pause_reason, paused_at)
2. `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` (+ priority_source)
3. `ALTER TABLE tbl_check_patrol_task ADD COLUMN source_id/verify_result/checksum;` (3 列)
4. `ALTER TABLE tbl_hot_restore_record ADD COLUMN source_id/restore_priority;` (2 列)

### Top 3 阻塞 (待领导)

- **#1 ADFS (REQ-2.2.1)** — 解锁可带动 6 项 (~25 人天)
- **#2 站点 schema patch** — 任务控制 6 原子 + 巡检/恢复 真正落地
- **#3 站点 app poll** — 任务控制 6 原子真执行

### 禁止措辞 (R.1 §7 落地)

- ❌ "控制能力已完成" / "任务暂停已实现" / "需求完成度 85%"
- ✅ "控制队列框架完成" / "DRY_RUN 模拟完成" / "requirements 完成度 22.0%"

---

## Sprint R.1 — requirements.md 上升为最高验收标准 (2026-06-09 完成)

> **背景**: 项目已从"按数据库倒推需求"阶段进入"严格按需求验收"阶段。Sprint 4.8.2-R 暴露的问题: 任务控制需求被部分跳过 / 降级 / 误称完成, 必须用 9 大强约束强制规范。

### 9 大强约束 (CLAUDE.md 已落地)

1. **requirements.md 最高优先级** — 每次开发前后必须确认 / 审查
2. **需求状态枚举** — 8 选 1 (complete / partial / not_started / blocked_by_source_schema / blocked_by_site_change / blocked_by_auth / blocked_by_external_system / out_of_scope)
3. **严格验收** — 每次 Sprint 完成必须产出 10 字段审查文件
4. **任务控制硬约束** — 暂停/恢复/重置/巡检/恢复 6 原子动作必须以需求为准, 缺字段必须提 schema patch, 不允许伪造
5. **同步策略** — 完整 170 表库为审计基线, 大表走 ES/ClickHouse
6. **控制策略** — 总控必须保留控制能力路线, 不允许关闭需求
7. **禁止误导** — 措辞规范 (10 个禁止措辞 + 10 个必须措辞)
8. **提交前检查** — tsc + build + smoke + (worker e2e) 必须全绿
9. **文档同步** — PROJECT_STATUS + ROADMAP + requirements review 三件套

### 新增文件

- ✅ `docs/database-analysis/requirements-strict-review-template.md` — 13 段严格审查模板, 强制产出

### 关键修正 (CLAUDE.md 重写)

- ✅ 最高优先级文档表新增 `requirements-strict-review-template.md` (🚨 最高)
- ✅ 9 大强约束章节加入 "一票否决, 不可绕过"
- ✅ 附录 A: 站点 schema/API 变更建议模板 (Sprint 4.8.2-R 启动)
- ✅ 附录 B: requirements 完成率公式 (禁止用"业务完成度"代替)

### 任务控制需求当前状态 (基于 Sprint 4.8.2-R 170 张表全扫)

| 需求 | 当前状态 | Blocker | 真实完成路径 |
|---|---|---|---|
| REQ-4.2.1 新建任务 | `complete` | — | 已有 |
| REQ-4.2.1 暂停 | `partial` | blocked_by_source_schema | 站点表加 `paused` 字段 + 站点 app 读 |
| REQ-4.2.1 恢复 | `partial` | blocked_by_source_schema | 同上 |
| REQ-4.2.1 重置 | `partial` | blocked_by_site_change | 站点 app 改 `tbl_task.status` |
| REQ-4.2.2 优先执行恢复 | `partial` | blocked_by_source_schema | 站点表加 `priority` 字段 + 调度改造 |
| REQ-4.2.3 数据巡检 | `partial` | blocked_by_site_change | 站点 app poll `tbl_check_patrol_task` |
| REQ-4.2.3 恢复任务 | `partial` | blocked_by_site_change | 站点 app poll `tbl_hot_restore_record` |
| REQ-4.2.4 任务监控 | `partial` | — | 已有 UI + 监控数据 |

**禁止**:
- ❌ 把"audit 提交到 control_command" 称为"任务控制已完成"
- ❌ 把"DRY_RUN 模拟" 称为"真控制"
- ❌ 把"按钮接通" 称为"管控完成"

**只能说**:
- ✅ "控制队列框架完成"
- ✅ "DRY_RUN 模拟完成"
- ✅ "audit 链路完成"
- ✅ "等待站点 schema / app 配合后升级为真控制"

### 后续 Sprint 强制要求

**任何后续 Sprint 完成时, 必须产出 `docs/database-analysis/sprint-<X.Y>-requirements-review.md`, 否则不允许 commit。**

模板 13 段, 关键段: §1 Req IDs / §3 状态枚举 / §5 后端真实能力 / §7 Mock/Simulator/DRY_RUN/真控制 4 区分 / §10 schema/API 变更清单 / §12 verdict (pass/partial/fail)。

---

## Sprint 3.0R 需求对照审计 (2026-06-08)

需求 vs 实现 真实对照。完整审计见 `docs/database-analysis/sprint-3.0r-requirements-reality-check.md`。

### 4 个率

| 率 | 数值 | 含义 |
|---|---|---|
| **需求完成度** | **28.1%** (9/32) | 完整实现 ✅ |
| 业务完成度 | 85% (Sprint 3.0) | 4/4 同步类型 |
| **可演示率** | **64%** (4.5/7) | 真实数据 + 端到端 demo |
| **可落地率** | **64%** (7/11) | 生产可用功能 |

### 8 大能力现状 (一句话)

| 能力 | 现状 | 根因 |
|---|---|---|
| JWT | ❌ Mock UI 演示, 0 真实 | CLAUDE.md 禁止 |
| RBAC | ❌ 无实现 | CLAUDE.md + 源端 3 行无 role |
| 登录 | ❌ Mock UI, 418 行演示 | CLAUDE.md 禁止 |
| 同步 | ✅ **核心能力, 13/13 源表处理完成** | — |
| 文件检索 | ⚠️ 任务级, 不是跨站 ES | CLAUDE.md 禁止 ES |
| 恢复 | ✅ 监控完整, ❌ 不发起 | 设计选择 (单向 pull) |
| 设备控制 | ✅ 监控完整, ❌ 不控制 | 设计选择 (单向) |
| 审计 | ⚠️ 同步层有, ❌ 业务操作 | CLAUDE.md 禁止登录/权限 |

### 32 项需求分布

| 状态 | 数量 | 占比 |
|---|---|---|
| ✅ completed | 9 | 28.1% |
| ⚠️ partial | 10 | 31.3% |
| ❌ not_started | 11 | 34.4% |
| 🚫 out_of_scope (CLAUDE.md 主动不做) | 2 | 6.3% |

### 14 项不可实现原因分布

| 类型 | 数量 | 说明 |
|---|---|---|
| CLAUDE.md 禁止项 | 8 | 登录/SSO/JWT/RBAC/审计/部门/ES/ClickHouse |
| 源端无数据 | 5 | tbl_site/tbl_platform/tbl_depa/tbl_file/tbl_folder 0 行 |
| 源端 schema 缺字段 | 4 | errorMessage/progress/checksum/移位 |
| 设计选择 (单向) | 2 | 任务控制/设备控制 |

### 下一阶段唯一推荐

**Sprint 3.7 — Racks slot drawer 真实数据 (ROI 5)**:
- 396 行 unified_slots 真实数据已有
- Racks 页面缺 slot 明细
- 1 个 drawer + 1 个 API 增强
- 完成后业务完成度 85% → 88%

**不再推荐**: 接新表 (133 张理论表 0 行) / 登录权限 (CLAUDE.md) / ES (CLAUDE.md) / 任务控制 (单向设计) / 设备控制 (单向设计)

---

## 已完成功能

### 中心库 (PostgreSQL 17)
- `unified_tasks` — 任务主表
- `unified_devices` — 设备主表
- `unified_volumes` — 逻辑卷主表
- `unified_disc_media` — 物理盘片
- `unified_hard_disks` — 硬盘主表
- `unified_slots` — 盘位明细中心表（当前仅 1 条 package 测试记录）
- `unified_file_index` — 任务级文件索引 (Sprint 2C.18)
- `unified_folder_index` — 任务级目录索引
- `sync_package_log` — 同步包日志
- `sync_table_log` — 同步表日志

### API
| 端点 | 数据源 | 状态 |
|---|---|---|
| `GET /api/tasks` | unified_tasks | ✅ 真实数据 (含 Sprint 2F.1 runtime/progress 等 8 字段) |
| `GET /api/tasks/[id]` | unified_tasks | ✅ |
| `GET /api/tasks/[id]/files` | unified_file_index | ✅ (Sprint 2C.19) |
| `GET /api/racks` | unified_devices | ✅ |
| `GET /api/racks/[id]` | unified_devices | ✅ |
| `GET /api/racks/[id]/slots` | unified_slots | ✅ 真实中心库；无明细返回 empty |
| `GET /api/volumes` | unified_logical_volumes | ✅ |
| `GET /api/sync/logs` | sync_package_log | ✅ |
| `GET /api/sync/packages` | sync_package_log | ✅ (Sprint 2D.4) |
| `POST /api/sync/package` | dispatch registry | ✅ (Sprint 2D.2, HMAC Sprint 2G.1) |
| `GET /api/dashboard/summary` | unified_* + sync_package_log | ✅ (Sprint 2G.2) |
| `GET /api/dashboard/recent-syncs` | sync_package_log | ✅ (Sprint 2G.2) |

### 前端页面
- **Tasks** (`/tasks`) — 真实任务列表 + 详情 drawer + 文件索引后置
  - Sprint 2F.3 收口: 数据源徽章 (DB / MOCK) + 实时运行字段空态 (speed/remainingTime → "暂无实时数据")
  - 进度展示: null/0 → "—", completed → "100%"
  - 运行耗时格式化: 28s / 5m31s / 1h12m
  - 计数字段保留 0 (真实 0 区别于 null)
  - 错误信息过滤 "0" 占位符
  - 多线程封包/重试次数/数据分类 在 API 模式统一空态 (mock 模式保留)
- **Racks** (`/racks`) — 设备列表
- **Sync Center** (`/sync`) — package/table 同步日志
- **Volumes** (`/volumes`) — Sprint 2H.4 上线, 5 个真实 volume, 3 个含 _aggregate 聚合 (slot_count/online/offline), 顶部 4 tile 统计 + 列表 + Drawer 详情

### 同步能力
- **小表 CLI import** — 9 张小表 + file-index
- **package endpoint** — 接收站点推送 (Sprint 2D.2 起)
- **file-index** — 任务级文件/目录索引 (taskId + watermark + limit)
- **package-log/table-log** — 全程追踪
- **Sprint 2F.4 全局 siteCode 筛选** — Header 站点选择器, Tasks/Racks/Sync Center 自动联动, localStorage 记忆 + URL 同步, 支持 All Sites 视角
- **Sprint 2G.1 /api/sync/package HMAC 鉴权** — 写入入口强制 HMAC-SHA256, 5 分钟时间窗, rawBody 优先签名, `crypto.timingSafeEqual` 防侧信道, strict/dev 双模式
- **Sprint 2G.2 Dashboard 真实总览** — 6 项总览 tile (任务/设备/卷/用户/包/最后同步) + 最近 10 条同步记录, 跟随全局 siteCode, 7/7 SQL 对账匹配, mock 模式自动隐藏
- **Sprint 2G.3 任务域盘点** — 13 张 tbl_* 中只有 3 张任务表 (task/lib_task/user_task), 7 张"假定存在"表全部不存在, runtime 推算为 P0 唯一可补
- **Sprint 2H.1 站点 Package Exporter 模拟器** — `pnpm export:package` / `push:package` / `export-and-push`, 7 张表端到端签名推送
- **Sprint 2H.1R Dispatcher 覆盖率审计** — 13 张白名单 5/5/3 (A/C/D), 3 张 D 类 (magzines/slots/logical_volume) 字段名错配
- **Sprint 2H.2 Dispatcher 真实落库修复** — 3 张 D 类全部修成 A 类, sourceIdField/列映射修正, inlineUpsert 统计口径修正 (failed/partial/skipped 真实反映), 真实可用率 38.5% → 61.5%
- **Sprint 2H.3 3 张占位表聚合器** — `tbl_lib_task` → `unified_tasks.runtime_seconds` (33/44 任务 75% 真实覆盖), `tbl_volume_slot` → `unified_volumes.raw_data._aggregate` (15/25 volume 真实 slot_count/online/offline), `tbl_user_task` → `unified_tasks.raw_data._aggregate.user_task_count` (27/44 真实关联数), dispatcher 从 `skip: true` 升级为调用聚合器, 真实可用率 61.5% → 84.6%
- **Sprint 2H.4 /volumes 页面** — `app/volumes/page.tsx` 完整页面 (顶部 4 tile: 卷总数/容量/盘位/聚合覆盖 + 列表 + Drawer 详情), `VolumeDTO.aggregate` 透传 `_aggregate`, 侧边栏 "存储卷" 入口, 把 2H.3 写入的真实数据落地到 UI
- **Sprint 2H.5 Tasks 列表 runtime 列** — Tasks 表格新增"运行耗时" 列, `formatRuntime(t.runtime)` 真实展示 2H.3 写入的 33/44 任务 runtime (75% 真实覆盖)
- **Sprint 2H.6 inlineUpsert inserted/updated 区分** — `RETURNING (xmax = 0) AS is_insert`, 全部 13 张白名单表真实区分 inserted vs updated, route.ts 透传 `TableSummary.inserted/updated`, 端到端 5+5 验证通过 (新 source_id → inserted, 重复 source_id → updated)
- **Sprint 3.0 全库业务价值审计** — 13/13 源表真实接入, 11 类需求源端缺失或禁止, 业务完成度 85%
- **Sprint 3.0R 需求对照** — 32 项需求矩阵 (✅ 9 / ⚠️ 10 / ❌ 11 / 🚫 2), 需求完成度 28.1%
- **Sprint 3.1 部署指南** — 完整 6 步启动 + HMAC + siteCode + 一键检查
- **Sprint 4.0 需求实现矩阵** — 40 个原子需求, 4 层映射, 6 状态分类
- **Sprint 4.1 任务控制能力审计** — 7 个原子动作 0 真实, 16 接口 + 13 字段 MVP
- **Sprint 4.2 PG 备份审查 + 同步策略收敛 + 控制方案 2 选 + 路线图** — 170 源表 / 13 白名单 (7.6%), 收口每小时同步, 设计 SSO 跳转 + 控制队列 2 方案
- **Sprint 4.5 control_command 控制队列 MVP** — 1 张表 (16 字段) + 1 service (5 函数) + 5 API (3 总控 + 2 站点) + Tasks 按钮接通 (暂停/恢复/重置, 不改 unified_tasks) + /control 列表页 + sidebar 入口, 端到端 8 步全过, tsc/build/smoke 全部干净

## 已接入表 (13 张)

| 源表 | target | sync_mode | status |
|---|---|---|---|
| tbl_task | unified_tasks | full | done |
| tbl_disc_lib | unified_devices | full | done |
| tbl_magzines | (unified_devices join) | aggregate | done |
| tbl_slots | unified_devices 汇总 + unified_slots 明细 | full/aggregate | partial：汇总完成，明细待站点真实 package |
| tbl_hd_info | unified_hard_disks | full | done |
| tbl_lib_task | (unified_tasks join) | aggregate | done (Sprint 2H.3) |
| tbl_disc | unified_disc_media | full | done |
| tbl_logical_volume | unified_logical_volumes | full | done |
| tbl_volume_slot | (unified_volumes join) | aggregate | done (Sprint 2H.3) |
| tbl_user_task | (unified_tasks join) | aggregate | done (Sprint 2H.3) |
| tbl_user | unified_users | full | done (Sprint 2E.2) |
| tbl_site | unified_sites | full | done (Sprint 2E.2) |
| tbl_platform | unified_platforms | full | done (Sprint 2E.2) |
| tbl_file | unified_file_index | incremental (taskId+watermark+limit) | partial |
| tbl_folder | unified_folder_index | incremental | partial |

**累计 13 张源表 done + 2 张大表 partial (file-index)**

## 未完成

### 短期
- 让站点按真实 `tbl_slots` 字段推送盘位明细，并修正 package mapper
- 补充任务实时进度、速度、剩余时间的站点数据源
- 多站点筛选
- 同步日志页面 UI 增强
- package 鉴权 (生产 API key / mTLS)
- package 严格 checksum (SHA-256)

## Sprint 4.8.2 站点控制真相审计 (2026-06-09)

### 初版 (基于 source_restore 13 张表)
- **结论**: 站点库**完全没有被外部控制的机制** (0 control/command/queue 表, 0 函数, 0 触发器, 0 视图)
- **关键发现**: `tbl_task.status` 无 "paused" 语义, 无 priority 字段. 即使修改 `tbl_task.status` 也**无证据**说明站点应用会执行
- **Site Worker 现状**: 框架 + audit + simulator, **不是执行器**. 5 个 commandType 全部降级为 "审计总控意图"
- **前端按钮**: 维持当前状态 (暂停/恢复/重置 已删, 不恢复). 推进/标记完成/失败 保留 (本地 UI, 不误导)
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md`

### 重审版 (基于 star_storage_db 170 张表) — Sprint 4.8.2-R
- **数据库**: 完整 PG 物理备份恢复 (`/Users/tian/Desktop/20260601`), 170 张表 (vs source_restore 13 张)
- **新发现**:
  - ✅ **3 张表有 cron** (`tbl_schedule_job`, `tbl_data_receive_list.schedule_cron`, `tbl_check_patrol_strategy.cron`)
  - ✅ **7 张表有 progress** (`tbl_hot_backup_record`, `tbl_hot_restore_record`, `tbl_interface_task.job_progress` 等)
  - ✅ **79 张表有 status 字段** (state machine 基础完整)
  - ✅ 调度/进度/状态机基础设施**完整存在**
- **仍然没有**: `paused` / `priority` / `pause` / `resume` / `reset` 字段 (**全库 0 命中**)
- **新候选 control 表**:
  - `tbl_hot_restore_record` (recovery_start 目标, 含 progress/status/error_message)
  - `tbl_hot_backup_record` (热备目标)
  - `tbl_check_patrol_task` (inspect_start 目标, 含 status/success_count/fail_count)
  - `tbl_data_receive_list` (数据接收/巡检入口, 含 schedule_cron)
- **结论修正**: 从 "D 完全没有" → "A + B + C 部分支持" (有基础设施, 但缺关键 paused 字段, 无应用代码 evidence)
- **Site Worker 角色升级**: simulator → **调度编排 + 审计监控**
- **5 dispatch 重映射** (Sprint 4.9+ 实施, 需领导确认):
  - inspect_start → `tbl_check_patrol_task` 或 `tbl_data_receive_list`
  - recovery_start → `tbl_hot_restore_record`
  - task_pause/resume/reset → 维持 audit (无 paused 字段)
- **前端按钮恢复** (Sprint 4.8.2-R 落地):
  - Tasks 表格操作列 + 详情抽屉新增 **暂停 / 恢复 / 重置** 3 按钮
  - 调用走 `POST /api/control/commands` (audit/simulator, 不直接改 `unified_tasks`)
  - Toast 文案明确: "已提交到控制队列, 等待站点拉取执行" (不误导用户)
- 详见 `docs/database-analysis/sprint-4.8.2-site-control-reality-audit.md` (重写版)

### Overnight Verification (Sprint 4.8.2-R, 2026-06-09)
- **DB 验证**: `star_storage_db` 170 张表确认, 全库扫描 0 paused/priority 命中
- **Site Worker DRY_RUN**: 5/5 命令 (task_pause/resume/reset/inspect_start/recovery_start) 通过 worker 拉取, 写入 audit_log 5 行 (1:1 对应)
- **UI 按钮**: 暂停/恢复/重置 走 control_command POST → 3/3 ok, toast 文案合规, API mode only
- **smoke + siteCode**: smoke:sync passed, 4 端点 (Tasks/Racks/Volumes/Sync) siteCode 过滤一致
- **未解决限制**: paused/priority 字段全库 0 命中, 站点应用 poll 行为无 evidence
- **报告文件**: `docs/audit/sprint-4.8.2-r/REPORT.md` (含 CSV/JSON/Markdown)
- **统计**: control_command 37 total (29 success / 7 failed / 1 inflight), audit_log 35 total (11 in last hour)

## Sprint 2D.6 结论

- Racks 盘位格子不再根据 `totalSlots` 推断为空闲。
- API mode 仅显示 `unified_slots` 已同步明细；没有明细时显示空态并保留汇总。
- Tasks 的非完成任务没有可靠实时进度来源，继续显示 `—`，不做自动增长。
- `speed`、`remainingTime`、未同步的 `sm3Status` 均显示 `—`。
- 设备控制 API 未实现；API mode 继续明确提示，不伪造成功。

### 中期
- 站点侧推送客户端 (CLI / Agent)
- P1 小表 package 化 (tbl_user / tbl_site / tbl_platform)
- 站点同步调度器 (每小时触发)

### 长期
- ES 接入 (tbl_file / tbl_folder 全文检索)
- ClickHouse 接入 (tbl_sys_log / tbl_api_log)
- 鉴权 / SSO
- 审计 / 报表 / 告警
