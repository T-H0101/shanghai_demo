# Sprint R.84-R.85 Requirements Review

> **触发**: `docs/superpowers/plans/2026-06-29-r84-r88-development-architecture-cleanup-plan.md` 中的 R.84 (源表分类) + 架构 ADR + cleanup policy + lib 分层 README + R.85 (本地 ES 闭环) 5 条主线，全部产出完毕。
>
> **分支**: `codex/r84-development-architecture-cleanup-plans` (6 commits)
> **不推送**: 用户明确要求 "不要推送"。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `R.84` + `R.85` + ADR + cleanup + layers (合并评审) |
| Sprint 标题 | 源表分类 + 架构决策记录 + cleanup policy + domain/ports/adapters 分层 + 本地 ES 闭环 |
| 日期 | 2026-06-29 |
| 对应 requirement 节 | `requirements.md §5.2` (file_index) / `§2.3` (sync scope) / `§6.2` (security) / `§6.4` (maintainability) / `§4.2` (task control - 仍 blocked) |
| 关联 PR | 待开 (用户禁止推送) |
| 关联 commit | `b89a514` `a283ee9` `9f9ab5a` `18c5c63` `9dd4e29` `339ca1f` |
| 总控负责人 | tian |
| 验证人 | tian |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-5.2 | 文件索引走专业搜索引擎 | `partial` (R.85 port+adapter+indexer 落地, 但 R.86 水位/R.87 生产硬化未做, 因此仍 partial) |
| REQ-2.3 | 同步范围四类数据 | `complete` (R.84 决策矩阵固化, 141 张归 pg_unified) |
| REQ-6.2 | 安全 (无明文, 无 mock 当真实) | `complete` (cleanup policy + ADR 0002 隔离外部系统, runtime 验证 path) |
| REQ-6.4 | 可维护 (文档完整, 接口清晰, baseline) | `complete` (ADR + layers README + R.84 矩阵 + R.85 contract) |
| REQ-4.2 | 任务控制 (新建/暂停/恢复/重置/巡检/恢复) | `partial` (ADR 0003 重申 pull-based, 无站点 app poll 证据, blocked_by_source_schema + blocked_by_site_change 仍存, **本 Sprint 不触碰**) |

---

## 2. Requirement 原始文本 (逐字摘录)

```
5.2 索引
- 文件索引信息走专业搜索引擎, 不允许把整张文件表塞进关系库。
- 索引数据需要定期更新, 支持增量更新。
```

```
2.3 数据同步 - 同步范围
1. 设备信息: 光盘库硬件节点、盘笼、盘位、光盘的状态/属性;
2. 文件索引信息: 所有光盘的文件列表、元数据;
3. 权限信息: 站点内账号/权限变更;
4. 任务信息: 任务状态/进度/结果。
```

```
6.4 可维护
- 文档完整 (架构、部署、运维、API 均有专门文档)。
- 接口契约清晰, 调用方与被调方有规约可查。
- 关键路径有 baseline / smoke 检查, 失败时快速定位。
- 模块边界明确, 修改不波及其他模块。
```

---

## 3. Implementation (本 Sprint 实际改了哪些)

> 6 个 commit, 跨 development + architecture + cleanup 三条线:

| Commit | 主线 | 文件 |
|---|---|---|
| `339ca1f` | R.84 dev | `r84-source-table-classification.md` + `classify-source-tables.ts` + `es-large-table-roadmap.md` R.84 段 + architecture README + `audit:classify-source-tables` script |
| `9dd4e29` | Architecture ADR | `docs/architecture/adr/0001-pg-for-metadata-es-for-file-index.md` + `0002-ports-and-adapters-boundary.md` + `0003-site-agent-pull-control.md` + ADR README + architecture README |
| `18c5c63` | Cleanup policy | `docs/operations/repository-cleanup-policy.md` + `.gitignore` 注释 |
| `9f9ab5a` | Layers README | `lib/domain/README.md` + `lib/ports/README.md` + `lib/adapters/README.md` |
| `a283ee9` | R.85 dev | `lib/domain/search/file-index-document.ts` + `lib/ports/search-port.ts` + `lib/adapters/opensearch/file-search-adapter.ts` + `scripts/index/file-indexer.ts` + `docker-compose.search.yml` + `app/api/search/route.ts` (重写) + `scripts/e2e/test-search-r85.ts` + `docs/operations/deployment.md` §8 + `e2e:search-r85` script |
| `b89a514` | Fix | `scripts/check-project-baseline.ts` §7 接受 R.85 `opensearch` 枚举 |

