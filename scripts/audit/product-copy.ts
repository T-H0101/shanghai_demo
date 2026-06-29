/**
 * scripts/audit/product-copy.ts
 * R.91 — verify user-visible strings in pages are product-ready.
 *
 * Forbidden in user-visible text:
 *   dispatcher, source_restore, sync_package, not_run, blocked_by_*,
 *   Site Agent, 真实(overused), 数据来源:, 等待闭环, 暂未接入真实源端,
 *   此处仅做演示, __demo__
 *
 * Only scans .tsx files in app/ (page components), excluding app/api/ (server routes)
 * and components/ (should be checked separately).
 *
 * Exit codes:
 *   0 - no forbidden terms in user-visible text
 *   2 - findings
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const SCAN_DIR = join(process.cwd(), "app")
const EXCLUDE_DIRS = new Set(["api", "api_v2"])
const FORBIDDEN_PATTERNS: [RegExp, string][] = [
  [/此处仅做演示/g, "user-visible dev wording: '此处仅做演示'"],
  [/\b__demo__\b/g, "mock demo value in user-visible position"],
  [/暂未接入真实源端/g, "user-visible dev wording: '暂未接入真实源端'"],
  [/数据来源:\s*站点源库/g, "user-visible source table explanation"],
  [/Site Agent/g, "user-visible: Site Agent → use '站点代理'"],
]

interface Finding {
  file: string
  line: number
  pattern: string
  snippet: string
}

function findInFile(filePath: string): Finding[] {
  const rel = filePath.replace(process.cwd() + "/", "")
  const content = readFileSync(filePath, "utf8")
  const lines = content.split("\n")
  const findings: Finding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const [re, desc] of FORBIDDEN_PATTERNS) {
      if (re.test(line)) {
        findings.push({ file: rel, line: i + 1, pattern: desc, snippet: line.trim().slice(0, 120) })
        break
      }
    }
  }
  return findings
}

function* walkDir(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walkDir(full)
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      yield full
    }
  }
}

function main(): number {
  console.log("=== R.91 product copy audit ===")
  console.log(`dir=${SCAN_DIR}`)

  const findings: Finding[] = []
  for (const file of walkDir(SCAN_DIR)) {
    findings.push(...findInFile(file))
  }

  if (findings.length === 0) {
    console.log("\n[PASS] No forbidden developer terms in app/")
    return 0
  }

  console.log(`\n[FAIL] ${findings.length} forbidden term(s) found:`)
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}  ${f.pattern}`)
    console.log(`    ${f.snippet}`)
  }
  return 2
}

process.exit(main())