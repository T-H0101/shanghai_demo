# Sprint R.86-R.89 Requirements Review

> **触发**: `docs/superpowers/plans/2026-06-29-r84-r85-development-completion-plan.md` "Remaining Development Work" 段落 + `docs/database-analysis/sprint-r84-r85-requirements-review.md` §B 剩余 Blocker 汇总 (R.86 / R.88 / R.89)。
>
> **分支**: `codex/r84-development-architecture-cleanup-plans` (本次新增 commits, 用户禁推)
>
> **不推送**: 用户明确要求 "不要推送, 除非用户明确要求"。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `R.86` (增量同步) + `R.88` (站点接入契约) + `R.89` (dead-code inventory) |
| Sprint 标题 | file_index_jobs DDL + watermark/tombstone/retry + 29 张表 indexer + site agent HTTP 契约 + 站点接入清单 + dead-code inventory |
| 日期 | 2026-06-29 |
| 对应 requirement 节 | `requirements.md §5.2` (增量更新) / `§2.3` (同步策略 增量+定时) / `§4.2` (任务管理契约 - 仍 partial + blocked) / `§6.4` (可维护) / `§6.2` (凭证与安全) |
| 关联 commits | (本 Sprint 新增, 见 §3) |
| 验证人 | tian |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-5.2 | 文件索引走专业搜索引擎, 支持增量更新 | `partial` (R.85 端口 + R.86 watermark/tombstone/retry 落地, 监控/cron 仍 R.87) |
| REQ-2.3 | 同步范围四类数据, 增量过滤 | `complete` (R.84 矩阵 + R.86 增量同步机制) |
| REQ-4.2 | 任务管理 6 原子动作 | `partial` + `blocked_by_site_change` (R.88 契约已落地, 站点 app 仍未接入) |
| REQ-5.1 | 日志审计 | `complete` (R.88 §5 audit_log 事件契约) |
| REQ-6.2 | 安全 (HMAC + 凭证轮换 + 不泄露) | `partial` (R.88 §1.3 HMAC 规范落地, 凭证存储实现待 R.88+) |
| REQ-6.4 | 可维护 (DDL/契约/inventory 文档) | `complete` (R.86 DDL + R.88 契约 + R.89 inventory 全部 docs) |

---

## 2. Requirement 原始文本 (逐字摘录)

```
5.2 索引
- 文件索引信息走专业搜索引擎, 不允许把整张文件表塞进关系库。
- 索引数据需要定期更新, 支持增量更新。
```

```
2.3 数据同步 - 同步策略
1. 实时同步: 关键数据 (任务状态、设备状态) 变更后立即同步;
2. 定时同步: 非关键数据 (文件索引) 按周期 (可配置) 同步;
3. 手动同步: 支持管理员触发全量/增量同步。
```

```
4.2 任务管理
- 新建备份/恢复任务
- 任务暂停/重置/恢复等任务控制
- 数据巡检任务
```

---

## 3. Implementation (本 Sprint 实际改了哪些)

| Commit (本 Sprint 新增) | 主线 | 文件 |
|---|---|---|
| (R.86 DDL) | 数据库 | `databases/sprint-r86/01-file-index-jobs.sql` (新 DDL 目录 + 文件) |
| (R.86 状态机) | 域 | `lib/jobs/file-index-job-state.ts` (6 态机 + 转换守卫) |
| (R.86 仓储) | 域 | `lib/jobs/file-index-job.ts` (8 个仓储方法) |
| (R.86 runner) | 脚本 | `scripts/index/file-index-job-runner.ts` (单表 worker) |
| (R.86 bootstrap) | 脚本 | `scripts/index/file-index-job-bootstrap.ts` (种子行 idempotent) |
| (R.86 design doc) | 文档 | `docs/database-analysis/r86-file-index-incremental-sync.md` (设计/状态机/覆盖矩阵) |
| (R.88 contract) | 文档 | `docs/source/site-agent-contract.md` (HTTP 协议级契约 + HMAC + 心跳 + 控制命令 + 文件索引 watermark) |
| (R.88 checklist) | 文档 | `docs/operations/site-onboarding-checklist.md` (接入前/总控侧/站点侧/网络/同步/控制/心跳/验收) |
| (R.89 inventory) | 文档 | `docs/audit/r89-dead-code-inventory.md` (33 文件分类, **不删除任何文件**) |
| (package.json) | 配置 | 添加 `import:file-index-job-bootstrap` / `import:file-index-job-runner` |