**总文件**: 16 新增 + 5 修改。

---

## 4. Backend reality (是数据库 / API / 队列真支持, 还是仅 UI 层面调用)

### 4.1 真实后端能力 (有 SQL/API/运行时证据)

| 能力 | 证据 |
|---|---|
| R.84 源表分类 = 170/170 归类 | `pnpm audit:classify-source-tables` → `classified=170 needs_decision=0 pg_unified=141 file_index_es=29` (PASS, exit 0) |
| `SearchPort` 接口存在且被 route 调用 | `pnpm e2e:search-r85` → boundary contract 4 项 assert 全过 |
| OpenSearch/ES 真实写入 | `pnpm tsx scripts/index/file-indexer.ts --site SH01 --limit 5` → `scanned:4 indexed:4 failed:0` |
| ES 文档真实可查询 | `curl http://localhost:9200/_cat/indices` → `disc_file_index` 4 docs |
| `/api/search` 经 SearchPort 返回 opensearch 数据 | `curl '/api/search?q=file-2025-01-01'` → `source:opensearch total:4 items[4]` (真实从 ES 命中) |
| ES 不可用 blocked 路径 | `e2e:search-r85` blocked path → `source:blocked_by_external_system blocker:es_not_configured` (PASS) |
| 中心库审计 | `pnpm audit:center-db --strict --matrix` → 20 pass / 0 fail / 2 warn (TEST_SMOKE 自留 + 27 张之前未分类) |

### 4.2 不真实完成的部分 (诚实标注)

| 项 | 状态 | 原因 |
|---|---|---|
| `tbl_file*` / `tbl_folder*` 增量同步 + 水位 | `not_started` (R.86 范畴) | 本 Sprint 未实现 watermark / tombstone |
| ES 生产硬化 (监控 / 告警 / 权限过滤 / 索引重建 runbook) | `not_started` (R.87 范畴) | 本 Sprint 仅完成最小闭环 |
| Site Agent credential store port | `not_started` (R.88 范畴) | 本 Sprint 不触碰 |
| 真实任务控制 §4.2 (暂停 / 恢复 / 重置 / 巡检 / 恢复任务) | `partial` (沿用 CLAUDE.md §四) | 站点 app poll 缺失, `tbl_task.paused` / `tbl_task.priority` schema 缺失 |

---

## 5. UI reality (R.5 §B 前端变更 8 项强制披露)

> 本 Sprint **无新增前端页面 / 组件 / 按钮**, 仅改 `/api/search` 后端契约。

| R.5 §B 项 | 披露 |
|---|---|
| 新增页面/组件 | 无 |
| 修改按钮/交互 | 无 (R.85 改的是 `/api/search` JSON envelope, 不改 UI) |
| 删除按钮/交互 | 无 |
| UI-only | 无 |
| 真实后端能力 (SQL/API 证据) | `/api/search` 真实经 SearchPort 查 ES (上面 4.1 表格有 4 条证据) |
| simulator/DRY_RUN | 无 (`opensearch` 是真实 ES hit, 不是 mock) |
| 新增 requirements.md 未要求内容 | 否 |
| 是否属于需求主线 | 全部属于 §5.2 / §2.3 / §6.4 主线 |

---

## 6. Mock / Simulator / DRY_RUN / 真控制 四者区分

- **真控制**: `/api/search` 是真控制 (真实 ES 命中 4 条文档)。
- **真同步**: file-indexer 真从 PG `tbl_file` 抽 4 行 → 映射 → 真写 ES 4 文档 → 真查询命中。
- **mock**: 无新引入。
- **simulator / DRY_RUN**: 无 (§4.2 任务控制未触碰, 沿用 ADR 0003 的 pull-based 契约, 未声称实现)。
- **路线图**: `docs/architecture/es-large-table-roadmap.md` R.84/R.85 段已清晰标注 `blocked_by_external_system`(R.85 之前) → `partial`(R.85 之后) → 未 `complete`(等 R.86/R.87)。

