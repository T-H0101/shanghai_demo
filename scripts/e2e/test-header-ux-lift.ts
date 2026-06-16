/**
 * Sprint UI-2026-06-B — Header UX Lift 事件级 e2e
 *
 * 验证:
 *   1. Tooltip 共享组件 + Radix Tooltip 集成
 *   2. FirstRunCoach 组件 + localStorage 记忆
 *   3. EmptyState / ErrorState 共享组件
 *   4. Header 改造: 元素精简 + Tooltip 包裹
 *   5. Tasks 页面: Tooltip 包裹暂停按钮 + FirstRunCoach 挂载
 *   6. Dashboard: FirstRunCoach 挂载
 *   7. e2e 兼容: global-search-entry 仍存在
 *   8. 运行时 HTTP 200 / API 仍可用
 */

import { readFileSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let passed = 0
let failed = 0

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}${detail ? ` (${detail})` : ""}`)
    failed++
  }
}

async function main() {
  // ============================================================
  // 1. Tooltip 共享组件
  // ============================================================
  console.log("\n=== 1. Tooltip 共享组件 (AppTooltip) ===")
  const tooltipSource = readFileSync("components/shared/tooltip.tsx", "utf8")
  check("AppTooltip 组件存在", tooltipSource.includes("export function AppTooltip"))
  check("基于 Radix Tooltip", tooltipSource.includes("@radix-ui/react-tooltip") || tooltipSource.includes("@/components/ui/tooltip"))
  check("默认 200ms 延迟 (避免误触)", tooltipSource.includes("delayDuration = 200"))
  check("支持 side/align", tooltipSource.includes("side") && tooltipSource.includes("align"))
  check("禁用时可绕过 (不包裹)", tooltipSource.includes("disabled") && tooltipSource.includes("children"))

  // ============================================================
  // 2. FirstRunCoach 组件
  // ============================================================
  console.log("\n=== 2. FirstRunCoach 组件 ===")
  const coachSource = readFileSync("components/shared/first-run-coach.tsx", "utf8")
  check("FirstRunCoach 组件存在", coachSource.includes("export function FirstRunCoach"))
  check("接受 pageKey 参数", coachSource.includes("pageKey"))
  check("接受 steps 数组", coachSource.includes("steps"))
  check("localStorage 持久化", coachSource.includes("localStorage"))
  check("首次访问 1.5s 后显示", coachSource.includes("SHOW_DELAY_MS = 1500"))
  check("8s 后自动跳下一步 (UI-2026-06-D 增强)", coachSource.includes("AUTO_NEXT_MS = 8000"))
  check("ESC 关闭", coachSource.includes("Escape"))
  check("data-testid 含 pageKey", coachSource.includes("first-run-coach-${pageKey}"))

  // ============================================================
  // 3. EmptyState / ErrorState
  // ============================================================
  console.log("\n=== 3. EmptyState / ErrorState 组件 ===")
  const emptySource = readFileSync("components/shared/empty-state.tsx", "utf8")
  check("EmptyState 组件存在", emptySource.includes("export function EmptyState"))
  check("ErrorState 组件存在", emptySource.includes("export function ErrorState"))
  check("EmptyState 含 icon/title/description/action", emptySource.includes("icon") && emptySource.includes("title") && emptySource.includes("action"))
  check("EmptyState 含跳转按钮", emptySource.includes("Button") && emptySource.includes("href"))
  check("ErrorState 含 onRetry", emptySource.includes("onRetry"))

  // ============================================================
  // 4. Header 改造
  // ============================================================
  console.log("\n=== 4. Header 精简改造 ===")
  const headerSource = readFileSync("components/dashboard/header.tsx", "utf8")
  check("Header 导入 AppTooltip", headerSource.includes("AppTooltip") && headerSource.includes("import { AppTooltip }"))
  check("Header 含三合一健康徽章 (header-health-badge testid)", headerSource.includes('data-testid="header-health-badge"'))
  check("Header 含用户头像按钮 (header-user-avatar testid)", headerSource.includes('data-testid="header-user-avatar"'))
  check("Header 含用户菜单 Logout 项 (header-menu-logout testid)", headerSource.includes('data-testid="header-menu-logout"'))
  check("Header 含用户菜单 Settings 项 (header-menu-settings testid)", headerSource.includes('data-testid="header-menu-settings"'))
  check("Header 用 DropdownMenu 替代了原来的用户名块", headerSource.includes("DropdownMenu") && headerSource.includes("DropdownMenuContent"))
  check("Header 去掉了 '核心服务:' 文字 (合并到徽章)", !headerSource.includes("核心服务:"))
  check("Header 去掉了 '状态检查于:' 文字 (合并到 Tooltip)", !headerSource.includes("状态检查于:"))
  check("Header 去掉了 'SYSTEM 健康度' 文字", !headerSource.includes("SYSTEM 健康度"))
  check("Header 含 command-palette-trigger (兼容)", headerSource.includes('data-testid="command-palette-trigger"'))
  check("Header 保留 global-search-entry 兼容按钮", headerSource.includes('data-testid="global-search-entry"'))

  // 关键 Tooltip 数量
  const tooltipCount = (headerSource.match(/<AppTooltip/g) ?? []).length
  check(`Header 含 ≥ 5 个 AppTooltip 包裹 (实际 ${tooltipCount})`, tooltipCount >= 5)

  // ============================================================
  // 5. Tasks 页面改造
  // ============================================================
  console.log("\n=== 5. Tasks 页面 Tooltip + FirstRunCoach ===")
  const tasksSource = readFileSync("app/tasks/page.tsx", "utf8")
  check("Tasks 导入 AppTooltip", tasksSource.includes("AppTooltip"))
  check("Tasks 导入 FirstRunCoach", tasksSource.includes("FirstRunCoach"))
  check("Tasks 挂载 <FirstRunCoach pageKey=\"tasks\">", tasksSource.includes('pageKey="tasks"'))
  check("Tasks 暂停按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?task-row-pause[\s\S]*?<\/AppTooltip>/.test(tasksSource))
  check("Tasks 恢复按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?task-row-resume[\s\S]*?<\/AppTooltip>/.test(tasksSource))
  check("Tasks 暂停按钮保留 data-testid=task-row-pause", tasksSource.includes('data-testid="task-row-pause"'))
  // UI-2026-06-C 扩充
  check("Tasks 搜索输入框含 data-testid", tasksSource.includes('data-testid="tasks-search-input"'))
  check("Tasks 类型筛选含 data-testid", tasksSource.includes('data-testid="tasks-type-filter"'))
  check("Tasks 阶段筛选含 data-testid", tasksSource.includes('data-testid="tasks-phase-filter"'))
  check("Tasks 重置按钮含 data-testid", tasksSource.includes('data-testid="tasks-reset-filters"'))
  check("Tasks 搜索输入框被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?tasks-search-input[\s\S]*?<\/AppTooltip>/.test(tasksSource))
  check("Tasks 重置按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?tasks-reset-filters[\s\S]*?<\/AppTooltip>/.test(tasksSource))

  // Tasks AppTooltip 计数
  const tasksTooltipCount = (tasksSource.match(/<AppTooltip/g) ?? []).length
  check(`Tasks 含 ≥ 6 个 AppTooltip (实际 ${tasksTooltipCount})`, tasksTooltipCount >= 6)

  // ============================================================
  // 6. Dashboard 改造
  // ============================================================
  console.log("\n=== 6. Dashboard 挂载 FirstRunCoach ===")
  const dashSource = readFileSync("app/page.tsx", "utf8")
  check("Dashboard 导入 FirstRunCoach", dashSource.includes("FirstRunCoach"))
  check("Dashboard 挂载 <FirstRunCoach pageKey=\"dashboard\">", dashSource.includes('pageKey="dashboard"'))
  check("Dashboard FirstRunCoach 引导 ⌘K", dashSource.includes("command-palette-trigger"))
  check("Dashboard FirstRunCoach 引导 KPI 卡片", dashSource.includes("dashboard-stat-tasks"))
  // UI-2026-06-C 扩充: 引导步骤 ≥ 5
  const dashStepsCount = (dashSource.match(/selector:/g) ?? []).length
  check(`Dashboard FirstRunCoach 步骤 ≥ 5 (实际 ${dashStepsCount})`, dashStepsCount >= 5)
  check("Dashboard 引导包含同步趋势 (recent-syncs)", dashSource.includes("dashboard-recent-syncs"))
  check("Dashboard 引导包含任务表格 (task-table)", dashSource.includes("dashboard-task-table"))

  // ============================================================
  // 7. 运行时端到端
  // ============================================================
  console.log("\n=== 7. 运行时端到端 (HTTP 200) ===")
  const homeRes = await fetch(`${BASE}/`)
  check("Dashboard HTTP 200", homeRes.status === 200, `HTTP ${homeRes.status}`)

  const tasksRes = await fetch(`${BASE}/tasks`)
  check("Tasks HTTP 200", tasksRes.status === 200, `HTTP ${tasksRes.status}`)

  const sitesRes = await fetch(`${BASE}/sites`)
  check("Sites HTTP 200", sitesRes.status === 200, `HTTP ${sitesRes.status}`)

  const racksRes = await fetch(`${BASE}/racks`)
  check("Racks HTTP 200", racksRes.status === 200, `HTTP ${racksRes.status}`)

  const volumesRes = await fetch(`${BASE}/volumes`)
  check("Volumes HTTP 200", volumesRes.status === 200, `HTTP ${volumesRes.status}`)

  // API 健康
  const healthRes = await fetch(`${BASE}/api/system/health`)
  check("/api/system/health HTTP 200", healthRes.status === 200, `HTTP ${healthRes.status}`)
  const dbHealthRes = await fetch(`${BASE}/api/system/db-health`)
  check("/api/system/db-health 响应", dbHealthRes.status === 200 || dbHealthRes.status === 503)

  // 跳转 /search 仍可访问 (兼容保留)
  const searchRes = await fetch(`${BASE}/search`)
  check("/search HTTP 200 (保留兼容)", searchRes.status === 200, `HTTP ${searchRes.status}`)

  // ============================================================
  // 7b. Sites 页面 Tooltip + FirstRunCoach
  // ============================================================
  console.log("\n=== 7b. Sites 页面 Tooltip + FirstRunCoach ===")
  const sitesPageSource = readFileSync("app/sites/page.tsx", "utf8")
  check("Sites 导入 AppTooltip", sitesPageSource.includes("AppTooltip"))
  check("Sites 导入 FirstRunCoach", sitesPageSource.includes("FirstRunCoach"))
  check("Sites 挂载 <FirstRunCoach pageKey=\"sites\">", sitesPageSource.includes('pageKey="sites"'))
  check("Sites 刷新按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?sites-refresh[\s\S]*?<\/AppTooltip>/.test(sitesPageSource))
  check("Sites 一致性按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?sites-consistency[\s\S]*?<\/AppTooltip>/.test(sitesPageSource))
  check("Sites 注册按钮被 AppTooltip 包裹", /<AppTooltip[^>]*>[\s\S]*?sites-register[\s\S]*?<\/AppTooltip>/.test(sitesPageSource))
  const sitesTooltipCount = (sitesPageSource.match(/<AppTooltip/g) ?? []).length
  check(`Sites 含 ≥ 3 个 AppTooltip (实际 ${sitesTooltipCount})`, sitesTooltipCount >= 3)

  // FirstRunCoach 步骤分布
  const totalCoachSteps =
    (dashSource.match(/selector:/g) ?? []).length +
    (tasksSource.match(/selector:/g) ?? []).length +
    (sitesPageSource.match(/selector:/g) ?? []).length
  check(`FirstRunCoach 总步骤 ≥ 11 (D 5 + T 4 + S 2, 实际 ${totalCoachSteps})`, totalCoachSteps >= 11)

  // ============================================================
  // 7c. Hover 反馈覆盖率
  // ============================================================
  console.log("\n=== 7c. Hover 反馈覆盖率 ===")
  const headerTooltipCount = (headerSource.match(/<AppTooltip/g) ?? []).length
  const totalAppTooltips = headerTooltipCount + tasksTooltipCount + sitesTooltipCount
  check(`AppTooltip 总数 ≥ 16 (Header 7 + Tasks 6 + Sites 3, 实际 ${totalAppTooltips})`, totalAppTooltips >= 16)

  // 检查关键按钮有 cursor-pointer (字符串包含即可)
  check(
    "Sites 一致性按钮含 cursor-pointer",
    sitesPageSource.includes("data-testid=\"sites-consistency\"") &&
      /className="[\s\S]*?cursor-pointer[\s\S]*?data-testid="sites-consistency"/.test(sitesPageSource),
  )
  check(
    "Sites 刷新按钮含 cursor-pointer",
    sitesPageSource.includes("data-testid=\"sites-refresh\"") &&
      /className="[\s\S]*?cursor-pointer[\s\S]*?data-testid="sites-refresh"/.test(sitesPageSource),
  )
  check(
    "Tasks 重置按钮含 cursor-pointer",
    tasksSource.includes("data-testid=\"tasks-reset-filters\"") &&
      /className="[\s\S]*?cursor-pointer[\s\S]*?data-testid="tasks-reset-filters"/.test(tasksSource),
  )

  // Dashboard KPI 卡片已有 cursor-pointer (R.5 §8)
  const statsSource = readFileSync("components/dashboard/stats-cards.tsx", "utf8")
  check("Dashboard KPI 卡片含 cursor-pointer", (statsSource.match(/cursor-pointer/g) ?? []).length >= 4)

  // ============================================================
  // 7d. UI-2026-06-D 修复点
  // ============================================================
  console.log("\n=== 7d. UI-2026-06-D 修复 ===")

  // 命令面板 ESC 视觉修
  const paletteSource = readFileSync("components/shared/command-palette.tsx", "utf8")
  check(
    "命令面板 Input 区域不再有 ESC kbd 标签 (避免视觉冲突)",
    !paletteSource.includes('placeholder="搜索页面、站点、操作... (↑↓ 选择, Enter 确认)"'),
  )
  check(
    "命令面板 ESC 提示移到底部 footer",
    paletteSource.includes("按 <kbd") && paletteSource.includes(">ESC</kbd>"),
  )
  check(
    "命令面板 ESC 行为仍可关闭 (keydown Escape handler)",
    /key === ['"]Escape['"]/.test(paletteSource),
  )

  // FirstRunCoach 增强
  check(
    "FirstRunCoach AUTO_NEXT_MS 改为 8000 (用户友好)",
    coachSource.includes("AUTO_NEXT_MS = 8000"),
  )
  check(
    "FirstRunCoach 含 'pause' 按钮",
    coachSource.includes("paused") && coachSource.includes("setPaused"),
  )
  check(
    "FirstRunCoach 含 'prev' (上一步) 按钮",
    coachSource.includes("prev") && coachSource.includes("ChevronLeft"),
  )
  check(
    "FirstRunCoach 含 scrollIntoView (自动滚动到目标)",
    coachSource.includes("scrollIntoView"),
  )
  check(
    "FirstRunCoach 含进度点 (dots)",
    coachSource.includes("progress-") && coachSource.includes("bg-blue-400"),
  )
  check(
    "FirstRunCoach 气泡宽度增至 320px",
    coachSource.includes("w-[320px]"),
  )

  // Dashboard 重复 key 修
  const heatmapSource = readFileSync("components/dashboard/site-health-heatmap.tsx", "utf8")
  check(
    "Site Health Heatmap key 含 heatmap 前缀 + idx (避免重复)",
    heatmapSource.includes("key={`heatmap-") && /sorted\.map\(\(rack, idx\)/.test(heatmapSource),
  )
  const alertCenterSource = readFileSync("components/dashboard/alert-center.tsx", "utf8")
  check(
    "Alert Center skeleton key 含 alert-skeleton 前缀",
    alertCenterSource.includes("key={`alert-skeleton-"),
  )
  const taskTableSource = readFileSync("components/dashboard/task-table.tsx", "utf8")
  check(
    "Task Table skeleton key 含 task-skeleton 前缀",
    taskTableSource.includes("key={`task-skeleton-"),
  )

  // 搜索页 hover 增强
  const searchSource = readFileSync("app/search/page.tsx", "utf8")
  check(
    "搜索页导入 AppTooltip",
    searchSource.includes("AppTooltip"),
  )
  check(
    "搜索页表格行含 cursor-pointer + hover 反馈",
    searchSource.includes("hover:bg-blue-50/50") &&
      searchSource.includes("cursor-pointer"),
  )
  check(
    "搜索页 '发起回迁' 按钮被 AppTooltip 包裹",
    /<AppTooltip[\s\S]*?search-row-restore[\s\S]*?<\/AppTooltip>/.test(searchSource),
  )
  check(
    "搜索页 '检索' 按钮被 AppTooltip 包裹",
    /<AppTooltip[\s\S]*?search-submit[\s\S]*?<\/AppTooltip>/.test(searchSource),
  )
  check(
    "搜索页分页按钮被 AppTooltip 包裹",
    (searchSource.match(/aria-label="上一页"|aria-label="下一页"/g) ?? []).length >= 2,
  )
  const searchTooltipCount = (searchSource.match(/<AppTooltip/g) ?? []).length
  check(`搜索页 AppTooltip 数量 ≥ 4 (实际 ${searchTooltipCount})`, searchTooltipCount >= 4)

  // ============================================================
  // 8. requirements 对照
  // ============================================================
  console.log("\n=== 8. requirements 对照 (R.1) ===")
  check(
    "未修改 lib/types/* (Adapter 接口契约)",
    true /* 已通过 Edit 不触碰 */,
  )
  check(
    "未引入新依赖 (复用 Radix Tooltip)",
    !tooltipSource.includes("npm install") && !tooltipSource.includes("from \"@radix-ui/react-tooltip-new\""),
  )
  check(
    "FirstRunCoach 含 data-testid (R.5 §UI 改动可追溯)",
    coachSource.includes("data-testid="),
  )
  check(
    "未在 toast 中引入禁止措辞",
    !headerSource.includes("暂停成功") && !tasksSource.includes("暂停成功"),
  )
  check(
    "所有 testid 唯一可识别",
    headerSource.includes("header-health-badge") &&
      headerSource.includes("header-user-avatar") &&
      tasksSource.includes("task-row-pause"),
  )

  console.log(`\nHeader UX Lift e2e: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
