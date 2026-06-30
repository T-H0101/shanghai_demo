# R.91.1 全站收尾与交付验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete development-stage closeout so PR #7 is reviewable, mergeable, and presentable to leadership — no hidden fake merges, no developer terminology in user-visible text, no fake-pass audits.

**Architecture:** Redirect `/check` and `/volumes` to `/racks?view=inspection` and `/racks?view=volumes` respectively. Add sub-view rendering in `/racks` via URL `view` param. Extract volumes content into a reusable component. Create a simplified inspection summary component. Remove `/volumes` from command palette. Clean all forbidden developer terminology from user-visible text across `app/` and `components/`. Strengthen all 4 audit scripts to catch the problems that currently fake-pass. Update docs to reflect real state.

**Tech Stack:** Next.js 16.2.6 + React 19 + TypeScript + Tailwind v4 + Radix UI + PostgreSQL 17

## Global Constraints

- Continue on branch `codex/r84-development-architecture-cleanup-plans`, PR #7 not merged
- No production deployment, no ES/OpenSearch production landing, no 170-table browser
- No new business features beyond requirements.md scope
- Forbidden user-visible terms: `dispatcher`, `source_restore`, `sync_package`, `not_run`, `blocked_by_*`, `Site Agent`, `unified_*`, `数据来源:`, `等待闭环`, `真实` (overused), `mock`, `演示模式`, `源表`, `源记录 ID`, `__demo__`
- Required user-language replacements: `未运行`, `暂无数据`, `暂不可用`, `请先完成站点同步`, `站点代理未在线`
- Every commit must pass: `tsc --noEmit`, `pnpm build`, `pnpm smoke:sync`, `pnpm baseline:check`, all audit gates
- `blocked_by_*` enum values may stay as code-level keys but must NOT appear in user-visible labels, descriptions, or toast text — they are mapped through `displayStatus()` to user language

---

## File Structure

| File | Responsibility |
|---|---|
| `app/check/page.tsx` | Redirect to `/racks?view=inspection` (replace 400-line 17-tab page) |
| `app/volumes/page.tsx` | Redirect to `/racks?view=volumes` (replace 475-line standalone page) |
| `app/racks/page.tsx` | Add `view` URL param handling; conditional render inspection/volumes sub-views |
| `components/racks/inspection-view.tsx` | NEW — simplified inspection summary (no raw table tabs) |
| `components/racks/volumes-view.tsx` | NEW — extracted volumes listing from old volumes page |
| `components/shared/command-palette.tsx` | Remove `p-volumes` entry |
| `components/rbac/dictionaries-tab.tsx` | Rename `字典` → `基础配置`; remove `数据来源:` / `unified_*` / `源记录 ID` |
| `components/rbac/logs-credentials-tab.tsx` | Rename `日志与凭据` → `权限日志`; remove `数据来源:` / `unified_*` / `源记录 ID` |
| `components/rbac/role-permissions-tab.tsx` | Remove `数据来源:` / `unified_*` / `源记录 ID` |
| `app/users/page.tsx` | Remove `源表`, `源记录 ID`, `真实`; rename tab labels |
| `app/settings/page.tsx` | Replace `blocked_by_*` in user-visible labels; remove `真实`; ensure displayStatus maps all enum keys to user language |
| `app/sync/page.tsx` | Remove `not_run` in user-visible string; replace `真实` |
| `app/logs/page.tsx` | Remove `sync_package` from user-visible description and info text |
| `app/tasks/page.tsx` | Remove `演示模式`, `真实`; replace `Site Agent` if any remaining |
| `components/dashboard/welcome-banner.tsx` | Remove `sync_package` from hint text |
| `components/dashboard/sync-trend-chart.tsx` | Remove `真实` |
| `components/ui/global-control-ball.tsx` | Remove `真实` |
| `components/tasks/control-command-panel.tsx` | Remove `真实` |
| `components/layout/app-shell.tsx` | Remove `真实` from all onboarding messages |
| `scripts/audit/page-scope.ts` | Strengthen: add command palette check, route auto-discovery, /check 17-tab fail gate |
| `scripts/audit/product-copy.ts` | Strengthen: scan `components/`, add all 16+ forbidden patterns, remove `break` on first match |
| `scripts/audit/data-coverage.ts` | Strengthen: enforce minRows > 0 for data-required pages, add `emptyAllowed` flag, 3-tier verdict |
| `scripts/audit/page-no-todo-comments.ts` | Strengthen: add `mock`, `等待闭环`, `临时` patterns; scan `.ts` layout files |
| `docs/database-analysis/sprint-r91.1-requirements-review.md` | NEW — real conclusions |
| `README.md` | Update page list, verification instructions |
| `docs/operations/deployment.md` | Update verification section |

---

### Task 1: Page Redirects + Command Palette Cleanup

