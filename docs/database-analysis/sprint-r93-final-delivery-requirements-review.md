# Sprint R.93 最终交付闭环 — Requirements Review

> **R.93 目标**: 修复 racks/volumes/search gate 阻塞, 补齐 dispatcher 业务主键映射, 前端产品化文案清理, ES 端口统一, 部署文档主路径统一, 产出开发版可交付候选。

**状态**: pass
**verdict**: 开发版可交付候选
**日期**: 2026-06-30
**branch**: `codex/r84-development-architecture-cleanup-plans`
**commits**: `a9c13a2..e4a175a, bc426fe, 3ad6d0c` (3 commits)

---

## 1. Requirement IDs (本 Sprint 涉及)

- **§2.3 业务同步**: R.83.9 dispatcher 141 张业务表 column 映射补齐
- **§4.1 检索**: R.85/R.56 ES/OpenSearch 端口统一与 e2e 适配
- **§4.2 任务管理**: R.88 站点代理契约 (文案清理, 不声称真实控制)
- **§6.4 可维护性**: 部署文档 env:init 主路径, 前端产品化文案

---

## 2. Requirement 原始文本 (略, 见 requirements.md)

本 Sprint 不修改需求本身, 只修 dispatcher 映射、API 兼容、前端文案、ES 配置和部署文档。

---

## 3. Implementation

### 3.1 R.93 (2 commits)

| Commit | 内容 |
|---|---|
| `e4a175a` | feat(r93): dispatcher identity columns, API compat, product copy, ES port, env:init |
| `bc426fe` | docs(r93): final requirements review |

### 3.1.1 R.93.1 合并前收尾 (1 commit)

| Commit | 内容 |
|---|---|
| `<R.93.1>` | fix(r93.1): close merge readiness gaps — sync config note, deployment doc, README pointer, e2e:sync note audit (commit: 3ad6d0c) |

R.93.1 真实修改文件:

| 文件 | 改动 | 类别 |
|---|---|---|
| `app/api/sync/config/route.ts` | `reality.note` 从开发者说明 → `同步策略由总控统一管理。`; `scheduler.note` 移除 `sync_sites.sync_interval_seconds` | Bug 修复 |
| `scripts/e2e/test-sync.ts` | 新增 R.93.1 检查: `/api/sync/config` note 不含 `不代表源端 / sync_sites 是中心配置 / tbl_site / source_restore / pg_dump / dispatcher / sync_sites.sync_interval_seconds` | 测试覆盖 |
| `docs/operations/deployment.md` | SCRAM 修复顺序改为 `env:init --force` 先; 新站点接入替换 `test:r83.4-e2e` 为 `scheduler:sync:once + check:sync-consistency + e2e:sites`; 强调 "中心不保存站点 DB 密码" 原则 | 文档修复 |
| `README.md` | "后续开发入口" 改为 R.93 当前结论, 不再写 R.92 已完成作为最终收尾; 移除 R.86 link | 文档修复 |

### 3.2 真实修改文件

| 文件 | 改动 | 类别 |
|---|---|---|
| `lib/sync/package-dispatcher.ts` | dispatchMagzines 加 mag_id→magazine_id, dispatchSlots 加 slot_id→slot_id + backfill JOIN 修正, dispatchLogicalVolume 加 volume_id→volume_id | Bug 修复 |
| `databases/sprint-r93/01-legacy-identity-columns.sql` | 7 ALTER ADD source_record_id + 5 DROP NOT NULL source_id + 7 unique indexes + sync_scheduler_log | Schema 可复现 |
| `databases/sprint-2b0/init-docker.sh` | 注册 R.93 migration | Schema 可复现 |
| `app/api/racks/[id]/route.ts` | MagazineRow/SlotRow 加 source_record_id, magsById 用 source_record_id fallback, slotRes 用 COALESCE | API 修复 |
| `app/api/racks/[id]/slots/route.ts` | SlotRow 加 source_record_id, slot JOIN 用 source_record_id, ORDER BY 用 COALESCE | API 修复 |
| `app/api/volumes/[id]/route.ts` | volRes 加 source_record_id lookup, site 用 sync_sites fallback, DTO id 用 fallback chain | API 修复 |
| `.env.example` | SEARCH_ES_URL 9200→9201 | 配置统一 |
| `docs/operations/deployment.md` | 主路径 env:init (移除 cp -n), ES indexer 9201 | 文档修复 |
| `scripts/e2e/test-search-es.ts` | 加 dotenv, source 接受 opensearch, 无 ES 时必须 blocked_by_external_system | 测试适配 |
| `scripts/e2e/test-search-r85.ts` | 加 dotenv, run 注释 9201 | 测试适配 |
| `scripts/e2e/test-racks.ts` | 当前数据口径→当前概况 | 测试适配 |
| `components/platform/page-header.tsx` | 移除 状态来源/对应需求 developer labels | 产品化 |
| `app/racks/page.tsx` | 数据口径→概况, 数据源→共享路径, 移除 来源行 | 产品化 |
| `app/sites/page.tsx` | 移除 (来源: sync_sites), 表差异→同步差异, hide table_name | 产品化 |
| `app/sync/page.tsx` | 手动同步触发→站点同步, 凭据键引用→连接配置, 告警源→同步告警, 来源→类别, disabled→停用, 移除 pnpm check 命令 | 产品化 |

