# Requirements Acceleration Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-value requirements batch by implementing real logs export upgrades, search-result export boundaries, runtime monitoring improvements, and a real-data floating assistant without mock or hardcoded success states.

**Architecture:** Extend existing export and monitoring APIs rather than creating parallel systems. Deliver four isolated units with TDD and one clean commit per unit: logs export, floating assistant cleanup, runtime monitoring API/UI, and search export boundary.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind/Radix, PostgreSQL, `exceljs`, existing `lib/export`, existing e2e `tsx` scripts.

---

## File Map

- `package.json`
  Responsibility: add `exceljs` dependency only if not already present.
- `lib/export/xlsx.ts`
  Responsibility: real XLSX writer.
- `lib/export/index.ts`
  Responsibility: expose XLSX flow and signature metadata.
- `app/api/logs/export/route.ts`
  Responsibility: logs export endpoint with XLSX/signature support.
- `scripts/e2e/test-exports.ts`
  Responsibility: export matrix verification.
- `scripts/e2e/test-logs.ts`
  Responsibility: logs export verification.
- `components/ui/global-control-ball.tsx`
  Responsibility: floating runtime assistant, no mock/hardcoded health.
- `app/api/system/runtime/route.ts`
  Responsibility: real runtime memory/uptime/api status boundary.
- `scripts/e2e/test-floating-assistant.ts`
  Responsibility: floating assistant real-data e2e.
- `scripts/e2e/run-all.ts`
  Responsibility: include floating assistant e2e.
- `app/api/search/export/route.ts`
  Responsibility: current-scope search export boundary.
- `app/search/page.tsx`
  Responsibility: current-scope export UI and blocker wording.
- `scripts/e2e/test-search.ts`
  Responsibility: search export verification.
- `docs/database-analysis/requirements-traceability.json`
- `docs/database-analysis/requirements-traceability.md`
- `docs/database-analysis/sprint-r.24-requirements-review.md`
- `docs/database-analysis/sprint-r.25-requirements-review.md`
- `docs/database-analysis/sprint-r.26-requirements-review.md`
- `docs/database-analysis/sprint-r.27-requirements-review.md`
- `docs/summary/PROJECT_STATUS.md`
- `docs/summary/ROADMAP.md`
  Responsibility: requirements and sprint documentation updates per unit.

## Task 1: Logs Export XLSX And Signature Boundary

**Files:**
- Modify: `package.json`
- Modify: `lib/export/xlsx.ts`
- Modify: `lib/export/index.ts`
- Modify: `app/api/logs/export/route.ts`
- Modify: `scripts/e2e/test-exports.ts`
- Modify: `scripts/e2e/test-logs.ts`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/database-analysis/sprint-r.24-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] **Step 1: Write the failing export tests**

Add assertions in `scripts/e2e/test-exports.ts` and `scripts/e2e/test-logs.ts` for:

```ts
check(
  "[logs] XLSX no longer returns 501",
  xlsxRes.status === 200,
  `HTTP ${xlsxRes.status}`
)

check(
  "[logs] XLSX includes anti-tamper metadata",
  typeof xlsxRes.headers.get("x-manifest") === "string" &&
    xlsxRes.headers.get("x-manifest")!.length > 0,
  "manifest header present"
)
```

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `set -a && source .env.local && set +a && pnpm e2e:exports`
Expected: FAIL on logs XLSX assertions with `HTTP 501`.

- [ ] **Step 3: Add XLSX dependency**

Modify `package.json` dependencies to include:

```json
"exceljs": "^4.4.0"
```

- [ ] **Step 4: Implement minimal XLSX generation**

Implement `lib/export/xlsx.ts` around `exceljs`:

```ts
import ExcelJS from "exceljs"

export async function buildXlsxBuffer(rows: Record<string, unknown>[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Export")
  const headers = Object.keys(rows[0] ?? {})
  if (headers.length > 0) {
    sheet.addRow(headers)
    for (const row of rows) {
      sheet.addRow(headers.map((key) => row[key] ?? ""))
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}
```

- [ ] **Step 5: Wire XLSX into export pipeline**

Update `lib/export/index.ts` and `/api/logs/export` so `format=xlsx`:

```ts
if (format === "xlsx") {
  const body = await buildXlsxBuffer(serializedRows)
  return buildExportResponse({
    body,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    manifest,
  })
}
```

- [ ] **Step 6: Implement signature metadata boundary**

Use digest + optional key ref, without storing secret values:

```ts
const signingKeyRef = process.env.EXPORT_SIGNING_KEY_REF ?? null
manifest.signature = signingKeyRef
  ? { status: "configured", keyRef: signingKeyRef, algorithm: "rsa-sha256" }
  : { status: "blocked_by_config", keyRef: null, algorithm: "rsa-sha256" }
```

- [ ] **Step 7: Re-run targeted tests**

Run: `set -a && source .env.local && set +a && pnpm e2e:exports && pnpm e2e:logs`
Expected: PASS.