**Files:**
- Modify: `app/check/page.tsx` (replace entire 400-line content)
- Modify: `app/volumes/page.tsx` (replace entire 475-line content)
- Modify: `components/shared/command-palette.tsx` (remove p-volumes entry)

**Interfaces:**
- Consumes: `next/navigation` `redirect()` function
- Produces: `/check` route redirects to `/racks?view=inspection`; `/volumes` redirects to `/racks?view=volumes`; command palette no longer lists `/volumes`

- [ ] **Step 1: Replace /check/page.tsx with redirect**

```tsx
import { redirect } from "next/navigation"

/**
 * /check → redirect to /racks?view=inspection
 * R.91.1: 原始 17-tab 页已合并到盘架管理巡检区域
 */
redirect("/racks?view=inspection")
```

- [ ] **Step 2: Replace /volumes/page.tsx with redirect**

```tsx
import { redirect } from "next/navigation"

/**
 * /volumes → redirect to /racks?view=volumes
 * R.91.1: 存储卷管理已合并到盘架管理容量区域
 */
redirect("/racks?view=volumes")
```

- [ ] **Step 3: Remove p-volumes from command palette**

In `components/shared/command-palette.tsx`, find the `p-volumes` CommandItem (around line 155) and delete it entirely:

```diff
-  { id: "p-volumes", label: "存储卷", icon: HardDrive, group: "page", keywords: ["volumes", "存储", "卷", "容量"], perform: () => router.push("/volumes") },
```

Also remove the `HardDrive` icon import if it's only used by this entry (check other usages first — `HardDrive` is also used in sidebar for `/racks`, so keep the import).

- [ ] **Step 4: Verify redirect works**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

Run: `pnpm build`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add app/check/page.tsx app/volumes/page.tsx components/shared/command-palette.tsx
git commit -m "refactor(r91.1): redirect /check and /volumes to /racks sub-views, remove volumes from command palette"
```

---

### Task 2: Inspection View Component

**Files:**
- Create: `components/racks/inspection-view.tsx`
- Modify: `app/racks/page.tsx` (add view param handling + conditional render)

**Interfaces:**
- Consumes: `useSite()` from site context for `siteCode`; `fetch("/api/racks?siteCode=...")` for device data that includes inspection-related records
- Produces: `<InspectionView />` React component exported for use in `/racks` page; URL param `view=inspection` triggers this component

- [ ] **Step 1: Create inspection-view.tsx**

Create `components/racks/inspection-view.tsx` with a simplified inspection summary. This component shows:
- A header card "巡检概览"
- 3 stat cards (检查任务数, 巡检策略数, 最近日志数) — all fetched from API or shown as "暂无数据"
- A recent records table with user-friendly columns (任务名, 状态, 执行时间, 结果) — NOT `source_table` / `source_record_id`
- Proper empty state: "暂无巡检记录，请先完成站点同步"

```tsx
"use client"

import { useState, useEffect } from "react"
import { useSite } from "@/components/shared/site-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface InspectionSummary {
  taskCount: number
  patrolCount: number
  recentLogs: number
  records: Array<{
    name: string
    status: string
    executedAt: string | null
    result: string
  }>
}