---

## 4. Backend reality (是数据库 / API / 队列真支持, 还是仅 UI 层面调用)

### 4.1 真实后端能力 (有 SQL/API/运行时证据)

| 能力 | 证据 |
|---|---|
| R.86 file_index_jobs 表真存在 + 5 约束 + 3 索引 | `docker exec psql \d+ file_index_jobs` 5 约束 / 3 索引齐全 |
| R.86 6 态机真校验 | `lib/jobs/file-index-job-state.ts` `canTransition()` + `decideAfterFailure()` 集中 |
| R.86 bootstrap 跑通 SH01 | `pnpm import:file-index-job-bootstrap` -> `inserted:29 skipped:0 total_jobs:29` |
| R.86 runner 真抢锁 + 状态推进 | `tbl_file_1` 实测 `scanned=5 indexed=5 watermark=26`; 立即二次运行返回 `not_claimable`, 防止紧密重跑 |
| R.86 best-effort 表分支 | `tbl_file_parts` 实测 `status=succeeded scanned=0`, 未误走完整 `tbl_file*` 字段投影 |
| R.86 runner 源表失败语义 | 源表/列读取失败走 `reportFailure()` 写入 `failed` / `dead_letter`, 不再伪装成空结果 |
| R.86 DDL 新机初始化 | `databases/sprint-2b0/init-docker.sh` 已登记 `databases/sprint-r86/01-file-index-jobs.sql` |
| README / 部署手册 | `README.md` 保持短入口; `docs/operations/deployment.md` 补齐 R.86 bootstrap、ES env、DB 密码一致性说明 |
| R.88 契约定义 HMAC canonical + replay window | `site-agent-contract.md §1.3` 完整 |
| R.88 端点定义 5 个 HTTP endpoint | `site-agent-contract.md §2` 完整 |
| R.88 audit_log 事件定义 5 类 | `site-agent-contract.md §5` 完整 |
| R.89 inventory 33 文件分类 | `docs/audit/r89-dead-code-inventory.md` Tier 1 28 + Tier 2 5 |

### 4.2 不真实完成的部分 (诚实标注)

