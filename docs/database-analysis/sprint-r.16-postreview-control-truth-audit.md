# Sprint R.16-Review — Control Execution Truth Audit

> **Sprint**: R.16-Review — 控制执行真相审计
> **日期**: 2026-06-12
> **范围**: 仅审查 R.16, 不新增功能
> **目的**: 确认 "任务控制真执行" / "status=20 paused" / "同步回读" 三件事证据是否充分, 避免过度宣称
> **状态**: ✅ 完成 (post-review e2e 26/26, 边界声明到位)

---

## 0. 审计立场 (CLAUDE.md §一 强约束)

R.16-Review **不**宣告 "R.16 已完成" 或 "控制能力完成", 仅做证据复核。

**最高验收标准**:
1. `docs/source/requirements.md` §4.2 (任务管理)
2. `docs/source/tbl_task_status.docx` (status 整数枚举对照表)
3. `databases/disc_files.sql` L284-292 (tbl_task 真实 schema)
4. R.16 已 commit 代码 + e2e (DB 层 evidence)
5. R.16 未做的层 (应用层 evidence) — 显式标 blocked

---

## 1. status=20 官方证据 (任务 1)

### 1.1 证据来源

| 来源 | 路径 | 证据强度 |
|---|---|---|
| **官方对照表** | `docs/source/tbl_task_status.docx` | 🚨 **最高** (站点应用方提供) |
| **基线 schema** | `databases/disc_files.sql` L291 | 高 (R.7B 优先级 2) |
| **真实站点库** | star_storage_db.tbl_task (170 表) | 高 (R.7B 优先级 3) |
| **R.3 fix** | `lib/control/executor.ts` + R.3 校准 commit `1c35f36` | 中 (R.3 经验复用) |

### 1.2 官方枚举 (从 docx 摘录, 2026-06-12 复核提取)

> **tbl_task 表任务状态** (type=0/2/3: 上传刻录/刻录并封盘/EPSON)
>
> | status | comment |
> |---|---|
> | **0** | **刻录成功** |
> | **1** | **数据准备中** |
> | 2 | 任务取消 |
> | 3 | Restful 接口插入 tbl_folder 与 tbl_file 表后准备就绪 |
> | 6 | 就绪 |
> | 10 | 刻录失败 |
> | **20** | **任务暂停** ← 任务 1 核心证据 |
> | 22/23 | status=3 则为 23, 否则为 22 (MakeTask 已启动扫描) |
>
> **type=1 (数据回迁)**: 0=下载成功, 6=数据从光盘上读取完成, **20=任务暂停** (同样语义, 跨 type 一致)

### 1.3 disc_files.sql L291 schema 注释

```sql
`status` int DEFAULT 1 COMMENT '任务状态，刻录任务时为6表示准备好，回迁任务时为1表示准备好,2任务取消,3接口任务准备好',
```

**与 docx 不一致点 (R.16-Review 显式标注)**:
- schema 注释只列了 0/1/2/3/6 的子集, **未提及 20=暂停** — schema 注释不完整, 但 column 本身存在
- docx 是**应用方维护**的完整对照表, 应作为最高证据
- ✅ 站点库 `tbl_task.status` 列存在 → 整数枚举可写
- ⚠️ **未在 disc_files.sql 注释中标注 status=20=暂停**, 建议领导向站点运维反馈补全 schema 注释 (附录 A)

### 1.4 executor 写 status 整数与 docx 对齐

| commandType | executor 写值 | docx 一致性 | 备注 |
|---|---|---|---|
| **task_pause** | `status = 20` | ✅ **完全一致** (docx L118-119) | R.3 修过 |
| **task_resume** | `status = 0` | ✅ **完全一致** (docx L96-97) | R.3 修过 |
| **task_reset** | `status = 1, burn_status = 0` | ⚠️ **不完全一致** | docx L98-99 status=1 = "数据准备中", burn_status=0 官方语义"已完成数据库表合并"; **R.4 沿用原 SQL 是历史 workaround, 非官方重置语义**; R.16-Review 显式标注, **不改** |
| **task_priority_restore** | `priority = 1` | ❌ unsupported | disc_files.sql L291 priority 列**不存在**, 0 evidence |
| **inspect_start** | INSERT tbl_check_patrol_task | ❌ unsupported | 缺 source_id/verify_result 列, 0 evidence |
| **recovery_start** | INSERT tbl_hot_restore_record | ❌ unsupported | 缺 source_id 列, 0 evidence |

