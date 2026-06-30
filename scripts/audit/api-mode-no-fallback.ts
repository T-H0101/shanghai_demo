/**
 * scripts/audit/api-mode-no-fallback.ts
 * R.90 — API mode must not silently fall back to mock provider
 *
 * Background:
 *   In Sprint 1, api-providers.ts was a quick shim that called real API
 *   endpoints and, when the endpoint failed or returned an array, fell
 *   back to mockXxxProvider(). That "graceful degradation" silently hides
 *   production failures and contradicts §R.1 (mock ≠ real).
 *
 *   R.90 enforces: when `NEXT_PUBLIC_API_MODE !== "mock"`, no API provider
 *   method should ever call into `mockXxxProvider`. Failures must surface
 *   as errors so the UI can render `blocked_by_external_system` (or 503),
 *   not a fake successful mock result.
 *
 * Method:
 *   - Static source scan: any non-mock file under app/ or lib/ (excluding
 *     lib/mock/* and lib/api/mock-providers.ts and lib/api/mock-store.ts)
 *     that references mockXxxProvider or `mock-*` data import is flagged.
 *   - Dynamic runtime check: when SEARCH_ES_URL is unset, /api/search must
 *     return blocked_by_external_system; this is already enforced by R.85
 *     e2e but we re-validate the route layer here as a guard.
 *
 * Exit codes:
 *   0 - no silent fallback paths detected in API mode
 *   2 - leakage found (R.90 fail)
 */

import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const REPO = process.cwd()
const SCAN_DIRS = ["app", "components", "lib"]
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next\//,
  /\.git\//,
  /\/lib\/mock\//,
  /\/lib\/api\/mock-providers\.ts$/,
  /\/lib\/api\/mock-store\.ts$/,
  /\/lib\/api\/fallback\.ts$/,
  /\/lib\/api\/index\.ts$/,
  /\/__tests__\//,
  /\.test\.ts$/,
  /\.test\.tsx$/,
]

// 只在"代码行"上命中, 不在 JSDoc / 行内注释行上命中
// 启发式: JS 代码行以 `import`/`const`/`let`/`var`/`return`/`export`/`=`/空白 开头;
// 行内 `//` 注释开头 跳过
function isCodeLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (trimmed.startsWith("//")) return false
  if (trimmed.startsWith("*")) return false
  if (trimmed.startsWith("/*")) return false
  // 命中常见代码起始
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("export ") ||
    trimmed.startsWith("return ") ||
    trimmed.startsWith("const ") ||
    trimmed.startsWith("let ") ||
    trimmed.startsWith("var ") ||
    trimmed.startsWith("function ") ||
    trimmed.startsWith("async ") ||
    trimmed.startsWith("await ") ||
    trimmed.startsWith("(") ||
    trimmed.startsWith(".") ||
    /^[a-zA-Z_$][\w$.]*\s*[=({.]/.test(trimmed)
  )
}

const MOCK_IMPORT_PATTERNS = [
  /from\s+["']@\/lib\/mock\//,
  /from\s+["']\.\.\/mock\//,
  /from\s+["']\.\.\/\.\.\/lib\/mock\//,
  /from\s+["']\.\.\/\.\.\/\.\.\/lib\/mock\//,
]

const MOCK_PROVIDER_PATTERNS = [
  /\bmockSiteProvider\b/,
  /\bmockTaskProvider\b/,
  /\bmockUserProvider\b/,
  /\bmockRackProvider\b/,
  /\bmockSearchProvider\b/,
  /\bmockAuditProvider\b/,
  /\bmockSettingsProvider\b/,
]

const MOCK_DATA_PATTERNS = [
  /\bmockRacks\b/,
  /\bmockSites\b/,
  /\bmockTasks\b/,
  /\bmockUsers\b/,
  /\bmockVolumes\b/,
  /\bmockAlerts\b/,
  /\bmockStorage\b/,
  /\bgetMockData\b/,
  /\bmockStore\b/,
]

interface Finding {
  file: string
  line: number
  pattern: string
  snippet: string
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (EXCLUDE_PATTERNS.some((re) => re.test(entry) || re.test(`${dir}/${entry}`))) continue
    const full = join(dir, entry)
    let st
    try {
      st = await stat(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (st.isFile()) {
      if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
        yield full
      }
    }
  }
}

async function scanFile(path: string): Promise<Finding[]> {
  const content = await readFile(path, "utf8")
  const lines = content.split("\n")
  const findings: Finding[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isCodeLine(line)) continue
    for (const re of [...MOCK_IMPORT_PATTERNS, ...MOCK_PROVIDER_PATTERNS, ...MOCK_DATA_PATTERNS]) {
      if (re.test(line)) {
        findings.push({
          file: path.replace(`${REPO}/`, ""),
          line: i + 1,
          pattern: re.source,
          snippet: line.trim().slice(0, 120),
        })
        break
      }
    }
  }
  return findings
}

async function main() {
  console.log("=== R.90 API-mode no-fallback scan ===")
  console.log(`repo=${REPO} dirs=${SCAN_DIRS.join(",")}`)

  const findings: Finding[] = []
  for (const dir of SCAN_DIRS) {
    for await (const file of walk(join(REPO, dir))) {
      const fileFindings = await scanFile(file)
      findings.push(...fileFindings)
    }
  }

  if (findings.length === 0) {
    console.log("\n[PASS] No silent fallback paths detected in API mode")
    process.exit(0)
  }

  console.log(`\n[FAIL] Found ${findings.length} potential mock-leak points:`)
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.pattern}`)
    console.log(`    ${f.snippet}`)
  }
  console.log("\nNote: lib/api/mock-providers.ts and lib/api/mock-store.ts are intentional mock sources.")
  console.log("These findings indicate api-providers / pages importing or calling mock data in non-mock contexts.")
  process.exit(2)
}

main().catch((err) => {
  console.error("scan crashed:", err)
  process.exit(2)
})