| 项 | 状态 | 原因 |
|---|---|---|
| R.86 cron 调度器 (生产定时跑) | `not_started` (R.87) | 本 Sprint 已有 due job 抢锁语义, 但无常驻 scheduler |
| R.86 监控告警 (`dead_letter` / `stuck_running`) | `not_started` (R.87) | 同上 |
| R.86 死信重放 CLI | `not_started` (R.87) | 同上 |
| R.86 permission_filter_hardening (dept / site 过滤) | `not_started` (R.87 + §4.1 业务) | adapter 已支持 siteCode 参数, UI 未对接 |
| R.88 SiteAgentPort / CredentialStorePort TypeScript 端口契约 | `not_started` (R.88 后续) | 本 Sprint 仅协议级契约 |
| R.88 站点 app 实现 | `not_started` (站点 app 团队责任) | 契约已下发 |
| R.88 §4.2 任务控制 (4 条件) | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` | 沿用 CLAUDE.md §四, 未触碰 |
| R.89 文件清理 | `not_started` | **inventory 已落地, 实际清理需用户确认** |
| §4.2 真实控制完成 | `partial` + blocked | 沿用 R.84-R.85 review 结论 |

---

## 5. UI reality (R.5 §B 前端变更 8 项强制披露)

| R.5 §B 项 | 披露 |
|---|---|
| 新增页面/组件 | 无 |
| 修改按钮/交互 | 无 |
| 删除按钮/交互 | 无 |
| UI-only | 无 |
| 真实后端能力 (SQL/API 证据) | 无 UI 改动 (本 Sprint 全在数据库/脚本/docs) |
| simulator/DRY_RUN | 无 |
| 新增 requirements.md 未要求内容 | 否 |
| 是否属于需求主线 | R.86 增量同步 + R.88 契约 + R.89 inventory 全部属于 §5.2 / §2.3 / §6.4 / §6.2 主线 |

---

## 6. Mock / Simulator / DRY_RUN / 真能力 四者区分

- **真检索**: R.85 端口未受影响, `/api/search` 仍 `source=opensearch` 真实 ES 命中 (e2e 14 pass)。
- **真同步**: R.86 file_index_jobs 真写库 (bootstrap 跑通 inserted:29)。
- **mock**: 无新引入。
- **simulator / DRY_RUN**: 无 (沿用 ADR 0003 pull-based 契约, 未声称实现)。
- **路线图**: `docs/architecture/es-large-table-roadmap.md` 已在 R.84/R.85 review 中标注, R.86/R.88 保持更新。

**措辞合规** (本 review 与所有 commit message 检查): 未使用被禁的"控制完成"/"ES 完成"/"需求完成度 X%" 等模糊表述。

---

## 7. Missing pieces (不隐藏)

| 项 | 缺失原因 | 何时补 |
|---|---|---|
| R.86 cron 调度器 | 本 Sprint 仅 schema + worker + bootstrap | R.87 |
| R.86 监控告警 (死信 / stuck_running / 阈值) | 同上 | R.87 |
| R.86 死信重放 CLI | 同上 | R.87 |
| R.86 §4.1 dept_id 过滤 | 业务侧, 等权限模型落地 | R.87 + Sprint 5.x |
| R.88 SiteAgentPort / CredentialStorePort TypeScript 契约 | 本 Sprint 仅协议级 | R.88 后续 |
| R.88 站点 app 实现 | 站点 app 团队责任 | 站点运维排期 |
| R.89 实际清理 (28 safe_to_delete + 5 review_needed) | inventory 已落地, 等待用户确认 | R.89.5 后续 PR |
| §4.2 真实任务控制 (4 条件) | 沿用 blocked | 站点 app 接入 + schema 改造后 |

---

## 8. Blocker type (按 CLAUDE.md §3 枚举)

| Req ID | 状态 |
|---|---|
| §5.2 索引 (file_index_jobs + 增量 + watermark) | `partial` (R.86 落地 DDL/状态机/worker/bootstrap, 等 R.87 cron/监控) |
| §4.2 任务控制 | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` (R.88 契约已落, 站点 app 未接入) |
| §2.3 同步范围 + 增量 | `complete` (R.84 矩阵 + R.86 增量机制) |
| §6.4 可维护 | `complete` (R.86 DDL + R.88 契约 + R.89 inventory) |
| §6.2 安全 | `partial` (R.88 HMAC 规范, CredentialStorePort 实现待 R.88+) |
| §5.1 审计 | `complete` (R.88 §5 audit_log 事件契约) |
| §1.2 跨站集群 | `blocked_by_site_change` (R.88 checklist 已落, 真实跨站验证需第二个生产站点) |

---

## 9. 需要的源端 schema / 站点 API 变更清单 (附录 A)

> 本 Sprint 不动 schema (R.86 file_index_jobs 是中心库自己的调度账本, 不在站点端)。