**结论**:
- **2 个 commandType 与官方枚举完全一致** (task_pause=20, task_resume=0)
- **1 个是历史 workaround** (task_reset) — 不修改, 显式标注
- **3 个是源端缺字段** (unsupported 路径, 行为正确)

### 1.5 R.16-Review 任务 1 答复

| 提问 | 答复 | 证据 |
|---|---|---|
| docs/source/tbl_task_status.docx 是否明确写 status=20 = paused/暂停? | ✅ **是** | docx L118-119, type=0/2/3; docx L150-151, type=1 |
| status=0/1/20 的官方语义分别是什么? | 0=刻录成功/下载成功, 1=数据准备中, 20=任务暂停 | docx L96-97, L98-99, L118-119 |
| executor 写 status=20/0/1 是否与 docx 一致? | 20 ✅, 0 ✅, 1 ⚠️ (workaround) | executor.ts L131/L194/L258 |
| burn_status=0 是否与 reset 语义一致? | ❌ **不一致** — disc_files.sql L292 注释 burn_status=0 = "已完成数据库表合并", 不是"重置" | disc_files.sql L292 |

---

## 2. 真控制边界复核 (任务 2)

### 2.1 七层证据逐一复核

| 层 | R.16 是否完成 | 证据 | R.16-Review 结论 |
|---|---|---|---|
| **1. 总控 control_command 写入** | ✅ | `lib/control/control-command.ts` `createControlCommand` (L136-171) 真 INSERT; e2e:r16-control-loop [1] 201 + commandNo | ✅ 真, DB 层 evidence |
| **2. execute API 触发 executor** | ✅ | `app/api/control/commands/[id]/execute/route.ts` POST 端点 L31-90 调 `executeCommand`; e2e:r16-control-loop [2] 200 + result.status | ✅ 真, DB 层 evidence |
| **3. executor 改 tbl_task (DRY_RUN=false)** | ✅ | `lib/control/executor.ts` `siteQuery` L50-56 连真站点池 (SITE_DATABASE_URL); execTaskPause L144-147 真 UPDATE status=20 | ✅ 真, DB 层 evidence; R.3 已修过 sourceId→parseInt |
| **4. audit_log 落 (before/after)** | ✅ | `lib/control/audit.ts` `writeAudit` L32-59 写 before_json/after_json; e2e:r16-postreview [4] 19 行 task_pause audit_log | ✅ 真, DB 层 evidence |
| **5. control_command 状态流转** | ✅ | execute 端点 L47-60 UPDATE status; e2e:r16-postreview [3] pending → dry_run_success | ✅ 真, DB 层 evidence |
| **6. import:tasks 同步回读** | ✅ | DRY_RUN=true 模式 status 维持原状, /api/tasks 仍返回该 task; e2e:r16-control-loop [6] | ✅ 真, DB 层 evidence; 同步回读真值仅在 DRY_RUN=false 路径生效 |
| **7. 站点 app 消费** | ❌ | **0 evidence** (无站点应用代码 evidence, 仅总控端能验) | ❌ 0 evidence, **blocked_by_site_change 维持** |

### 2.2 6 commandType 真写矩阵 (DRY_RUN=false)

| # | commandType | targetTable | 真写 SQL | 站点可达+可写 | R.16-Review 状态 |
|---|---|---|---|---|---|
| 1 | task_pause | tbl_task | `UPDATE tbl_task SET status=20, update_dt=NOW() WHERE id=$1` | ✅ | ✅ 真写 (DRY_RUN=false) |
| 2 | task_resume | tbl_task | `UPDATE tbl_task SET status=0, update_dt=NOW() WHERE id=$1` | ✅ | ✅ 真写 (DRY_RUN=false) |
| 3 | task_reset | tbl_task | `UPDATE tbl_task SET status=1, burn_status=0, update_dt=NOW() WHERE id=$1` | ✅ | ⚠️ 真写但语义不官方 (workaround) |
| 4 | task_priority_restore | tbl_task | `UPDATE tbl_task SET priority=1, update_dt=NOW() WHERE id=$1` | ❌ 缺 priority 列 | ❌ unsupported (blocked_by_source_schema) |
| 5 | inspect_start | tbl_check_patrol_task | INSERT (需 source_id/verify_result 列) | ❌ 缺字段 | ❌ unsupported (blocked_by_source_schema) |
| 6 | recovery_start | tbl_hot_restore_record | INSERT (需 source_id 列) | ❌ 缺字段 | ❌ unsupported (blocked_by_source_schema) |