**措辞合规** (本 review 与所有 commit message 检查): 无"业务完成度 X%" / "ES 接入完成" / "任务控制已完成"。

---

## 7. Missing pieces (不隐藏)

| 项 | 缺失原因 | 何时补 |
|---|---|---|
| R.86 增量同步 (watermark / tombstone) | 本 Sprint 仅 R.85 最小闭环 | R.86 Sprint |
| R.86 `file_index_jobs` 表 DDL | 同上 | R.86 |
| R.87 生产硬化 (监控 / 告警 / runbook) | 同上 | R.87 |
| R.88 site agent port + credential store port + site-agent-contract.md + site-onboarding-checklist.md | 本 Sprint 不触碰 | R.88 |
| R.89 dead-code inventory + focused cleanup PRs | 本 Sprint 仅定义 policy, 未扫描 | R.89 |
| 27 张 `tbl_file*` / `tbl_folder*` 中尚未被 R.85 索引器抽样的 25 张 (`tbl_file_2`, `tbl_folder_*` 等) | R.85 indexer 当前只抽 `tbl_file` 主表 sample, R.86 才扩展 | R.86 |
| `/api/search` 真正生产权限过滤 (siteCode / department 注入 query) | adapter 已支持 `siteCode` 参数, UI 未对接 | R.87 由 UI/权限模块对接 |

---

## 8. Blocker type (按 CLAUDE.md §3 枚举)

| Req ID | 状态 |
|---|---|
| §5.2 索引 (`tbl_file*` 全量 + 增量 + 监控) | `partial` (R.85 端口落地, 但 R.86 水位 + R.87 监控未做) |
| §4.2 任务控制 (暂停 / 恢复 / 重置 / 巡检 / 恢复任务) | `partial` + `blocked_by_site_change` + `blocked_by_source_schema` (沿用 CLAUDE.md §四) |
| §6.4 可维护 | `complete` (ADR + layers README + R.84 矩阵 + cleanup policy 全部落地) |
| §6.2 安全 | `complete` (R.85 adapter 不在 route 写 SQL/HTTP, ADR 0002 + cleanup policy 落地) |
| §2.3 同步范围 | `complete` (141 张 pg_unified, 29 张 file_index_es, 不进 PG 全量) |
| §1.2 高可用 (跨站集群验证) | `blocked_by_site_change` (仅 BJ02 / SH01 注册, 跨站恢复链路未跑过) |

---

## 9. 需要的源端 schema / 站点 API 变更清单 (附录 A)

| 变更项 | 涉及表 / API | DDL / 文档点 | 决策人 |
|---|---|---|---|
| (无新增) | — | 本 Sprint 不动 schema; R.86 才新增 `file_index_jobs` (待定) | — |
| 历史 blocker 沿用 | — | `tbl_task.paused` / `tbl_task.priority` / 站点 app poll / `tbl_check_patrol_task` & `tbl_hot_restore_record` 站点端轮询 / 真站点 API swagger | 领导 + 站点运维 |

---

## 10. Verdict

**`pass`** (本 Sprint 5 条主线全部真实落地, 0 代码假完成)。

| 范围 | 状态 |
|---|---|
| R.84 源表分类 | `complete` (170/170) |
| R.85 ES 端口闭环 | `complete` (端口 + adapter + indexer + blocked + e2e 双路径) |
| 架构 ADR 0001-0003 | `complete` |
| Cleanup policy | `complete` |
| Domain / ports / adapters 分层 README | `complete` |
| §5.2 索引 | `partial` (等 R.86/R.87) |
| §4.2 任务控制 | `partial` + blocked (等站点 app + schema) |

---