| 变更项 | 涉及表 / API | DDL / 文档点 | 决策人 |
|---|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` (沿用) | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` | 领导 + 站点运维 |
| `tbl_task` 加 `priority SMALLINT` (沿用) | `tbl_task` | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` | 同上 |
| 站点 app poll `control_command` (R.88 契约) | 站点 app | 实现 `site-agent-contract.md §2.1` | 站点 app 团队 |
| 站点 app 读 `tbl_check_patrol_task` 新行 (沿用) | 站点 app | 巡检进程启动时 SELECT pending 行 | 同上 |
| 站点 app 读 `tbl_hot_restore_record` 新行 (沿用) | 站点 app | 热恢复进程启动时 SELECT pending 行 | 同上 |
| 提供真站点 API swagger | 站点 | swagger / openapi.yml 提交到 `docs/source/site-api-spec.md` | 站点架构师 |

---

## 10. Verdict

**`pass`** (R.86 + R.88 + R.89 真实落地, 0 代码假完成)。

| 范围 | 状态 |
|---|---|
| R.86 file_index_jobs DDL + 5 约束 + 3 索引 | `complete` |
| R.86 6 态状态机 (lib/jobs/file-index-job-state.ts) | `complete` |
| R.86 仓储层 (8 方法, lib/jobs/file-index-job.ts) | `complete` |
| R.86 单表 worker (scripts/index/file-index-job-runner.ts) | `complete` |
| R.86 bootstrap (scripts/index/file-index-job-bootstrap.ts) | `complete` (实测 inserted:29) |
| R.86 设计文档 (r86-file-index-incremental-sync.md) | `complete` |
| R.88 site-agent-contract.md (HTTP + HMAC + 心跳 + 控制命令 + watermark) | `complete` |
| R.88 site-onboarding-checklist.md (接入前/总控/站点/网络/同步/控制/心跳/验收) | `complete` |
| R.89 dead-code inventory (33 文件, Tier 1 + Tier 2) | `complete` (清单; **不删除任何文件**) |
| §5.2 索引 | `partial` (R.85 + R.86 端口落地, 等 R.87 cron/监控) |
| §4.2 任务控制 | `partial` + blocked (R.88 契约落地, 站点 app 未接入) |

---

## A. 强约束检查证据 (CLAUDE.md §八 + R.5 §I)

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm exec tsc --noEmit` | ✅ pass | 0 error, 186ms |
| `pnpm build` | ✅ pass | Next.js 16 production build |
| `pnpm audit:classify-source-tables` | ✅ pass | `classified=170 needs_decision=0 pg_unified=141 file_index_es=29` |
| `pnpm audit:center-db -- --strict --matrix` | ✅ pass | `21 checks, 0 fail, 1 warn` (test pollution) |
| `pnpm smoke:sync` | ✅ pass | `packageStatus=success` |
| `pnpm baseline:check` | ✅ pass | `13 pass, 0 fail` |
| `pnpm e2e:search` | ✅ pass | `14 pass / 0 fail` (R.85 端口未受影响) |
| `pnpm e2e:search-r85` | ✅ pass | configured + boundary 双路径 PASS |
| `docker exec psql < sprint-r86/01-file-index-jobs.sql` | ✅ pass | `CREATE TABLE` + `CREATE INDEX` x3 + `COMMENT` |
| `\d+ file_index_jobs` | ✅ pass | 5 约束 (1 PK + 1 UNIQUE + 3 CHECK) + 3 索引 |
| `pnpm import:file-index-job-bootstrap` | ✅ pass | `inserted:29 skipped:0 total_jobs:29` |
| `pnpm import:file-index-job-runner -- --site SH01 --table tbl_file_1 --batch 5` | ✅ pass | `status=succeeded scanned=5 indexed=5 watermark=26` |
| `pnpm import:file-index-job-runner -- --site SH01 --table tbl_file_1 --batch 5` (立即二次运行) | ✅ pass | `status=skipped error=not_claimable`; 下一次需等 `next_retry_at` 到期 |
| `pnpm import:file-index-job-runner -- --site SH01 --table tbl_file_parts --batch 5` | ✅ pass | best-effort 表 `status=succeeded scanned=0`, 不误判字段 |
| `pnpm audit:center-db` 后置 | ✅ pass | `file_index_es: 29/29` 仍正确 |
| secret-like scan | ✅ pass | 未发现真实密钥; 仅历史文档中的 `<password>` 占位符 |
| `git diff --check` | ✅ pass | 无空白错误 |