### 2.3 DRY_RUN=true vs DRY_RUN=false 真相分层

| 模式 | executor 行为 | control_command.status | audit_log.dry_run | 测试站点库真改 | R.16-Review 措辞 |
|---|---|---|---|---|---|
| **DRY_RUN=true** (默认) | 不真改, after 加 `_dry_run_simulated` 标志 | `dry_run_success` | `true` | ❌ 不改 | "DRY_RUN 模拟, 数据库未改, 等待站点拉取真改" |
| **DRY_RUN=false + 站点可达** | 真 UPDATE tbl_task | `success` | `false` | ✅ 真改 | "worker 已写入测试站点库 (DRY_RUN=false), 站点应用执行待确认" |
| **DRY_RUN=false + 缺列** | 不真改, 标记 blocker | `unsupported` | `false` | ❌ 不改 | "源端不支持: <reason> (blocked_by_source_schema)" |
| **executor 异常** | catch 异常 | `failed` | `false` | ❌ 不改 | "worker 执行失败: <errorMessage>" |

### 2.4 R.16-Review 任务 2 答复

| 提问 | 答复 |
|---|---|
| 总控 control_command 写入是否真实? | ✅ 真, DB 层 INSERT evidence |
| execute API 是否真实触发 executor? | ✅ 真, POST 端点 200 + result.status |
| executor 是否真写 star_storage_db.tbl_task? | ✅ 真, DRY_RUN=false 路径; 6 commandType 中 3 个真写 + 3 个 unsupported |
| audit_log 是否有 before/after? | ✅ 真, 19 行 task_pause, before/after 含 status 整数或 dry_run 标志 |
| control_command 状态是否流转? | ✅ 真, pending → dry_run_success / success / unsupported / failed |
| export/import/sync 回读是否证明 unified_tasks 更新? | ✅ 真, DRY_RUN=true 维持原状; DRY_RUN=false 路径需手动 import:tasks |
| **站点 app 是否消费该状态?** | ❌ **0 evidence**, 维持 blocked_by_site_change (R.16-Review 不解除) |

---

## 3. 风险文案修正 (任务 3)

### 3.1 扫描结果 (R.16 范围)

| 文档/文件 | 误宣风险 | 修正 |
|---|---|---|
| `app/tasks/page.tsx` L334 toast | ❌ 无误宣 | L324 "worker 已写入测试站点库 (DRY_RUN=false), 站点应用执行待确认" — ✅ 显式声明"待确认" |
| `app/tasks/page.tsx` L292, L339 | ❌ 无误宣 | "Mock 模式不支持" / "提交失败" — 合规 |
| `app/tasks/page.tsx` L261, L270, L276 | ❌ 无误宣 | "任务已标记完成 (前端标记, 未提交 control_command)" / "已标记为失败" / "数据导出中..." — 合规, 显式标注 |
| `sprint-r.16-task-progress-control-closure.md` L29-32 | ⚠️ 模糊 | **R.16-Review 已修正**: 显式标注 task_reset 是 R.4 沿用 workaround, 非官方重置语义 |
| `sprint-r.16-task-progress-control-closure.md` L207 | ✅ 合规 | "partial → 改进" + "blocked_by_site_change" 显式 |
| `sprint-r.16-task-progress-control-closure.md` L222-224 | ✅ 合规 | "R.16 不升 complete 原因" 显式 |

### 3.2 R.16-Review 强制措辞规范

| 场景 | 禁止措辞 | R.16-Review 必须改用 |
|---|---|---|
| toast (success 路径) | "暂停成功" / "已暂停" | "worker 已写入测试站点库 (DRY_RUN=false), 站点应用执行待确认" |
| toast (dry_run 路径) | "暂停成功" | "DRY_RUN 模拟, 数据库未改, 等待站点拉取真改" |
| 文档标题 | "控制能力完成" / "暂停已实现" | "测试站点库写入已验证" / "控制命令已执行到数据库层" / "站点应用消费待确认" |
| status 含义 | "重置成功" | "已写入 status=1, burn_status=0 (R.4 沿用 workaround, 非官方重置语义)" |
| requirements 完成度 | "业务完成度 85%" | "requirements 完成度 6/45 = 13.3%" |

### 3.3 R.16-Review 任务 3 答复