---

## 4. Backend reality (SQL/API 证据)

### 4.1 Dispatcher 修复验证

```sql
-- unified_volumes: 6 行全部有 volume_id (之前 0)
SELECT count(*) AS total, count(volume_id) AS with_volume_id FROM unified_volumes;
-- 结果: 6 | 6

-- unified_magazines: 12 行全部有 magazine_id 和 device_id (之前 0)
SELECT count(*) AS total, count(magazine_id) AS with_magazine_id, count(device_id) AS with_device_id FROM unified_magazines;
-- 结果: 12 | 12 | 12

-- unified_slots: 792 行全部有 slot_id 和 device_id (之前 device_id 0)
SELECT count(*) AS total, count(slot_id) AS with_slot_id, count(device_id) AS with_device_id FROM unified_slots;
-- 结果: 792 | 792 | 792
```

### 4.2 Gate 结果

| 检查 | 结果 |
|---|---|
| `pnpm exec tsc --noEmit` | ✅ 0 错误 |
| `pnpm build` | ✅ 通过 |
| `pnpm env:check` | ✅ 10/0 |
| `pnpm db:init` | ✅ (含 R.93 migration) |
| `pnpm smoke:sync` | ✅ |
| `pnpm export-and-push SH01` | ✅ |
| `pnpm export-and-push BJ02` | ✅ |
| `pnpm baseline:check` | ✅ 13/0 |
| `pnpm audit:center-db -- --strict --matrix` | ✅ 16/0/1 |
| `pnpm audit:page-scope` | ✅ |
| `pnpm audit:product-copy` | ✅ 0 失败 |
| `pnpm audit:api-mode-no-fallback` | ✅ |
| `pnpm audit:page-no-todo` | ✅ |
| `pnpm audit:data-coverage` | ✅ 30/0 |
| `pnpm e2e:racks` | ✅ **30/0** (R.92.1: 28/2 → R.93: 30/0) |
| `pnpm e2e:volumes` | ✅ **16/0** (R.92.1: 11/1 → R.93: 16/0) |
| `pnpm e2e:sync` | ✅ 43/0 |
| `pnpm e2e:users` | ✅ 14/0 |
| `pnpm e2e:sites` | ✅ 27/0 |
| `pnpm e2e:logs` | ✅ 43/0 |
| `pnpm e2e:settings` | ✅ 25/0 |
| `pnpm e2e:route-page-integration` | ✅ 86/0 |
| `pnpm e2e:command-palette` | ✅ 19/0 |
| `pnpm e2e:security-boundaries` | ✅ 13/0 |
| `pnpm e2e:search-r85` | ✅ (blocked + configured 双路径) |
| `pnpm e2e:search-es` | ✅ (blocked + configured 双路径) |

---

## 5. UI reality (真实点击行为, 是否误导用户)

| 检查 | 结果 |
|---|---|
| 用户可见 "数据口径" | 0 处 (改为 "概况") |
| 用户可见 "凭据键引用" | 0 处 (改为 "连接配置") |
| 用户可见 "告警源" | 0 处 (改为 "同步告警") |
| 用户可见 "来源:" 列头 | 0 处 (改为 "类别") |
| 用户可见 pnpm 命令 | 0 处 (改为 "请选择站点后运行校验") |
| 用户可见 "状态来源/对应需求" | 0 处 (从 page-header 移除) |
| 用户可见 "disabled" | 0 处 (改为 "停用") |
| 用户可见 "数据源" 标签 | 0 处 (改为 "共享路径") |
| pages 无开发者文案 | ✅ audit:product-copy 0 失败 |
| pages 无 TODO 标记 | ✅ audit:page-no-todo 0 失败 |

---

## 6. Mock / Simulator / DRY_RUN / 真控制 区分