- [ ] **Step 8: Update requirements/docs for Task 1**

Record actual outcome:
- `complete` only if real signing is configured and verified.
- otherwise keep `partial` and document `blocked_by_config`.

- [ ] **Step 9: Run full verification**

Run:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```bash
git add package.json lib/export/xlsx.ts lib/export/index.ts app/api/logs/export/route.ts scripts/e2e/test-exports.ts scripts/e2e/test-logs.ts docs/database-analysis/requirements-traceability.json docs/database-analysis/requirements-traceability.md docs/database-analysis/sprint-r.24-requirements-review.md docs/summary/PROJECT_STATUS.md docs/summary/ROADMAP.md
git commit -m "feat(export): add real logs xlsx export"
```

## Task 2: Floating Assistant Real Data Cleanup

**Files:**
- Modify: `components/ui/global-control-ball.tsx`
- Create: `scripts/e2e/test-floating-assistant.ts`
- Modify: `scripts/e2e/run-all.ts`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/database-analysis/sprint-r.25-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] **Step 1: Write the failing assistant test**

Create `scripts/e2e/test-floating-assistant.ts` with checks:

```ts
check("floating assistant source code exists", src.includes("GlobalControlBall"), "component present")
check("does not import mock notifications", !src.includes("lib/mock/notifications"), "no mock import")
check("uses real alerts api", src.includes("/api/alerts"), "real alerts api")
check("uses real health apis", src.includes("/api/system/health") && src.includes("/api/system/db-health"), "health apis")
check("does not hardcode CPU 23%", !src.includes("23%"), "no hardcoded cpu")
check("does not hardcode memory 45%", !src.includes("45%"), "no hardcoded memory")
```

- [ ] **Step 2: Run targeted test to verify it fails**

Run: `set -a && source .env.local && set +a && pnpm tsx scripts/e2e/test-floating-assistant.ts`
Expected: FAIL because mock import and hardcoded values still exist.

- [ ] **Step 3: Replace mock notification model with real endpoint fetches**

Refactor `components/ui/global-control-ball.tsx` to fetch:

```ts
const [health, setHealth] = useState<...>(null)
const [dbHealth, setDbHealth] = useState<...>(null)
const [alerts, setAlerts] = useState<...>([])
const [commands, setCommands] = useState<...>([])
const [siteStatus, setSiteStatus] = useState<...>([])
```

and load:

```ts
fetch("/api/system/health")
fetch("/api/system/db-health")
fetch("/api/alerts?pageSize=10")
fetch("/api/control/commands?limit=10")
fetch("/api/sync/sites/status")
```

- [ ] **Step 4: Remove fake content**

Delete:
- mock notification import
- fake unread count logic
- hardcoded `正常运行`, `已同步`, `已保护`
- hardcoded CPU and memory percentages

Replace with blocker/error states when data is absent.

- [ ] **Step 5: Add blocker tab**

Render explicit blocked entries:

```tsx
[
  { key: "auth", blocker: "blocked_by_auth", label: "统一认证/RBAC 未开放" },
  { key: "search", blocker: "blocked_by_external_system", label: "统一检索依赖 ES/ClickHouse" },
  { key: "manual-sync", blocker: "blocked_by_site_change", label: "网页手动同步触发未开放" },
]
```

- [ ] **Step 6: Re-run targeted tests**

Run:

```bash
set -a && source .env.local && set +a
pnpm tsx scripts/e2e/test-floating-assistant.ts
```

Expected: PASS.

- [ ] **Step 7: Include the test in the suite**

Modify `scripts/e2e/run-all.ts` to add:

```ts
"e2e:floating-assistant"
```

and add corresponding script in `package.json` if needed.

- [ ] **Step 8: Update requirements/docs for Task 2**

Document removal of mock/hardcoded status and note this is partial strengthening, not a new complete requirement.

- [ ] **Step 9: Run full verification**

Run the standard full verification block.
Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```bash
git add components/ui/global-control-ball.tsx scripts/e2e/test-floating-assistant.ts scripts/e2e/run-all.ts package.json docs/database-analysis/requirements-traceability.json docs/database-analysis/requirements-traceability.md docs/database-analysis/sprint-r.25-requirements-review.md docs/summary/PROJECT_STATUS.md docs/summary/ROADMAP.md
git commit -m "feat(ui): make floating assistant use real data"
```

## Task 3: Runtime Monitoring API And UI

**Files:**
- Create: `app/api/system/runtime/route.ts`
- Modify: `components/ui/global-control-ball.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `scripts/e2e/test-settings.ts`
- Modify: `scripts/e2e/test-floating-assistant.ts`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/database-analysis/sprint-r.26-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] **Step 1: Write the failing monitoring tests**

Add assertions in `scripts/e2e/test-settings.ts` and `scripts/e2e/test-floating-assistant.ts`:

```ts
check("runtime api returns 200", runtimeRes.status === 200, `HTTP ${runtimeRes.status}`)
check("runtime api exposes memory and uptime", typeof runtime.memory.rssMb === "number" && typeof runtime.process.uptimeSec === "number", "runtime fields")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `set -a && source .env.local && set +a && pnpm e2e:settings`
Expected: FAIL because `/api/system/runtime` does not exist.