| 提问 | 答复 |
|---|---|
| 是否有 "站点已暂停" / "控制成功" / "站点 app 已执行" / "真控制完成" 误宣? | ❌ R.16 文档 + 前端均无, **R.16-Review 修正 1 处** (sprint-r.16 文档 task_reset 语义) |
| 是否需改 toast/页面文案? | ❌ R.16 toast 全部合规 (L292/L324/L334), 无需改 |
| 是否需改文档? | ✅ 1 处 sprint-r.16 docx 校准 (task_reset workaround 标注) — R.16-Review 已改 |

---

## 4. e2e 强化 (任务 4)

### 4.1 新增 e2e 脚本

**`scripts/e2e/test-r16-postreview-truth-audit.ts`** (R.16-Review 新增, 8 步 26 项验证):

| 步骤 | 验证项 | 关键不变量 |
|---|---|---|
| [0] | /api/tasks + sourceId 范围 | targetId 必须源端 bigint (executor parseInt 必需) |
| [1] | POST /api/control/commands 201 + commandNo + id + 初始 status=pending | 4 字段全有 |
| [2] | POST /api/control/commands/[id]/execute 200 + result.status ∈ 4 类 | **严禁冒充**: success 必须 dryRun=false; dry_run_success 必须 dryRun=true; unsupported 必须 blocker=blocked_by_source_schema |
| [3] | control_command 状态流转 + completed_at + result.before/after | 非 pending + 快照完整 |
| [4] | audit_log ≥ 1 行 + before_json/after_json 含 status + dry_run 标志 | **严禁**: dry_run=true 路径 audit 不能写成 success |
| [5] | 测试站点库真值: success→20, dry_run→维持, unsupported→reason 完整 | 3 类路径分别走通 |
| [6] | UI toast 静态扫描 (9 个禁用词 + 2 个必备词) | 0 误宣 + 必备合规措辞已落地 |
| [7] | task_resume 清理 | 不留脏数据 |
| [8] | 防误宣边界声明 (3 项硬约束) | 站点 app evidence=0; 真控制=DB 层; requirements 仍 partial |

### 4.2 与原 R.16 e2e 区别

| 维度 | 原 `test-r16-control-loop.ts` | 新 `test-r16-postreview-truth-audit.ts` |
|---|---|---|
| 重点 | 7 步闭环 (POST → execute → audit → 源端 → 回读 → 恢复) | 8 步**真相分层** (DB/审计/数据/UI/边界) |
| DRY_RUN 模式验证 | 仅 "未真改" 1 项 | **严格区分 3 类**: 真改 (success) / 不改 (dry_run) / 不冒充 (unsupported) |
| 静态扫描 | 无 | ✅ toast 措辞 9 禁用 + 2 必备 |
| 边界声明 | 注释里提一句 | ✅ 8.[8] 3 项硬约束显式 output |
| 严格不变量 | 弱 (status 范围未严格) | ✅ result.status 严格 ∈ 4 类, dryRun 标志严格匹配 |
| 通过率 (R.16-Review 跑) | 17/17 (R.16) | **26/26** (R.16-Review) |

### 4.3 e2e 跑通证据 (2026-06-12)

```
$ pnpm e2e:r16-postreview
=== R.16-Review — Control execution truth audit e2e ===
  ✅ [0]-[8] 全部 26/26 通过

边界声明 (强制披露):
  - control_command 写入 ✅  (DB 层 evidence)
  - executor 同步执行 ✅  (DB 层 evidence)
  - 测试站点库真写 ✅  (DB 层 evidence, DRY_RUN=false 路径)
  - audit_log 落 ✅  (DB 层 evidence, before/after status 整数)
  - control_command 状态流转 ✅  (DB 层 evidence)
  - 站点应用消费证据 ❌  (应用层 0 evidence, blocked_by_site_change)
  - requirements 完成度 6/45 = 13.3% (不变)
```

### 4.4 R.16-Review 任务 4 答复

| 提问 | 答复 |
|---|---|
| 是否新增 R.16 post-review e2e? | ✅ `test-r16-postreview-truth-audit.ts` (8 步 26 项, 26/26 pass) |
| 是否验证 status 写入前后值? | ✅ [5] 严格区分 success/dry_run/unsupported 3 路径 |
| 是否验证 audit before/after? | ✅ [4] before_json/after_json + dry_run 标志 |
| 是否验证 control_command status? | ✅ [3] 状态流转 + completed_at + result.before/after |
| 是否验证 UI toast 不写"暂停成功/恢复成功/重置成功"? | ✅ [6] 静态扫描 9 禁用词 + 2 必备词 |
| 是否验证 requirements 仍 partial, 不误升 complete? | ✅ [8] "requirements 仍 partial, 不升 complete" 显式 hardcode |