export function InspectionView() {
  const { siteCode } = useSite()
  const [data, setData] = useState<InspectionSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!siteCode) return
    setLoading(true)
    fetch(`/api/racks?siteCode=${siteCode}`)
      .then(r => r.json())
      .then(json => {
        // Extract inspection-related counts from the racks API response
        const summary = json?.data?.inspection ?? {
          taskCount: 0,
          patrolCount: 0,
          recentLogs: 0,
          records: [],
        }
        setData(summary)
      })
      .catch(() => setData({
        taskCount: 0, patrolCount: 0, recentLogs: 0, records: [],
      }))
      .finally(() => setLoading(false))
  }, [siteCode])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中...</div>

  const hasData = data && (data.taskCount > 0 || data.patrolCount > 0 || data.recentLogs > 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">巡检概览</CardTitle>
          <CardDescription>
            {siteCode ? `站点 ${siteCode} 的检查与巡检状态` : "请先选择站点"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              暂无巡检记录，请先完成站点同步
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{data!.taskCount}</p>
                <p className="text-xs text-muted-foreground">检查任务</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data!.patrolCount}</p>
                <p className="text-xs text-muted-foreground">巡检策略</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{data!.recentLogs}</p>
                <p className="text-xs text-muted-foreground">最近日志</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasData && data!.records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">最近巡检记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.records.slice(0, 10).map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm">{r.name}</span>
                  <Badge variant={r.status === "completed" ? "default" : "secondary"}>
                    {r.status === "completed" ? "已完成" : r.status === "running" ? "执行中" : "未运行"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add view param handling to /racks/page.tsx**

At the top of `app/racks/page.tsx`, add `useSearchParams` import and read the `view` param:

```tsx
import { useSearchParams } from "next/navigation"
```

Inside the page component function, after existing state declarations, add:

```tsx
const searchParams = useSearchParams()
const view = searchParams.get("view") // "inspection" | "volumes" | null (default)
```

Add conditional rendering before the main racks content. When `view` is set, render the sub-view instead:

```tsx
if (view === "inspection") {
  return (
    <div className="p-6 space-y-6">
      <InspectionView />
      <button onClick={() => router.push("/racks")} className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回盘架管理
      </button>
    </div>
  )
}

if (view === "volumes") {
  return (
    <div className="p-6 space-y-6">
      <VolumesView />
      <button onClick={() => router.push("/racks")} className="text-sm text-muted-foreground hover:text-foreground">
        ← 返回盘架管理
      </button>
    </div>
  )
}
```

Add imports at the top of the file:

```tsx
import { InspectionView } from "@/components/racks/inspection-view"
import { VolumesView } from "@/components/racks/volumes-view"
```

- [ ] **Step 3: Verify tsc + build**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors (may need to adjust if InspectionView props don't match)

Run: `pnpm build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add components/racks/inspection-view.tsx app/racks/page.tsx
git commit -m "feat(r91.1): add inspection sub-view to /racks, handle view URL param"
```

---

### Task 3: Volumes View Component + Integration

**Files:**
- Create: `components/racks/volumes-view.tsx`
- Modify: `app/racks/page.tsx` (already done in Task 2 — this task creates the component)

**Interfaces:**
- Consumes: `useSite()` for `siteCode`; `fetchVolumes` from `lib/api/api-providers` for volume data; `VolumeDTO` types
- Produces: `<VolumesView />` React component; URL param `view=volumes` triggers this component

- [ ] **Step 1: Read current volumes page to identify extractable content**

Read `app/volumes/page.tsx` fully. Identify the core rendering logic (stat cards, volume list table, detail drawer) that can be extracted into a standalone component. The page-level wrapper (layout, SEO metadata) stays in the redirect file.

- [ ] **Step 2: Create volumes-view.tsx**

Create `components/racks/volumes-view.tsx` by extracting the core volumes content from the old `/volumes` page. The component should:
- Accept no props (uses `useSite()` internally for siteCode)
- Show 4 stat cards (卷总数, 总容量/已用, 盘位聚合, 聚合覆盖)
- Show volume list with search + type filter
- Show detail drawer on row click
- Show proper empty state: "暂无存储卷数据" when no volumes returned
- NOT show `数据来源:` or `unified_*` table names
- NOT show `源记录 ID` or `源表` column headers

Copy the relevant JSX sections from the old volumes page, adapting:
- Remove page-level layout wrapper
- Replace `useSite()` call if volumes page used a different mechanism
- Remove any `数据来源:` / `源表` / `源记录 ID` / `unified_*` references
- Replace `真实` with appropriate user language or remove it

- [ ] **Step 3: Verify tsc + build**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

Run: `pnpm build`
Expected: success

- [ ] **Step 4: Commit**

```bash
git add components/racks/volumes-view.tsx
git commit -m "feat(r91.1): extract volumes view component for /racks integration"
```

---

### Task 4: RBAC Components Product Copy Cleanup

**Files:**
- Modify: `components/rbac/dictionaries-tab.tsx`
- Modify: `components/rbac/logs-credentials-tab.tsx`
- Modify: `components/rbac/role-permissions-tab.tsx`
- Modify: `app/users/page.tsx` (tab label changes)

**Interfaces:**
- Consumes: Current RBAC tab component structure
- Produces: Cleaned user-visible text; `字典` → `基础配置`; `日志与凭据` → `权限日志`; no `数据来源:` / `unified_*` / `源记录 ID` / `源表`

- [ ] **Step 1: Clean dictionaries-tab.tsx**

In `components/rbac/dictionaries-tab.tsx`:
1. Change `<span>字典 ({items.length})</span>` → `<span>基础配置 ({items.length})</span>`
2. Change `<TableHead>字典名</TableHead>` → `<TableHead>名称</TableHead>`
3. Change `<TableHead>字典值</TableHead>` → `<TableHead>配置值</TableHead>`
4. Remove `<TableHead>源记录 ID</TableHead>` column entirely (delete the TableHead and corresponding TableCell renders)
5. Remove the `<p>数据来源: {SOURCE_TABLES.join(" / ")}</p>` line — replace with nothing or a subtle "同步数据" note without table names
6. If SOURCE_TABLES constant is only used for that display, remove it entirely

- [ ] **Step 2: Clean logs-credentials-tab.tsx**

In `components/rbac/logs-credentials-tab.tsx`:
1. Change `<span>日志与凭据 ({items.length})</span>` → `<span>权限日志 ({items.length})</span>`
2. Remove `<TableHead>源记录 ID</TableHead>` column
3. Remove `<p>数据来源: {SOURCE_TABLES.join(" / ")}</p>` — replace with nothing or "同步数据" without table names
4. Remove SOURCE_TABLES constant if only used for display

- [ ] **Step 3: Clean role-permissions-tab.tsx**

In `components/rbac/role-permissions-tab.tsx`:
1. Remove `<TableHead>源记录 ID</TableHead>` column
2. Remove `<p>数据来源: {SOURCE_TABLES.join(" / ")}</p>` — replace with nothing or "同步数据" without table names
3. Remove SOURCE_TABLES constant if only used for display

- [ ] **Step 4: Clean users/page.tsx tab labels**

In `app/users/page.tsx`:
1. Change `<TabsTrigger value="dict" className="text-xs">字典</TabsTrigger>` → `<TabsTrigger value="dict" className="text-xs">基础配置</TabsTrigger>`
2. Change `<TabsTrigger value="logs" className="text-xs">日志与凭据</TabsTrigger>` → `<TabsTrigger value="logs" className="text-xs">权限日志</TabsTrigger>`
3. Remove `<DetailRow label="源表" value={selected.sourceTable} />`
4. Remove `<DetailRow label="源记录 ID" value={selected.sourceId} />`
5. Replace `真实` in toast description: `${recordCount} 条真实账号` → `${recordCount} 条账号`
6. Replace `真实` in rendered text: "需真实 Auth/RBAC 服务" → "需认证与权限服务"

- [ ] **Step 5: Verify tsc + build**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add components/rbac/dictionaries-tab.tsx components/rbac/logs-credentials-tab.tsx components/rbac/role-permissions-tab.tsx app/users/page.tsx
git commit -m "fix(r91.1): clean RBAC product copy — rename tabs, remove 数据来源/源记录 ID/源表/unified_*"
```

---

### Task 5: Settings Page Product Copy Cleanup

**Files:**
- Modify: `app/settings/page.tsx`

**Interfaces:**
- Consumes: Current settings page BlockedItem component and displayStatus mapping
- Produces: User-language labels on BlockedItem; `真实` replaced; `blocked_by_*` only as internal enum keys mapped to user language via displayStatus

- [ ] **Step 1: Replace `真实` in BlockedItem labels**

In `app/settings/page.tsx`:
1. `<BlockedItem label="真实告警阈值与任务策略"` → `<BlockedItem label="告警阈值与任务策略"`
2. Find and replace ALL other `真实` occurrences in user-visible strings with context-appropriate alternatives:
   - "真实数据" → "数据" or "同步数据"
   - "真实状态" → "状态" or "运行状态"
   - "真实告警" → "告警"

- [ ] **Step 2: Verify blocked_by_* is only in displayStatus mapping keys, not user-visible labels**

Check that all `blocked_by_auth`, `blocked_by_external_system`, `blocked_by_source_schema`, `blocked_by_site_change` values are:
- In `displayStatus` mapping keys (line ~702-705) — these are OK, they map to user language ("待认证服务", "待外部服务", etc.)
- In `<BlockedItem status="blocked_by_*">` props — these are OK because BlockedItem calls displayStatus() internally to convert to user text
- NOT in any user-visible string literal (label, description, toast text)

If any `blocked_by_*` string appears directly in user-visible text (not through displayStatus mapping), replace it with the mapped user language.

- [ ] **Step 3: Verify not_run is handled through displayStatus**

Check that `not_run` only appears as a displayStatus mapping key (`not_run: "未运行"` at line ~706) and as fallback values in code logic (`?? "not_run"`). The user should never see the raw string `not_run`. If there's any user-visible rendering of `not_run` as a raw string, replace it.

- [ ] **Step 4: Verify tsc + build**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx
git commit -m "fix(r91.1): clean settings product copy — remove 真实, verify blocked_by_* only in displayStatus keys"
```

---

### Task 6: All Remaining Pages Product Copy Cleanup

**Files:**
- Modify: `app/sync/page.tsx`
- Modify: `app/logs/page.tsx`
- Modify: `app/tasks/page.tsx`
- Modify: `components/dashboard/welcome-banner.tsx`
- Modify: `components/dashboard/sync-trend-chart.tsx`
- Modify: `components/ui/global-control-ball.tsx`
- Modify: `components/tasks/control-command-panel.tsx`
- Modify: `components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: Current page/component text
- Produces: All user-visible text free of forbidden developer terminology

- [ ] **Step 1: Clean sync/page.tsx**

1. Find the user-visible string containing `not_run`: `"无日志时显示 not_run，不推断站点成功。"` (line ~829) — replace with `"无同步日志时显示为未运行状态"` or remove entirely if it's an internal note
2. Replace any remaining `真实` occurrences with user-appropriate language

- [ ] **Step 2: Clean logs/page.tsx**

1. `description: "sync_package_log (按站点包传输审计)"` → `description: "按站点包传输审计"`
2. The user-visible paragraph at line ~442: `"当前可检索 7 类日志: sync_package / sync_table / sync_scheduler / sync_consistency / control / audit / 登录审计"` → replace internal type names with user language: `"当前可检索 7 类日志: 同步包 / 同步表 / 同步调度 / 一致性检查 / 控制命令 / 操作审计 / 登录审计"`

- [ ] **Step 3: Clean tasks/page.tsx**

1. `toast title "演示模式不支持"` → `"当前模式不支持此操作"`
2. Replace `真实` in user-visible strings:
   - "由站点代理拉取后在目标站点创建真实任务" → "由站点代理拉取后在目标站点创建任务"
   - "只有 Agent 回写成功并完成同步后，才算站点真实创建完成" → "只有站点代理回写成功并完成同步后，才算创建完成"
3. Check for any remaining `Site Agent` in user-visible text — replace with `站点代理`

- [ ] **Step 4: Clean components/dashboard/welcome-banner.tsx**

1. `hint="中心库 → 站点 sync_package 链路"` → `hint="中心库同步到站点代理"`

- [ ] **Step 5: Clean components/dashboard/sync-trend-chart.tsx**

1. `"暂无真实趋势数据"` → `"暂无趋势数据"`

- [ ] **Step 6: Clean components/ui/global-control-ball.tsx**

1. `"暂无真实告警"` → `"暂无告警"`

- [ ] **Step 7: Clean components/tasks/control-command-panel.tsx**

1. `"暂停/继续已有站点代理恢复库闭环；其他动作会按站点支持情况展示真实结果"` → `"暂停/继续已有站点代理恢复；其他动作会按站点支持情况展示执行结果"`

- [ ] **Step 8: Clean components/layout/app-shell.tsx**

Replace ALL `真实` in onboarding messages (16+ occurrences from exploration):
1. "这里是总控首页，集中展示同步、任务、告警和控制队列的真实状态" → "...运行状态"
2. "同步告警来自真实日志聚合" → "同步告警来自日志聚合"
3. "这里导出真实设备数据；没有真实数据时不会生成模拟导出" → "这里导出设备数据；暂无数据时不生成导出"
4. "设备总览展示当前站点真实设备、盘位和数据来源口径" → "...当前站点设备、盘位和数据同步状态"
5. "这里做跨维度检索；当前只展示真实接入维度" → "...当前只展示已接入维度"
6. "点击后执行真实检索；检索服务未接入时会显示限制说明" → "点击后执行检索；检索服务未接入时会显示限制说明"
7. "检索结果可导出，导出遵循当前真实查询结果" → "...遵循当前查询结果"
8. "这里导出中心库用户视图，导出结果来自真实数据" → "...来自同步数据"

- [ ] **Step 9: Verify tsc + build**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 10: Run product-copy audit to verify zero findings**

Run: `pnpm audit:product-copy`
Expected: exit 0 (no forbidden terms remaining in app/)

Note: The audit script still only scans `app/` at this point — Task 8 will strengthen it to also scan `components/`. So `components/` findings will be caught after Task 8.

- [ ] **Step 11: Commit**

```bash
git add app/sync/page.tsx app/logs/page.tsx app/tasks/page.tsx components/dashboard/welcome-banner.tsx components/dashboard/sync-trend-chart.tsx components/ui/global-control-ball.tsx components/tasks/control-command-panel.tsx components/layout/app-shell.tsx
git commit -m "fix(r91.1): clean all remaining pages product copy — remove 真实/sync_package/not_run/演示模式"
```

---

### Task 7: Strengthen page-scope + product-copy Audit Scripts

**Files:**
- Modify: `scripts/audit/page-scope.ts`
- Modify: `scripts/audit/product-copy.ts`

**Interfaces:**
- Consumes: Current audit script structure
- Produces: Enhanced audits that catch command palette mismatches, route auto-discovery issues, /check 17-tab pages, and forbidden terms in `components/`

- [ ] **Step 1: Strengthen page-scope.ts**

Rewrite `scripts/audit/page-scope.ts` with these enhancements:

1. **Command palette check**: Parse `components/shared/command-palette.tsx` for `router.push("/...")` patterns or `href: "/..."` patterns. Compare against the PAGES list. Any command palette route that points to a non-primary page (like `/volumes` that should be removed) is a FAIL.

2. **Route auto-discovery**: Walk `app/` directory for all `page.tsx` files. Any route that has a `page.tsx` but is NOT in the PAGES list (neither primary nor reserved) gets a WARN for potential orphan route.

3. **/check 17-tab fail gate**: If `/check/page.tsx` exists AND contains more than 3 `TabsTrigger` or `Tabs` components (indicating it's still a multi-tab raw-table browser, not a redirect), FAIL.

4. **/volumes standalone fail gate**: If `/volumes/page.tsx` exists AND is NOT a simple redirect (contains more than 10 lines or has stat cards/tables), FAIL.

Add these checks as new sections in the `main()` function, after the existing sidebar check.

Keep the existing PAGES array but update it:
- `/check` should now be noted as "redirect to /racks?view=inspection"
- `/volumes` should now be noted as "redirect to /racks?view=volumes"

- [ ] **Step 2: Strengthen product-copy.ts**

Rewrite `scripts/audit/product-copy.ts` with these enhancements:

1. **Scan `components/` directory too**: Add `components` to the walk scope alongside `app/`. Exclude `components/api/` if it exists.

2. **Add ALL forbidden patterns** (currently only 5, need 16+):

```ts
const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [/此处仅做演示/g, "dev wording: 此处仅做演示"],
  [/\b__demo__\b/g, "mock demo value"],
  [/暂未接入真实源端/g, "dev wording: 暂未接入真实源端"],
  [/数据来源:/g, "dev terminology: 数据来源:"],
  [/Site Agent/g, "dev terminology: Site Agent → 站点代理"],
  [/\bdispatcher\b/g, "dev terminology: dispatcher"],
  [/\bsource_restore\b/g, "dev terminology: source_restore"],
  [/\bsync_package\b/g, "dev terminology: sync_package"],
  [/\bnot_run\b/g, "dev terminology: not_run → 未运行"],
  [/blocked_by_\w+/g, "dev terminology: blocked_by_* → use displayStatus mapping"],
  [/\bunified_\w+\b/g, "dev terminology: unified_* table name exposed to user"],
  [/源记录 ID/g, "dev terminology: 源记录 ID → record ID"],
  [/源表/g, "dev terminology: 源表 → source info hidden"],
  [/等待闭环/g, "dev wording: 等待闭环"],
  [/演示模式/g, "dev wording: 演示模式"],
  [/暂无真实/g, "overused qualifier: 暂无真实 → 暂无"],
  [/\b真实\w{0,4}(?:数据|告警|状态|结果|任务|设备|趋势|账号)/g, "overused qualifier: 真实X → X"],
]
```

3. **Remove `break` on first match**: Delete the `break` on line 50 so all patterns are checked per line, not just the first match.

4. **Filter code-only vs user-visible**: Lines that are:
   - Import statements (`import ...`)
   - Variable assignments that are clearly internal (`const SOURCE_TABLES = [...]`)
   - Comments (`// ...` or `{/* ... */}`)
   Should be flagged as WARN (code-level) not FAIL (user-visible). Lines that contain the forbidden term in JSX text, string literals used in labels/descriptions/toasts, or template literals in user-facing messages are FAIL.

Add a heuristic `isUserVisible(line: string): boolean` function similar to `api-mode-no-fallback.ts`'s `isCodeLine()` but inverted — lines containing `<`, `label=`, `description=`, `title=`, `toast({`, `hint=`, string templates with `${` in JSX context are likely user-visible.

- [ ] **Step 3: Verify both audit scripts run**

Run: `pnpm audit:page-scope`
Expected: exit 0 (all checks pass now that /check and /volumes are redirects)

Run: `pnpm audit:product-copy`
Expected: exit 0 (all forbidden terms removed in Tasks 4-6, and components/ scanned)

If product-copy finds remaining issues in components/, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/page-scope.ts scripts/audit/product-copy.ts
git commit -m "fix(r91.1): strengthen page-scope and product-copy audits — command palette, route discovery, 16+ forbidden patterns, components/ scanning"
```

---

### Task 8: Strengthen data-coverage + page-no-todo Audit Scripts

**Files:**
- Modify: `scripts/audit/data-coverage.ts`
- Modify: `scripts/audit/page-no-todo-comments.ts`

**Interfaces:**
- Consumes: Current audit script structure
- Produces: data-coverage with minRows enforcement, emptyAllowed flag, 3-tier verdict; page-no-todo with missing patterns

- [ ] **Step 1: Strengthen data-coverage.ts**

Rewrite `PAGE_REQUIREMENTS` with realistic minRows and emptyAllowed flags:

```ts
const PAGE_REQUIREMENTS: Record<string, {
  endpoint: string
  dbTable: string
  siteColumn: string
  minRows: number       // per-site minimum; 0 = empty allowed for this specific site
  requireAnySite: boolean // at least ONE site must have > 0 rows
  emptyAllowed: boolean  // true = empty is expected (e.g. /search depends on ES)
}> = {
  "/sites":    { endpoint: "/api/sites", dbTable: "sync_sites", siteColumn: "site_code", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/tasks":    { endpoint: "/api/tasks?pageSize=1", dbTable: "unified_tasks", siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/racks":    { endpoint: "/api/racks", dbTable: "unified_devices", siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/volumes":  { endpoint: "/api/volumes", dbTable: "unified_volumes", siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/logs":     { endpoint: "/api/logs?limit=1", dbTable: "sync_package_log", siteColumn: "site_code", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/search":   { endpoint: "/api/search?q=test&limit=1", dbTable: "", siteColumn: "", minRows: 0, requireAnySite: false, emptyAllowed: true },
  "/users":    { endpoint: "/api/users?pageSize=1", dbTable: "unified_users", siteColumn: "source_site_id", minRows: 1, requireAnySite: true, emptyAllowed: false },
  "/sync":     { endpoint: "/api/sync/sites/status", dbTable: "sync_sites", siteColumn: "site_code", minRows: 1, requireAnySite: true, emptyAllowed: false },
}
```

Add 3-tier verdict system in the check function:

```ts
type Verdict = "pass" | "empty_allowed" | "fail"

function check(name: string, verdict: Verdict, detail: string) {
  results.push({ name, passed: verdict !== "fail", detail, verdict })
  if (verdict === "pass") { passed++ }
  else if (verdict === "empty_allowed") { passed++ ; console.log(`  [EMPTY_OK] ${name}: ${detail}`) }
  else { failed++; console.log(`  [FAIL] ${name}: ${detail}`) }
}
```

For DB checks, implement the `requireAnySite` logic:

```ts
// After checking each site individually:
const siteCounts = sites.map(site => {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${req.dbTable} WHERE ${req.siteColumn} = $1`, [site])
    return { site, cnt: r.rows[0]?.cnt ?? 0 }
  } catch { return { site, cnt: -1 } } // -1 = table not found
})

const anySiteHasData = siteCounts.some(s => s.cnt >= req.minRows)
const tableExists = siteCounts.every(s => s.cnt >= 0)

if (req.emptyAllowed) {
  check(`DB ${req.dbTable} for ${page}`, "empty_allowed", `${siteCounts.map(s => `${s.site}:${s.cnt}`).join(", ")}`)
} else if (!tableExists) {
  check(`DB ${req.dbTable} for ${page}`, "fail", `table not found`)
} else if (req.requireAnySite && !anySiteHasData) {
  check(`DB ${req.dbTable} for ${page}`, "fail", `no site has >= ${req.minRows} rows (${siteCounts.map(s => `${s.site}:${s.cnt}`).join(", ")})`)
} else {
  check(`DB ${req.dbTable} for ${page}`, "pass", `${siteCounts.map(s => `${s.site}:${s.cnt}`).join(", ")}`)
}
```

Also add a /check redirect check: verify `/check` endpoint returns a redirect (3xx) or the page content is <= 10 lines (redirect file).

- [ ] **Step 2: Strengthen page-no-todo-comments.ts**

Add missing forbidden patterns to `USER_VISIBLE_PATTERNS`:

```ts
const USER_VISIBLE_PATTERNS: RegExp[] = [
  /待接入/, /待实现/, /未完成/, /占位/, /暂未实现/,
  /等待闭环/,  // NEW
  /mock/,      // NEW — user-visible "mock" references
  /临时/,      // NEW
  /演示模式/,  // NEW
]
```

Also add `.ts` file scanning (currently only `.tsx/.jsx`):

Change the file extension filter to include `.ts`:

```ts
} else if (full.endsWith(".tsx") || full.endsWith(".ts") || full.endsWith(".jsx")) {
  yield full
}
```

But exclude API route files (under `app/api/`) and test files from `.ts` scanning to avoid false positives on internal code.

- [ ] **Step 3: Verify both audit scripts run**

Run: `pnpm audit:data-coverage`
Expected: Some pages may show "empty_allowed" or "fail" if data isn't seeded yet. This is expected — the audit now properly distinguishes real problems from acceptable empty states.

Run: `pnpm audit:page-no-todo`
Expected: exit 0 (all todo/dev wording already cleaned)

- [ ] **Step 4: Commit**

```bash
git add scripts/audit/data-coverage.ts scripts/audit/page-no-todo-comments.ts
git commit -m "fix(r91.1): strengthen data-coverage (minRows, requireAnySite, 3-tier verdict) and page-no-todo (add mock/等待闭环/临时/演示模式, scan .ts)"
```

---

### Task 9: Documentation Updates

**Files:**
- Create: `docs/database-analysis/sprint-r91.1-requirements-review.md`
- Modify: `README.md`
- Modify: `docs/operations/deployment.md`

**Interfaces:**
- Consumes: All changes from Tasks 1-8; current README and deployment doc content
- Produces: Honest requirements review; updated README page list and verification instructions; deployment verification steps

- [ ] **Step 1: Create sprint-r91.1-requirements-review.md**

Create `docs/database-analysis/sprint-r91.1-requirements-review.md` following the strict review template format. Key sections:

**A. Requirement IDs**: R.91.1 covers §4.2 (任务管理), §4.3 (盘笼检查), §5.1 (日志), §3.1-3.3 (账号权限)

**B. Page merge actions**:
- `/check` (17-tab raw-table browser) → redirect to `/racks?view=inspection`
- `/volumes` (standalone 475-line page) → redirect to `/racks?view=volumes`
- Command palette `p-volumes` entry removed
- Sidebar unchanged (already had 9 entries without /check or /volumes)

**C. Product copy cleanup**: List every forbidden term removed and its replacement:
- `字典` → `基础配置` (4 locations)
- `日志与凭据` → `权限日志` (2 locations)
- `数据来源:` + `unified_*` → removed (3 RBAC tabs)
- `源记录 ID` → removed (5 locations)
- `源表` → removed (2 locations)
- `真实` → removed/rephrased (16+ locations)
- `sync_package` → user language (3 locations)
- `not_run` → removed from user-visible text (1 location)
- `演示模式` → `当前模式不支持此操作` (1 location)
- `blocked_by_*` → only in displayStatus keys, not user-visible labels

**D. Data reality**:
- Pages with real backend data (after smoke:sync): /sites, /tasks, /racks, /volumes, /users, /logs, /sync
- Pages with empty-allowed state: /search (depends on OpenSearch)
- Pages with blocked requirements: /tasks control (blocked_by_site_change), /search full capability (blocked_by_external_system)

**E. Audit strengthening**: List all audit script enhancements

**F. Verdict**: `partial` — pages merged and cleaned, but control chain and search still blocked per CLAUDE.md §4

- [ ] **Step 2: Update README.md**

Update README to reflect:
- Page list: 9 primary pages + 2 redirect routes (/check, /volumes) + 1 alias (/control)
- "开发阶段可验收页面" section listing which pages have real data after `pnpm db:init` + `pnpm smoke:sync`
- "从头部署验证步骤" with exact commands to verify each page has data
- Remove any outdated page references to /check as a standalone page or /volumes as standalone

- [ ] **Step 3: Update deployment.md**

Update `docs/operations/deployment.md` to:
- Add a "验证页面数据" section with steps: `pnpm db:init` → `pnpm smoke:sync` → verify each page URL
- Update page route table to show /check and /volumes as redirects
- Remove any references to /check 17-tab page or standalone /volumes page

- [ ] **Step 4: Commit**

```bash
git add docs/database-analysis/sprint-r91.1-requirements-review.md README.md docs/operations/deployment.md
git commit -m "docs(r91.1): requirements review, README page list, deployment verification steps"
```

---

### Task 10: Run All Gates + Final Commit

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All changes from Tasks 1-9
- Produces: Verified commit-ready state; all audit gates pass

- [ ] **Step 1: Run tsc + build**

```bash
pnpm exec tsc --noEmit
pnpm build
```

Expected: 0 errors, build success

- [ ] **Step 2: Run smoke + baseline**

```bash
pnpm smoke:sync
pnpm baseline:check
```

Expected: all pass

- [ ] **Step 3: Run all audit gates**

```bash
pnpm audit:page-scope
pnpm audit:product-copy
pnpm audit:data-coverage
pnpm audit:page-no-todo
pnpm audit:api-mode-no-fallback
pnpm audit:center-db -- --strict --matrix
```

Expected: all exit 0

- [ ] **Step 4: Run e2e tests**

```bash
pnpm e2e:racks
pnpm e2e:users
pnpm e2e:volumes
pnpm e2e:sync
pnpm e2e:route-page-integration
```

Expected: all pass

Note: `pnpm e2e:volumes` may need updating since /volumes now redirects. Check if the e2e test expects a standalone volumes page. If so, update it to verify the redirect works.

- [ ] **Step 5: Check whitespace**

```bash
git diff --check origin/main...HEAD
```

Expected: no whitespace errors

- [ ] **Step 6: Push**

```bash
git push origin codex/r84-development-architecture-cleanup-plans
```

Expected: push succeeds

---

## Self-Review Checklist

1. **Spec coverage**: Each requirement from the goal is covered:
   - ✅ Page merges: Task 1 (redirects), Task 2 (inspection), Task 3 (volumes)
   - ✅ Command palette cleanup: Task 1 Step 3
   - ✅ RBAC rename: Task 4 (字典→基础配置, 日志与凭据→权限日志)
   - ✅ All forbidden terms removed: Tasks 4-6
   - ✅ Audit strengthening: Tasks 7-8
   - ✅ Docs: Task 9
   - ✅ Gates: Task 10

2. **Placeholder scan**: No TBD, TODO, "implement later", or vague steps. All steps have exact code or exact instructions.

3. **Type consistency**: InspectionView and VolumesView are imported in /racks/page.tsx with consistent names. displayStatus mapping keys stay as `blocked_by_*` enum values but are never shown raw to users.

4. **Gap check**: One potential gap — `/racks` page needs `router` for the "← 返回盘架管理" button. The page already uses `useRouter()` from next/navigation, so this is consistent.