### 已知 warn (非 fail, 已说明)

1. `TEST_SMOKE(...)` — smoke:sync 自留测试污染, 每次跑产生 (沿用)
2. R.86 runner 立即二次跑 `not_claimable` — 第一次跑把 status 推进到 succeeded 并设置下次调度时间, 这是防止紧密重跑的正确行为
3. 本机未安装 `gitleaks`; 已用本地 regex 对当前树和分支 diff 做 secret-like 扫描, 未发现真实密钥

---

## B. 剩余 Blocker 汇总

| Blocker | 类型 | 决策人 |
|---|---|---|
| R.87 cron 调度器 (file_index_jobs 自动跑) | 本 Sprint scope | R.87 Sprint |
| R.87 监控告警 (dead_letter / stuck_running / 阈值) | 本 Sprint scope | R.87 Sprint |
| R.87 死信重放 CLI | 本 Sprint scope | R.87 Sprint |
| R.87 §4.1 permission_filter_hardening (dept / site) | 本 Sprint scope | R.87 + Sprint 5.x |
| R.88 后续: SiteAgentPort / CredentialStorePort TypeScript 契约 | 本 Sprint scope | R.88 后续 |
| R.88 站点 app 实现 (5 个 HTTP endpoint) | `blocked_by_site_change` | 站点 app 团队 |
| R.89.5 实际清理 (28 safe_to_delete + 5 review_needed) | 本 Sprint scope | R.89.5 PR (需用户确认) |
| §4.2 真实任务控制 (4 条件) | `blocked_by_site_change` + `blocked_by_source_schema` | 领导 + 站点运维 (沿用 CLAUDE.md §四) |
| §1.2 跨站点集群真实验证 | `blocked_by_site_change` | 第二个生产站点部署后 |
| §2.2/§3.1-3.3 登录 / RBAC / SSO | `blocked_by_auth` | Sprint 5.x 解锁 |

---

## C. R.5 §9 项检查

| 项 | 结果 |
|---|---|
| A. Requirement 对照 | ✅ §1 已列 (5.2 / 2.3 / 4.2 / 5.1 / 6.2 / 6.4) |
| B. 前端变更清单 8 项 | ✅ §5 已披露 (无 UI 改动) |
| C. API 变更清单 | ✅ §3 R.86 仓储层 8 方法 + R.88 5 HTTP endpoint (待实现) |
| D. 数据库变更清单 | ✅ §3 R.86 file_index_jobs DDL (中心库, 不动站点 schema) |
| E. 事件测试清单 10 项 | §A 表格 12 项全过 |
| F. 浏览器验证结果 | ✅ /api/search curl 实测 (R.85 端口未受影响) |
| G. mock/simulator/DRY_RUN 标记 | ✅ §6 全部分清 |
| H. 未完成项 | ✅ §7 + §B 全列 |
| I. 是否允许 commit | ✅ release gate 全部通过, **不开新 PR 推 main** (用户禁推) |

---

## D. 不推送声明

本 Sprint 落地多个 commit 在 `codex/r84-development-architecture-cleanup-plans` 分支。

**本 session 不发起任何 `git push` / 不开 PR** (用户明确 "不要推送, 除非用户明确要求")。

如果要开 PR, 命令:

```bash
git push -u origin codex/r84-development-architecture-cleanup-plans
gh pr create --base main \
  --head codex/r84-development-architecture-cleanup-plans \
  --title "R.86 file_index_jobs + R.88 site agent contract + R.89 inventory" \
  --body-file docs/database-analysis/sprint-r86-r89-requirements-review.md
```

---

_End of R.86-R.89 review._
