# Requirements Acceleration Product Plan

> Date: 2026-06-19
> Scope: 日志导出、检索结果导出、监控、全局悬浮运行助手
> Source of truth: `docs/source/requirements.md`
> Constraint docs: `CLAUDE.md`, `AGENTS.md`, `docs/database-analysis/requirements-traceability.json`

## 1. Product Framing

当前问题不是“没有功能”，而是功能分散、真实边界不明显、requirements 完成率被严格口径压住。接下来要按产品经理视角做两件事:

1. 把能从 `partial/not_started` 推到 `complete` 的需求优先闭环。
2. 把不能 complete 的能力做成清晰的 blocked/partial 状态，让领导和普通用户不会误解为“没做”或“假成功”。

本设计默认用户不了解架构、不读需求文档、只看页面和汇报。因此所有入口必须做到:

- 能做的，给真实 API、真实下载、真实日志、真实 e2e。
- 不能做的，明确写 blocker 类型和解除条件。
- 禁止 mock、硬编码成功、DRY_RUN 冒充真实完成。
- 所有新增按钮或交互必须有 e2e。

## 2. Target Requirement Units

| Unit | Requirement | Current | Target | Completion impact |
|---|---|---|---|---|
| U1 日志导出闭环 | REQ-5.1.2 | `partial` | 尽量 `complete` | 预计 `4/45` -> `5/45` |
| U2 检索结果导出 | REQ-4.1.3 | `not_started` | `partial` 或 `complete` only if current result scope is accepted | 可能提升, 需严格判定 |
| U3 监控真实化 | REQ-6.4.2 | `partial` | 强化 `partial`; complete 需历史趋势/告警闭环 | 通常不涨, 但提高可见度 |
| U4 全局悬浮运行助手 | REQ-6.4.2 / REQ-2.1.3 / REQ-2.3.2 / REQ-4.2.4 | 有 UI 但含 mock/硬编码 | 真实状态助手 | 不直接涨, 但消除 mock 风险 |

## 3. U1 日志导出闭环

### 3.1 Goal

把日志导出从“CSV/JSON + SHA-256 摘要”提升到 requirements 要求的:

- Excel / CSV / JSON
- 按任务ID、时间范围、站点、结果状态、任务类型筛选
- 大文件分片或明确安全上限
- 导出文件含防篡改签名
- 审计可追溯

### 3.2 Design

Extend existing `lib/export` rather than creating parallel exporters.

Work items:

1. Add `exceljs` as the approved XLSX dependency.
2. Implement real XLSX generation in `lib/export/xlsx.ts`.
3. Add export signature metadata:
   - Use env key ref, not secret value.
   - Store only signature algorithm, key id/ref, digest, createdAt.
   - Do not commit private keys.
4. Add real signature mode:
   - If `EXPORT_SIGNING_PRIVATE_KEY` or equivalent env ref is configured, sign the digest.
   - If not configured, return explicit `signature.status = "blocked_by_config"` and keep SHA-256 digest.
5. Update `/api/logs/export` to support real XLSX.
6. Keep CSV/JSON compatibility headers.
7. Extend `scripts/e2e/test-exports.ts`:
   - XLSX is no longer 501 for logs.
   - Downloaded XLSX has expected rows/headers.
   - Signature/digest metadata exists.
   - No secrets in body or headers.

### 3.3 Completion Rule

REQ-5.1.2 can be marked `complete` only if:

- XLSX, CSV, JSON all work for logs.
- Filter matrix is covered.
- Export audit is written.
- Signature is real, or requirements review explicitly records that cryptographic signing is blocked by missing key and keeps status `partial`.

If leadership accepts SHA-256 digest as the required anti-tamper mechanism, record that decision in requirements review. Without that decision, do not claim digital signature complete.

## 4. U2 检索结果导出

### 4.1 Goal

Provide a real export path for currently available search results without pretending the ES/ClickHouse full-text search exists.

### 4.2 Design

Current `/api/search` is explicitly `501 not_implemented` for full search, with limited current rows. Therefore the export must be scoped carefully.

Recommended implementation:

1. Add `/api/search/export`.
2. Reuse `lib/export`.
3. Export only current real fallback rows returned by the existing search boundary.
4. Response must include:
   - `source = "not_implemented_current_scope"` or equivalent.
   - `blocker = "blocked_by_external_system"` for full search.
   - `reqId = "REQ-4.1.3"`.
5. UI on `/search`:
   - Add export button only if it clearly says “导出当前可用结果”.
   - Banner must state full cross-site file index export still depends on ES/ClickHouse.
6. e2e must verify:
   - Export downloads real current rows.
   - No fake full-search result.
   - Blocker metadata exists.

### 4.3 Completion Rule

Do not mark REQ-4.1.3 complete unless the exported data covers requirements fields:

- 文件路径
- 大小
- 创建时间
- 存储位置
- 所属部门

If current source lacks these fields, mark `partial` and list exact missing source schema/data.

## 5. U3 监控真实化

### 5.1 Goal

Turn monitoring from scattered health checks into a real operations view:

- System health
- DB latency
- API latency
- Site Agent heartbeat
- Sync alert summary
- Control queue status
- Explicit missing CPU/memory/disk host metrics if not available

### 5.2 Design

Use existing real endpoints first:

- `GET /api/system/health`
- `GET /api/system/db-health`
- `GET /api/sync/sites/status`
- `GET /api/alerts`
- `GET /api/control/commands`

Add only if needed:

- `GET /api/system/runtime`
  - Node process uptime, memory from `process.memoryUsage()`, platform, node version.
  - Do not fake host CPU/disk if not reliably available.
  - If CPU/disk unavailable, return `blocked_by_runtime_source`.

UI targets:

- `/settings` health section
- Global runtime assistant
- Optional Command Center small card

### 5.3 Completion Rule

REQ-6.4.2 remains `partial` unless all are true:

- CPU, memory, disk, interface/API status are real.
- Historical trend exists.
- Alert trigger exists.
- e2e verifies API + UI.

If only runtime memory/API latency are added, mark as partial strengthening.

## 6. U4 Global Runtime Assistant

### 6.1 Current Problems

`components/ui/global-control-ball.tsx` is globally mounted in `app/layout.tsx`, but currently has requirements risks:

- Imports `lib/mock/notifications`.
- Shows fake task/security/system notifications.
- Shows hardcoded `正常运行`, `已同步`, `已保护`.
- Shows hardcoded CPU `23%` and memory `45%`.
- Overlaps with `CommandPalette` navigation.

### 6.2 Product Role

The floating ball should become a “global runtime assistant”, not a decorative control panel.

It should answer four user questions:

1. Is the platform alive?
2. Are sync/site/control flows healthy?
3. What needs attention now?
4. Where do I click next?

### 6.3 Design

Replace mock/hardcoded content with real data:

- Health: `/api/system/health`
- DB: `/api/system/db-health`
- Site/Agent: `/api/sync/sites/status`
- Alerts: `/api/alerts`
- Commands: `/api/control/commands`

Keep:

- Theme toggle
- Refresh
- Fullscreen
- Navigation links
- Route history

Remove or replace:

- `lib/mock/notifications`
- Fake unread count
- Fake task completion/security notifications
- Hardcoded CPU/memory/security/sync success

Panel structure:

1. Header: current page + overall health badge.
2. Tab “运行”: real health, DB latency, Agent status, sync alert count, control pending count.
3. Tab “告警”: real alerts from `/api/alerts`, with source labels.
4. Tab “入口”: navigation links.
5. Tab “阻塞”: Auth/RBAC, ES/ClickHouse search, manual sync command, host CPU/disk metrics.

### 6.4 Completion Rule

This unit is a UI/monitoring quality unit. It should not directly mark a requirement complete unless monitoring requirements are fully satisfied. It must, however, remove mock risk and improve demo clarity.

## 7. Implementation Order

Recommended order:

1. U1 logs export, because it is the highest chance of increasing completion rate.
2. U4 floating assistant cleanup, because it removes mock/hardcoded risk visible on every page.
3. U3 monitoring runtime API, because U4 can consume it.
4. U2 search export, because it is useful but likely remains partial until ES/ClickHouse.

Each unit must be one commit:

| Commit | Unit | Required checks |
|---|---|---|
| C1 | Logs export XLSX/signature | `e2e:exports`, `e2e:logs`, all required checks |
| C2 | Floating assistant real data | new/updated e2e for floating assistant, `e2e:all` |
| C3 | Monitoring runtime API/UI | `e2e:settings`, `e2e:all` |
| C4 | Search export | `e2e:search`, `e2e:exports`, `e2e:all` |

## 8. Testing Requirements

Every implementation commit must run:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

Targeted tests:

- Logs/export: `pnpm e2e:exports`, `pnpm e2e:logs`
- Search export: `pnpm e2e:search`
- Monitoring/settings: `pnpm e2e:settings`
- Floating assistant: add `pnpm e2e:floating-assistant` and include it in `e2e:all`

## 9. User-Facing Report Language

Safe report sentence after this batch:

> 本轮目标不是做演示页，而是把 requirements 中最可能闭环的导出能力补齐，并清理全局悬浮助手里的 mock/硬编码状态。日志导出预计可推动完成率从 4/45 到 5/45；检索导出和监控按真实边界推进，不能完成的部分会在页面和文档中明确标 blocked。

Forbidden report language:

- “监控完成” unless CPU/memory/disk/API + history + alert are real.
- “检索完成” unless ES/ClickHouse or equivalent full index is live.
- “数字签名完成” unless real cryptographic signing key is configured and verified.
- “悬浮球通知完成” if notifications are still mock.

## 10. Open Decisions

Resolved:

- `exceljs` dependency is allowed.

Needs implementation-time verification:

- Whether a real signing private key env ref exists. If absent, U1 may remain partial unless leadership accepts SHA-256 digest as anti-tamper evidence.
- Whether current search fallback rows contain all REQ-4.1.3 export fields. If not, U2 remains partial.
- Whether Node runtime data is enough for REQ-6.4.2 partial strengthening. It is not enough for complete.