| 类别 | 状态 |
|---|---|
| Mock | 移除。生产 API mode 不允许静默 fallback |
| Simulator | 未引入 |
| DRY_RUN | `pnpm scheduler:sync:once -- --dry-run` 写 status=skipped |
| 真实控制 | 未声称完成。控制命令仅提交到 control_command 队列 |
| ES 搜索 | 本地开发闭环 ✅ (SEARCH_ES_URL 9201, e2e 双路径验证) |

---

## 7. 修复的 Bug 清单

| # | Bug | 影响 | 修复 |
|---|---|---|---|
| 1 | `dispatchMagzines` 缺 mag_id→magazine_id 映射 | unified_magazines.magazine_id 为 NULL, racks 详情无法关联 | 加 column 映射 |
| 2 | `dispatchSlots` 缺 slot_id→slot_id 映射 | unified_slots.slot_id 为 NULL | 加 column 映射 |
| 3 | `dispatchSlots` backfill JOIN 用 m.source_id | R.83+ 行 source_id 为 NULL, JOIN 失败 | 用 source_record_id + magazine_id 多条件 JOIN |
| 4 | `dispatchLogicalVolume` 缺 volume_id→volume_id 映射 | unified_volumes.volume_id 为 NULL, 卷详情 404 | 加 column 映射 |
| 5 | `.env.example` ES 端口 9200 vs docker-compose 9201 | 配置不一致, ES 连不上 | 改为 9201 |
| 6 | 部署文档仍以 `cp -n` 作为主路径 | 新用户可能不跑 env:init | 统一为 pnpm env:init |
| 7 | 前端 "当前数据口径" 等开发者措辞 | 用户看到内部实现词 | 改为产品化文案 |

---

## 8. Blocker type

| 项 | 状态 | 阻塞类型 |
|---|---|---|
| dispatcher 业务主键映射 | ✅ complete | — |
| racks/volumes 关联字段 | ✅ complete | — |
| ES 端口与 e2e 闭环 | ✅ complete | — |
| 部署文档主路径 | ✅ complete | — |
| 前端产品化文案 | ✅ complete | — |
| 真实任务控制 | partial (历史) | `blocked_by_site_change` |
| ES 生产 cron / 监控 | `out_of_scope` | R.87 范畴 |

---

## 9. 需要的源端 schema / 站点 API 变更清单 (R.93+)

沿用 R.92.1 清单, 无新增:

| 变更项 | 涉及表 / API | 决策人 |
|---|---|---|
| `tbl_task` 加 `paused BOOLEAN` | `tbl_task` | 领导 + 站点运维 |
| `tbl_task` 加 `priority SMALLINT` | `tbl_task` | 同上 |
| 站点 app poll `control_command` | 站点 app | 站点 app 团队 |
| 提供真站点 API 文档 | 站点 | 站点架构师 |

---

## 10. Verdict

**开发版可交付候选**

### 10.1 交付标准达成

- ✅ 所有 gate 全过 (10 e2e 0 fail, 7 audit 0 fail, tsc/build/env/baseline 全过)
- ✅ racks 详情可打开 (30/0, volume_id/magazine_id/device_id 全填充)
- ✅ volumes 详情可打开 (16/0, volume_id 全填充)
- ✅ ES 搜索本地开发闭环 (search-r85 + search-es 双路径 PASS)
- ✅ ES 配置和文档一致 (9201 统一)
- ✅ README/env:init 可执行 (部署文档主路径统一)
- ✅ UI 无开发者文案 (7 audit + product-copy 全过)
- ✅ API 无静默 fallback mock (api-mode-no-fallback 全过)
- ✅ 数据库 schema 可复现 (R.93 migration + init-docker.sh)
- ✅ SH01 / BJ02 双站点同步闭环 (export-and-push 验证)
- ✅ 所有核心页面有真实链路或明确空状态

### 10.2 不声称完成 (诚实标注)

- 真实任务控制 = `partial` + `blocked_by_site_change` (R.93+)
- 登录 / RBAC / SSO = `blocked_by_auth`
- 生产 HA / k8s = R.87+
- 生产 cron / 监控 / 死信重放 = `out_of_scope` (R.87)
- BJ02 数据同源 = dev fixture 复用, 生产应独立物理数据库

### 10.3 R.93 + R.93.1 commits

```
e4a175a feat(r93): dispatcher identity columns, API compat, product copy, ES port, env:init
bc426fe docs(r93): final requirements review
3ad6d0c fix(r93.1): close merge readiness gaps
```

PR #7 状态: `3d3f5bc..3ad6d0c` 已推送, 准备合并到 main。