- [ ] **Step 3: Implement runtime API**

Create `app/api/system/runtime/route.ts`:

```ts
import { NextResponse } from "next/server"

export async function GET() {
  const memory = process.memoryUsage()
  return NextResponse.json({
    code: 0,
    source: "runtime",
    data: {
      process: { uptimeSec: Math.round(process.uptime()) },
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
      hostMetrics: { status: "blocked_by_runtime_source" },
    },
  })
}
```

- [ ] **Step 4: Render runtime data in settings and floating assistant**

Add read-only runtime cards:

```tsx
运行内存: {runtime.memory.rssMb} MB
进程运行: {runtime.process.uptimeSec}s
主机 CPU/磁盘: blocked_by_runtime_source
```

- [ ] **Step 5: Re-run targeted tests**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:settings
pnpm tsx scripts/e2e/test-floating-assistant.ts
```

Expected: PASS.

- [ ] **Step 6: Update requirements/docs for Task 3**

Document that runtime/process metrics are now real, but host CPU/disk history and alerts remain partial.

- [ ] **Step 7: Run full verification**

Run the standard full verification block.
Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/api/system/runtime/route.ts components/ui/global-control-ball.tsx app/settings/page.tsx scripts/e2e/test-settings.ts scripts/e2e/test-floating-assistant.ts docs/database-analysis/requirements-traceability.json docs/database-analysis/requirements-traceability.md docs/database-analysis/sprint-r.26-requirements-review.md docs/summary/PROJECT_STATUS.md docs/summary/ROADMAP.md
git commit -m "feat(monitoring): add real runtime status api"
```

## Task 4: Search Export Current-Scope Boundary

**Files:**
- Create: `app/api/search/export/route.ts`
- Modify: `app/search/page.tsx`
- Modify: `scripts/e2e/test-search.ts`
- Modify: `scripts/e2e/test-exports.ts`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Create: `docs/database-analysis/sprint-r.27-requirements-review.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] **Step 1: Write the failing search export tests**

Add assertions:

```ts
check("search export endpoint exists", exportRes.status !== 404, `HTTP ${exportRes.status}`)
check("search export declares current-scope blocker", exportJson.blocker === "blocked_by_external_system", `blocker=${exportJson.blocker}`)
```

- [ ] **Step 2: Run targeted test to verify it fails**

Run: `set -a && source .env.local && set +a && pnpm e2e:search`
Expected: FAIL because `/api/search/export` does not exist.

- [ ] **Step 3: Implement current-scope export API**

Create `app/api/search/export/route.ts` reusing export helpers:

```ts
return NextResponse.json(
  {
    code: 501,
    source: "not_implemented_current_scope",
    blocker: "blocked_by_external_system",
    reqId: "REQ-4.1.3",
    data: currentRows,
  },
  { status: 501 }
)
```

If a CSV/JSON download is implemented, label it explicitly as current-scope only.

- [ ] **Step 4: Add UI export affordance with explicit wording**

In `app/search/page.tsx` add a button labeled:

```tsx
导出当前可用结果
```

and blocker copy:

```tsx
当前导出仅覆盖现有可用结果，不代表完整跨站文件索引检索。
```

- [ ] **Step 5: Re-run targeted tests**

Run:

```bash
set -a && source .env.local && set +a
pnpm e2e:search
pnpm e2e:exports
```

Expected: PASS.

- [ ] **Step 6: Update requirements/docs for Task 4**

If required fields are still missing, keep REQ-4.1.3 `partial` and list exact missing fields. Do not claim complete unless all required fields exist.

- [ ] **Step 7: Run full verification**

Run the standard full verification block.
Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/api/search/export/route.ts app/search/page.tsx scripts/e2e/test-search.ts scripts/e2e/test-exports.ts docs/database-analysis/requirements-traceability.json docs/database-analysis/requirements-traceability.md docs/database-analysis/sprint-r.27-requirements-review.md docs/summary/PROJECT_STATUS.md docs/summary/ROADMAP.md
git commit -m "feat(search): add current-scope export boundary"
```

## Plan Self-Review

- Spec coverage:
  - U1 covered by Task 1.
  - U4 covered by Task 2.
  - U3 covered by Task 3.
  - U2 covered by Task 4.
- Placeholder scan:
  - No `TBD`, `TODO`, or “implement later” placeholders remain.
- Type consistency:
  - Runtime API uses `code/source/data` shape consistent with existing APIs.
  - Floating assistant reads the same endpoint names defined above.
- Scope check:
  - Four independent units remain isolated, each with its own verification and commit.
