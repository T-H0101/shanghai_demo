import { readFile } from "node:fs/promises"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++
    console.log(`  PASS ${name}${detail ? `: ${detail}` : ""}`)
    return
  }
  failed++
  console.error(`  FAIL ${name}${detail ? `: ${detail}` : ""}`)
}

async function main() {
  // ============================================================
  // R.71: silent mock fallback removal
  // ============================================================
  const fallbackSrc = await readFile("lib/api/fallback.ts", "utf8")
  check(
    "fallback helper no longer silently warns 'using mock'",
    !fallbackSrc.includes("using mock")
  )
  check(
    "fallback helper exports ApiUnavailableError",
    fallbackSrc.includes("class ApiUnavailableError")
  )

  const indexSrc = await readFile("lib/api/index.ts", "utf8")
  check(
    "search provider is not always mock",
    !indexSrc.includes("searchProvider: SearchProvider = mockSearchProvider")
  )
  check(
    "settings provider is not always mock",
    !indexSrc.includes("settingsProvider: SettingsProvider = mockSettingsProvider")
  )
  check(
    "audit provider is not always mock",
    !indexSrc.includes("auditProvider: AuditProvider = mockAuditProvider")
  )
  const redirect = await fetch(`${BASE}/control`, { redirect: "manual" })
  check(
    "legacy control route redirects",
    [307, 308].includes(redirect.status),
    `HTTP ${redirect.status}`
  )
  check(
    "legacy control route targets task command view",
    redirect.headers.get("location")?.endsWith("/tasks?view=commands") === true,
    redirect.headers.get("location") ?? "missing location"
  )

  const tasksResponse = await fetch(`${BASE}/tasks?view=commands`)
  check(
    "task command view is reachable",
    tasksResponse.status === 200,
    `HTTP ${tasksResponse.status}`
  )

  const [sidebar, header, tasks, panel] = await Promise.all([
    readFile("components/dashboard/sidebar.tsx", "utf8"),
    readFile("components/dashboard/header.tsx", "utf8"),
    readFile("app/tasks/page.tsx", "utf8"),
    readFile("components/tasks/control-command-panel.tsx", "utf8"),
  ])

  check(
    "sidebar removes duplicate control entry",
    !sidebar.includes('href: "/control"')
  )
  check(
    "tasks expose task and command views",
    tasks.includes('data-testid="task-view-tasks"') &&
      tasks.includes('data-testid="task-view-commands"')
  )
  check(
    "task center renders real control command panel",
    tasks.includes("<ControlCommandPanel") &&
      panel.includes("/api/control/commands")
  )
  check(
    "command view is URL-addressable",
    tasks.includes('searchParams.get("view")') &&
      tasks.includes('view === "commands"')
  )
  check(
    "header search entry has real navigation",
    header.includes('data-testid="global-search-entry"') &&
      header.includes('router.push("/search")')
  )
  check(
    "header no longer exposes inert search input",
    !header.includes('placeholder="搜索任务、站点或日志..."')
  )

  // ============================================================
  // R.76: command palette /tasks?status= → /tasks?phase= contract
  // ============================================================
  const paletteSource = await readFile("components/shared/command-palette.tsx", "utf8")
  const tasksSource = await readFile("app/tasks/page.tsx", "utf8")

  check(
    "command palette task shortcuts use page-consumed phase query",
    !paletteSource.includes("/tasks?status=") &&
      paletteSource.includes("/tasks?phase=failed") &&
      paletteSource.includes("/tasks?phase=running")
  )
  check(
    "tasks page consumes phase query",
    tasksSource.includes('searchParams.get("phase")') &&
      tasksSource.includes("setPhaseFilter(initialPhase)")
  )

  console.log(`\nFrontend integration: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