## A. 强约束检查证据 (CLAUDE.md §8 + 架构质量路线图 release gate)

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm exec tsc --noEmit` | ✅ pass | 0 error, 187ms |
| `pnpm build` | ✅ pass | Next.js 16 production build |
| `pnpm smoke:sync` | ✅ pass | `packageStatus=success duplicateDetected=true` |
| `pnpm baseline:check` | ✅ pass | 13 pass / 0 fail |
| `pnpm audit:center-db -- --strict --matrix` | ✅ pass | 20 pass / 0 fail / 2 warn (TEST_SMOKE 自留 + 27 张未分类新归 file_index_es) |
| `pnpm audit:classify-source-tables` | ✅ pass | `classified=170 needs_decision=0 pg_unified=141 file_index_es=29` |
| `pnpm e2e:search-r85` (blocked path) | ✅ pass | `source=blocked_by_external_system blocker=es_not_configured` |
| `pnpm e2e:search-r85` (configured path) | ✅ pass | `marker=R85-E2E-8ad5c73e` 索引并命中 |
| `pnpm tsx scripts/index/file-indexer.ts --site SH01 --limit 5` | ✅ pass | `scanned:4 indexed:4 failed:0 skipped:0` |
| `curl /api/search?q=file-2025-01-01` | ✅ 真实 | `source=opensearch total=4 items[4]` |
| `curl http://localhost:9200/_cat/indices` | ✅ 真实 | `disc_file_index` 4 docs |

### 已知 warn (非 fail, 已说明)

1. `TEST_SMOKE(t=1,d=1,v=0,p=3)` — smoke:sync 自留测试污染, 每次跑产生
2. `unclassified tbl_* tables: 27 tables` — 这是 `audit:center-db` 旧审计脚本的 warn, R.84 新脚本 `audit:classify-source-tables` 把这 29 张明确归类为 `file_index_es`, 旧 warn 实际已过时但本 Sprint 不动旧审计脚本

---

## B. 剩余 Blocker 汇总

| Blocker | 类型 | 决策人 |
|---|---|---|
| R.86 增量同步 / tombstone / `file_index_jobs` 表 | 本 Sprint scope | R.86 Sprint |
| R.87 生产硬化 (监控 / 告警 / 重建 runbook) | 本 Sprint scope | R.87 Sprint |
| R.88 site agent port + credential store + onboarding kit | 本 Sprint scope | R.88 Sprint |
| R.89 dead-code inventory | 本 Sprint scope | R.89 Sprint |
| §4.2 真实任务控制 (暂停 / 恢复 / 重置 / 巡检 / 恢复任务) | `blocked_by_site_change` + `blocked_by_source_schema` | 领导 + 站点运维 (沿用 CLAUDE.md §四) |
| §1.2 跨站点集群真实验证 | `blocked_by_site_change` | 第二个生产站点部署后 |
| §2.2/§3.1-3.3 登录 / RBAC / SSO | `blocked_by_auth` (CLAUDE.md 当前禁) | Sprint 5.x 解锁 |

---

## C. R.5 §9 项检查

| 项 | 结果 |
|---|---|
| A. Requirement 对照 | ✅ §1 已列 (5.2 / 2.3 / 6.2 / 6.4 / 4.2) |
| B. 前端变更清单 8 项 | ✅ §5 已披露 "无新增" + "真后端 4 条证据" |
| C. API 变更清单 | ✅ §3 + 4.1 (`/api/search` 经 SearchPort 重写) |
| D. 数据库变更清单 | ✅ 无 schema 变更 |
| E. 事件测试清单 10 项 | §A 表格 11 项全过 |
| F. 浏览器验证结果 | ✅ `/api/search` curl 实测 |
| G. mock/simulator/DRY_RUN 标记 | ✅ §6 全部分清 |
| H. 未完成项 | ✅ §7 + §B 全列 |
| I. 是否允许 commit | ✅ 6 commits 已落地, **不开新 PR 推 main** (用户禁止推送) |

---

## D. 不推送声明

本 Sprint 已落地 6 commits 在 `codex/r84-development-architecture-cleanup-plans` 分支。

**本 session 不发起任何 `git push` / 不开 PR** (用户明确 "不要推送")。

如果要开 PR, 命令:

```bash
git push -u origin codex/r84-development-architecture-cleanup-plans
gh pr create --base main \
  --head codex/r84-development-architecture-cleanup-plans \
  --title "R.84-R.85 architecture cleanup + ES local loop" \
  --body-file docs/database-analysis/sprint-r84-r85-requirements-review.md
```

---

_End of R.84-R.85 review._
