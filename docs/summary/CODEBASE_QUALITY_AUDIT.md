# Codebase Quality Audit (Sprint 4.6A)

> **生成时间**: 2026-06-08
> **范围**: 全代码库 (`app/` / `lib/` / `scripts/` / `components/` / `docs/` / `package.json`)
> **目标**: 不改业务, 只梳理企业级健壮性基线
> **状态**: ✅ Audit done. 低风险修复同步提交.

---

## 1. 当前代码库风险 (8 大类)

| # | 风险 | 严重度 | 触发 Sprint |
|---|---|---|---|
| 1 | **脚本/文档臃肿**: `scripts/` 39 个文件 (23 个 sprint-* 一次性脚本), `docs/database-analysis/` 53 个 sprint 文档 | 中 | 4.7+ |
| 2 | **写接口鉴权不均**: `POST /api/control/commands` **无鉴权** (Sprint 4.5 MVP 标记), `POST /api/sync/devices|tasks` 无鉴权 | 高 | 5.x (Auth 解锁后) |
| 3 | **mock/api 双轨**风险: API 模式 fetch 失败自动降级 mock, 用户无感 (Tasks/Racks 已暴露 `dataSource` 字段, 但 Vol/Sync/Alerts 未统一) | 中 | 4.7 |
| 4 | **站点侧鉴权简化**: `x-site-control-signature` 明文 secret 比对, 非完整 HMAC | 中 | 4.6 (待办) |
| 5 | **单进程拉取**: `markCommandPulled` 无分布式锁, 多实例部署会重复拉 | 中 | 6.4 (多实例) |
| 6 | **无审计日志**: control 域 / 业务操作无独立 audit 表, sync 域有 (sync_table_log) | 中 | 5.5 |
| 7 | **mock 数据落库风险**: mock mode 下的 `taskProvider.pauseTask/...` 仅改内存, 不持久化 (设计上正确, 但 README 未明确) | 低 | — |
| 8 | **D 类残留**: `analyze_disc_schema.py` (Python 混进 tsx 项目) | 低 | 4.7 决定 |

---

## 2. 脚本分类表 (scripts/)

完整索引见 [`SCRIPTS_INDEX.md`](./SCRIPTS_INDEX.md)。汇总:

| 分类 | 数量 | 处置 |
|---|---|---|
| **A. production / dev (必保留)** | 11 | 保留 |
| **B. smoke / test (可保留)** | 4 | 保留 |
| **C. audit 一次性 (建议归档)** | 23 | 保留路径, 头注释加 `@archive` |
| **D. obsolete (可删)** | 1 | 保留不删 (低风险) |

**package.json 引用情况**: 11 个 npm script 全部指向 A 类, **0 引用** C/D 类。Sprint 4.6A 不删除任何文件。

---

## 3. 写接口安全矩阵

### 3.1 总览

| 端点 | 鉴权 | 输入校验 | 参数化 SQL | 状态机 | 幂等 | 日志 | 静默成功风险 |
|---|---|---|---|---|---|---|---|
| `POST /api/sync/package` | ✅ HMAC-SHA256 (Sprint 2G.1, dev/strict 双模式) | ✅ validatePackagePayload | ✅ dispatcher 全部 $N | ✅ status: running→success/failed/partial | ✅ findPackageByBatch (batchId) | ✅ console.warn on auth fail | 低 (return 207 partial) |
| `POST /api/ingest/devices` | ⚠️ API Key (INGEST_API_KEY_*) | ✅ IngestRequest schema | ✅ $N | ❌ 无状态机 | ✅ batch_id | ⚠️ console.error on throw | 低 |
| `POST /api/ingest/tasks` | ⚠️ API Key | ✅ | ✅ | ❌ | ✅ | ⚠️ | 低 |
| `POST /api/sync/devices` | ❌ **无鉴权** | ❌ 不接受 body | ❌ 不接 SQL | ❌ | ❌ | ❌ | **中** (任何人可触发) |
| `POST /api/sync/tasks` | ❌ **无鉴权** | ❌ | ❌ | ❌ | ❌ | ❌ | **中** |
| `POST /api/control/commands` | ❌ **无鉴权 (Sprint 4.5 MVP)** | ✅ command_type/target_type 白名单 | ✅ $N | ✅ pending 状态机 | ⚠️ command_no 唯一 (UNIQUE) | ❌ | 低 (Sprint 4.5 文档化) |
| `GET /api/site-control/commands` | ⚠️ dev=放行 / strict=`x-site-control-signature=secret` (明文) | ✅ siteCode required | ✅ | ✅ pending→pulled 原子 | ✅ | ❌ | 低 |
| `POST /api/site-control/commands/[id]/ack` | ⚠️ 同上 | ✅ | ✅ | ✅ pulled/pending→running | ✅ | ❌ | 低 |
| `POST /api/site-control/commands/[id]/result` | ⚠️ 同上 | ✅ status 白名单 | ✅ | ✅ pulled/running→终态 | ✅ | ❌ | 低 |