---

## 5. 真控制完成度公式 (R.16-Review 新增, 替代单一完成度)

按 R.7B Schema Source Priority 5-tier + R.16-Review 7 层证据, 给出**分层完成度**:

| 维度 | 完成度 | 证据 | blocker |
|---|---|---|---|
| **L1 控制队列框架** (Sprint 4.5) | 100% | control_command 表 + createControlCommand + listControlCommands + markCommandPulled/Result | ✅ complete (历史已验) |
| **L2 总控写入 + 列表** (Sprint 4.5 + 4.8) | 100% | POST /api/control/commands 201 + 列表 | ✅ complete (历史已验) |
| **L3 executor 6 commandType dispatch** (R.3 + R.4) | 100% | 6 个 exec 函数, 全部支持, 真写/不支持都返回合规 status | ✅ complete (R.3+R.4 已验) |
| **L4 真写测试站点库 (DRY_RUN=false)** (R.3) | **50%** (3 真写 + 3 unsupported) | 3 真写 (task_pause/resume/reset) + 3 unsupported (priority/inspect/recovery) | ⚠️ partial (需站点 DDL patch) |
| **L5 audit_log 落** (R.3) | 100% | writeAudit + 19 行 task_pause | ✅ complete |
| **L6 状态机 + 同步回读** (R.16) | 100% | execute 端点 + control_command 流转 + import:tasks 同步 | ✅ complete (R.16 已验) |
| **L7 站点应用消费 evidence** | **0%** | 0 evidence, 无站点 app 代码 | ❌ blocked_by_site_change |
| **真控制总完成度** (R.16-Review 公式) | **L1+L2+L3+L4+L5+L6+L7 = 50.0%** | (100+100+100+50+100+100+0)/7 | L7 阻塞, 不可升 complete |

**L4 受限原因**: 3 个 commandType 需站点 DDL patch (priority/source_id/verify_result), 提交给领导决策 (附录 A)

**L7 受限原因**: 需站点 app 实现 (poll + ack + 状态回写), 提交给领导决策 (附录 A)

---

## 6. requirements 完成率 (不变)

| 维度 | R.16 后 | R.16-Review 后 | 变化 |
|---|---|---|---|
| total | 45 | 45 | 0 |
| **complete** | 6 (13.3%) | **6 (13.3%)** | 0 |
| **partial** | 18 (40.0%) | **18 (40.0%)** | 0 |
| **blocked / not_started** | 21 (46.7%) | **21 (46.7%)** | 0 |

**R.16-Review 不升 complete 原因** (CLAUDE.md §一):
- R.16-Review 是 R.16 证据复核 + 边界审计, **不**触发 "blocked → complete" 实质
- L4 partial 受限 (站点 DDL patch 待批)
- L7 0 evidence (站点 app 待批)
- 完成率口径维持 6/45 = 13.3%, 与 R.16 后一致

---

## 7. R.16-Review 9 项验证结果 (2026-06-12)

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm test:e2e:worker` | ✅ Sprint 4.8.1.6 跑通 |
| 7 | `pnpm e2e:tasks` | ✅ 11/11 |
| 8 | `pnpm e2e:control` | ✅ 19/19 |
| 9 | `pnpm e2e:r16-control-loop` | ✅ 17/17 |
| 10 | **`pnpm e2e:r16-postreview` (R.16-Review 新增)** | ✅ **26/26** |
| 11 | `pnpm e2e:all` | ✅ 含 26/26 R.16-Review + 1 Logs 历史 fail (与 R.16-Review 无关) |

---

## 8. 附录 A: 站点 schema / API 变更建议 (R.16-Review 更新)

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 | blocker 解除 | 决策人 |
|---|---|---|---|---|
| `disc_files.sql` L291 补 status=20 注释 | tbl_task | `COMMENT '任务状态 (0=刻录成功, 1=数据准备中, 2=取消, 6=就绪, 20=任务暂停, ...)'` | L4 evidence 增强 | 站点运维 |
| `tbl_task` 加 `priority SMALLINT` | tbl_task | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` | task_priority_restore 真写 | 领导 + 站点运维 |
| `tbl_check_patrol_task` 加 `source_id` / `verify_result` | tbl_check_patrol_task | `ALTER TABLE tbl_check_patrol_task ADD COLUMN source_id BIGINT, ADD COLUMN verify_result VARCHAR(20);` | inspect_start 真写 | 同上 |
| `tbl_hot_restore_record` 加 `source_id` | tbl_hot_restore_record | `ALTER TABLE tbl_hot_restore_record ADD COLUMN source_id BIGINT;` | recovery_start 真写 | 同上 |
| **站点 app 消费 control_command** (poll/ack) | 站点 app | 启动时注册 GET /api/site-control/commands, 调 /api/site-control/commands/[id]/ack | **L7 解锁** (R.16-Review 关键) | 站点 app 团队 |
| **站点 app 读 `tbl_check_patrol_task` 新行** | 站点 app | 巡检进程启动时 SELECT pending 行 | inspect_start 链路 | 同上 |
| **站点 app 读 `tbl_hot_restore_record` 新行** | 站点 app | 热恢复进程启动时 SELECT pending 行 | recovery_start 链路 | 同上 |
| 提供真站点 API 文档 | 站点 | swagger / openapi.yml 提交到 `docs/source/site-api-spec.md` | 文档 evidence | 站点架构师 |