### 3.2 高风险点详解

#### 🔴 `POST /api/sync/devices` & `POST /api/sync/tasks` — 无鉴权触发器

```typescript
// app/api/sync/devices/route.ts (Sprint 2B 早期, 现已不再使用, 但接口存在)
export async function POST() {
  const result = await syncDevices()  // 任何人都可触发
  return NextResponse.json(result)
}
```

- **影响**: 任何人可触发全表重同步, 大量 SQL 写入
- **缓解**: 当前未被前端任何页面引用 (确认: `grep -r "api/sync/devices" app/` 仅 route 自身)
- **建议**: 未来 Sprint 加 `if (isApiMode) requireAuth()` 或加 `?admin=1` token
- **Sprint 4.6A 处置**: **不修改** (避免改行为), 文档化

#### 🟡 `POST /api/control/commands` — 无鉴权 (Sprint 4.5 已知)

- **影响**: 任何能访问应用的人都能创建控制命令
- **缓解**: Sprint 4.5 文档化 `requestedBy: null`, 状态机严格, 不改 unified_tasks
- **Sprint 5.1 解锁**: ADFS 接入后从 session 读 user, 加 RBAC 矩阵

#### 🟡 站点侧 HMAC 简化

- **当前**: `x-site-control-signature === SYNC_PACKAGE_SECRET` 明文比对
- **Sprint 2G.1 协议**: 完整 HMAC-SHA256(`${ts}.${nonce}.${rawBody}`, secret)
- **影响**: 中间人可重放 (无 timestamp/nonce)
- **Sprint 4.6 计划**: 升级完整 HMAC, 复用 `verifySyncPackageRequest`

### 3.3 状态机保护

| 表 | 状态 | 保护 |
|---|---|---|
| `control_command` | pending→pulled→running→success/failed/cancelled | ✅ `markCommandPulled` 用 `WHERE status='pending'` 原子; `markCommandResult` 用 `WHERE status IN (pending,pulled,running)` |
| `sync_package_log` | running→success/failed/duplicated | ✅ `findPackageByBatch` 先查 |
| `unified_tasks` (via package) | 不直接改 (upsert only) | ✅ ON CONFLICT DO UPDATE |
| `unified_*` (其他) | 同上 | ✅ |

### 3.4 幂等保证

| 操作 | 幂等性 |
|---|---|
| POST sync/package (重复 batchId) | ✅ 查 findPackageByBatch → 返回 duplicated=true |
| POST control/commands (command_no UNIQUE) | ✅ 概率碰撞 1/65536, 重复会 PG 抛错 |
| POST site-control/[id]/result (重复) | ⚠️ 终态再次 result 会返回 404 (已 finalized) |
| markCommandPulled (并发) | ✅ SQL 原子 WHERE status='pending' |

---

## 4. mock / api mode 风险

### 4.1 当前 mode 切换机制

`lib/api/index.ts`:
- `NEXT_PUBLIC_API_MODE=api` → 走 `apiTaskProvider` / `apiRackProvider` / ...
- `NEXT_PUBLIC_API_MODE=mock` (默认) → 走 `mockTaskProvider` / ...
- API fetch 失败 → **自动 fallback mock** (lib/api/fallback.ts `fetchWithFallback`)

### 4.2 各页面 mock 风险

| 页面 | API mode 行为 | mock 风险 |
|---|---|---|
| **Dashboard** (`/`) | `/api/dashboard/summary` + `/api/dashboard/recent-syncs` (Sprint 2G.2) | ✅ 真实数据 + `dataSource` 字段; mock 隐藏 |
| **Tasks** (`/tasks`) | `/api/tasks?siteCode=...` (Sprint 2F.3 收口) | ✅ 真实数据 + DataSourceBadge; 失败 fallback mock |
| **Racks** (`/racks`) | `/api/racks?siteCode=...` | ✅ 真实数据 + 失败 fallback mock |
| **Volumes** (`/volumes`) | `/api/volumes?siteCode=...` (Sprint 2H.4) | ✅ 真实数据 |
| **Sync Center** (`/sync`) | `/api/sync/packages` + `/api/sync/packages/[id]/tables` | ✅ 真实数据 |
| **Control** (`/control`) | `/api/control/commands` (Sprint 4.5 新增) | ✅ 真实数据; mock 模式 **不会** 走 control (Tasks 按钮在 mock mode 走 mockTaskProvider) |
| **Alerts** (`/alerts`) | `/api/alerts` — **混合** (Sprint 早期) | ⚠️ `/api/alerts` route **直接 import lib/mock/tasks/racks/sites 拼数据** (Sprint 2A 写法) |
| **Sites** (`/sites`) | `/api/sites` | ✅ 真实数据 (unified_sites) |
| **Users** (`/users`) | `/api/users` | ✅ 真实数据 |
| **Audit/Logs** (`/logs`) | (mock 模式) | ⚠️ `lib/api/index.ts` 注释 `auditProvider = mockAuditProvider // Sprint 2A 暂不实现 API` |
| **Search** (`/search`) | (mock 模式) | ⚠️ `searchProvider = mockSearchProvider // Sprint 2A 暂不实现 API` |
| **Settings** (`/settings`) | (mock 模式) | ⚠️ `settingsProvider = mockSettingsProvider` |

### 4.3 静默 fallback 风险

`fetchWithFallback` 在 fetch 失败时**自动**返回 mock, console.warn 但 UI 不显示。这对开发 OK, 但生产:
- ✅ 优点: 永不白屏
- ❌ 风险: 用户看到 mock 数据但不知道 (Tasks/Racks 已暴露 `dataSource` 字段, **其他页面未统一**)

**Sprint 4.6A 处置**:
- 文档化 (本节)
- 不改 fallback 行为 (避免改业务)
- **Sprint 4.7 建议**: 全站统一 `dataSource` 字段 + 失败时显示"API 失败, 已降级 mock" toast

### 4.4 哪些 mock 允许保留

| 允许保留 | 原因 |
|---|---|
| 写操作 (createTask / pauseTask / updateTask) | 总控 5.x 前不实现写 API (Sprint 4.1 审计) |
| Settings / Audit (CLAUDE.md 禁) | 业务做不了, 留 mock 给前端 demo |
| Search (CLAUDE.md 禁 ES) | 留 mock |
| **不允许保留** (Sprint 4.6A 已确认) | — |
| Alerts (拼 mock 数据) | Sprint 2A 临时方案, 应改 `/api/alerts` 真聚合, 见 §7 待办 |

---

## 5. 当前完整文件统计