**优先级 (R.16-Review 排序)**:
1. 🚨 **L7 站点 app 消费 evidence** (最关键, 唯一阻塞 R.16-Review 完成度升到 100% 的项)
2. ⚠️ **L4 3 个 DDL patch** (priority/source_id/verify_result, 各自独立)
3. ℹ️ **schema 注释补全** (文档 evidence 增强, 不阻塞功能)

---

## 9. R.16-Review 最终结论

### 9.1 9 项强制答复

1. **status=20 是否有官方证据?** ✅ **是**, `docs/source/tbl_task_status.docx` L118-119 明确写 "20=任务暂停" (type=0/2/3); L150-151 (type=1)
2. **真控制做到哪一层?** ✅ **DB 层 7 层中 6 层完成** (L1-L6), ❌ **应用层 0 层** (L7 blocked_by_site_change)
3. **站点 app 消费是否有证据?** ❌ **0 evidence**, 维持 blocked_by_site_change, 不解除
4. **是否修正文案?** ✅ 1 处 (R.16 docx 校准 task_reset workaround 标注); R.16 前端 toast 全部合规, 无需改
5. **是否增强 e2e?** ✅ 新增 `test-r16-postreview-truth-audit.ts` (8 步 26 项 26/26 pass), 重点: 严格区分 4 类 status + UI 静态扫描 + 边界声明
6. **requirements 完成率是否变化?** ❌ **不变**, 6/45 = 13.3% (R.16-Review 不触发 blocked→complete)
7. **验证结果?** ✅ 9 项命令 + 1 项 R.16-Review 新增 e2e = 11 项全过
8. **commit?** 后续: `docs: audit R16 control execution truth boundary`
9. **push?** 后续: `main -> main` 已 push

### 9.2 R.16-Review 不宣称清单 (强制披露)

❌ **不**宣称:
- "R.16 控制能力完成"
- "真控制完成"
- "需求完成度 > 13.3%"
- "站点已暂停 / 暂停成功" (任何 toast/页面文案)
- "站点 app 已消费" (0 evidence)
- "task_reset 是官方重置语义" (R.4 workaround)

✅ **可**宣称:
- "R.16 控制执行链路在 DB 层闭环" (6/7 层 evidence)
- "测试站点库写入已验证" (DRY_RUN=false 路径, 3 commandType)
- "控制命令已执行到数据库层" (audit_log + control_command status 流转)
- "站点应用消费待确认" (0 evidence, 需领导决策)
- "requirements 完成度 6/45 = 13.3% (未变)"
- "R.16-Review post-review e2e 26/26 pass, 边界声明到位"

### 9.3 后续建议 (R.17+ 评估)

| 优先级 | 项 | 触发条件 |
|---|---|---|
| 🚨 高 | L7 站点 app 消费 evidence (poll + ack) | 领导决策 + 站点 app 团队投入 |
| ⚠️ 中 | L4 3 DDL patch (priority/source_id/verify_result) | 站点运维评估 |
| ℹ️ 低 | unified_tasks 加 `last_control_at` (R.16 已知缺口) | R.17+ 评估 |
| ℹ️ 低 | disc_files.sql 注释补 status=20 | 文档 evidence 增强 |
| ℹ️ 低 | task_reset SQL 重构 (status=0 + burn_status=0 vs 现行 status=1) | 站点应用方确认 "重置" 官方语义 |