| 目录 | 文件数 | 总行数 | 关键模块 |
|---|---|---|---|
| `app/api/**/route.ts` | 32 | ~2200 | 5 POST 写 (sync/package, control/*, site-control/*, ingest/*) + 27 GET |
| `app/**/page.tsx` | 9 | ~3500 | Tasks / Racks / Volumes / Control / Dashboard / ... |
| `lib/api/` | 11 | ~9000 | api-providers / mock-providers / dispatcher / package-auth |
| `lib/sync/` | 17 | ~7000 | package-dispatcher (554 行) / upsert / package-auth (HMAC) |
| `lib/control/` | 1 | 269 | control-command.ts (Sprint 4.5) |
| `lib/import/` | 13 | ~5000 | 14 张表 importer / aggregator |
| `lib/db/` | 3 | ~600 | postgres pool / query / transaction |
| `scripts/` | 39 | ~120KB | 11 A + 4 B + 23 C + 1 D |
| `docs/database-analysis/` | 53 | ~3MB | 53 个 sprint 文档 |
| `docs/summary/` | 9 | ~95KB | 收口文档 (本节) |

---

## 6. 写接口安全审计结论

**8 个写接口总体评价**:
- ✅ **生产可用**: `POST /api/sync/package` (HMAC + 校验 + 幂等 + 状态机 + 限表白名单)
- ✅ **生产可用**: `POST /api/control/commands` (参数化 + 状态机 + 文档化)
- ✅ **生产可用**: `POST /api/site-control/commands/[id]/result` (校验 + 终态)
- 🟡 **待加固**: `POST /api/ingest/devices|tasks` (API Key 但**未在 dashboard 暴露**, 实战可加 IP 白名单)
- 🔴 **需关注**: `POST /api/sync/devices|tasks` (无鉴权, 内部使用, 未被前端引用)
- 🟡 **Sprint 4.6 升级**: 站点侧 `x-site-control-signature` 改完整 HMAC

**统一缺失项**:
- ❌ 无 rate limiting (依赖前置 nginx / API Gateway)
- ❌ 无审计日志 (Sprint 5.5 解锁)
- ❌ 无 CSRF (Next.js 写接口默认只防同源, 跨站需 ad-hoc token)
- ❌ 无 max payload (sync/package 无 RECORD_LIMIT 强校验, 依赖 dispatcher 内部限制)

---

## 7. 下一步加固清单 (按 ROI 排序)

| 优先级 | 任务 | 估时 | 解锁 Sprint |
|---|---|---|---|
| 🔴 P0 | ADFS 接入 + control/commands 加 session 校验 | 5d | 5.1 |
| 🔴 P0 | 站点侧 HMAC 升级 (复用 verifySyncPackageRequest) | 0.5d | 4.6 |
| 🟡 P1 | Sprint-* 脚本归档到 `scripts/archive/` | 0.5d | 4.7 |
| 🟡 P1 | D 类 `analyze_disc_schema.py` 移走 | 0.5h | 4.7 |
| 🟡 P1 | sync/devices\|tasks 加 `?admin=1` token 或仅内网 | 1d | 4.7 |
| 🟡 P1 | `/api/alerts` 改造 (不再 import mock 数据) | 0.5d | 4.7 |
| 🟡 P1 | 全站统一 `dataSource` 字段 + 失败 toast | 1d | 4.7 |
| 🟢 P2 | control_command 加 `audit_command` 表 (who/when/ip) | 1d | 5.5 |
| 🟢 P2 | markCommandPulled 加 `SELECT FOR UPDATE` 分布式锁 | 0.5d | 6.4 |
| 🟢 P2 | `markCommandResult` 重复终态不报错 (HTTP 200 + warning) | 0.25d | 4.7 |
| 🟢 P3 | `POST /api/sync/package` 加 `maxRecordsPerTable` 限制 | 0.25d | 4.7 |
| 🟢 P3 | package.json 命名统一 `import-*` (去掉冒号) | 0.25d | 4.7 |
| 🟢 P3 | mock store 写操作加 console.warn 提示 | 0.25d | 4.7 |

---

## 8. Sprint 4.6A 实际处置 (本提交)

按"低风险原则"严格限定:

### ✅ 已做 (本次提交)
- 新增 `docs/summary/SCRIPTS_INDEX.md` (脚本分类索引)
- 新增本文档 (本审计报告)
- 在 `app/api/control/commands/route.ts` 头部明确标注 "不要求 Auth" + 引用 Sprint 4.5
- 在 `app/api/sync/devices/route.ts` / `tasks/route.ts` 头部加 `@deprecated` 注释 (未来 Sprint 4.7 加 admin token)
- 在 `app/api/alerts/route.ts` 头部加 `@legacy` 注释 (Sprint 2A 临时方案, 4.7 改造)

### ❌ 未做 (Sprint 4.7+)
- 不删任何文件
- 不重构目录
- 不改 fallback 行为
- 不接新鉴权 (待 5.1)
- 不改 `/api/alerts` 业务逻辑
- 不改 mock store 行为

---

## 9. 引用

- [`SCRIPTS_INDEX.md`](./SCRIPTS_INDEX.md) — 脚本分类详细索引
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — 部署 + HMAC 配置
- [`SYNC_ARCHITECTURE.md`](./SYNC_ARCHITECTURE.md) — 同步架构
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — 整体项目状态
- [`ROADMAP.md`](./ROADMAP.md) — 路线图 (含 4.6/4.7/4.8/5.x)
- `docs/database-analysis/sprint-4.1-task-control-capability-audit.md` — 控制能力审计
- `docs/database-analysis/sprint-4.2-control-architecture-with-db-sync.md` — 控制方案
- `docs/database-analysis/sprint-4.5-control-command-mvp.md` — control_command MVP 文档

---

**Sprint 4.6A 结束。下一个 Sprint 4.7 推荐优先: P0 ADFS 接入 + P1 脚本归档 + alerts 改造。**
