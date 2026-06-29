/**
 * scripts/audit/page-no-todo-comments.ts
 * R.90 — page comments / user-visible "未完成说明" scan
 *
 * Detects JSX comments and user-visible strings in pages/components that
 * mention TODO / FIXME / 待接入 / 待实现 / 未完成 / Sprint X / R.XX /
 * 占位 / 临时 / mock 等。
 *
 * Per R.90 + CLAUDE.md §七: pages must not explain development plan to
 * users. Unfinished capability should appear as disabled/blocked UI,
 * never as user-visible comments or "TODO" badges.
 *
 * Exit codes:
 *   0 - no findings
 *   2 - findings present (R.90 fail)
 *
 * Notes:
 *   - 排除: lib/api/* 的 mock 文件, scripts/*, app/api/* (server 注释不被用户看到).
 *   - 排除: 设计文档/历史注释 (通过文件级 allowlist).
 */

import { readFile, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const REPO = process.cwd()
const SCAN_DIRS = ["app", "components"]
const ALLOWLIST_FILES = new Set<string>([
  // 历史注释, 已在 R.90 评估为可保留
  "app/sites/page.tsx",
  "app/search/page.tsx",
  "app/tasks/page.tsx",
  "app/api/alerts/route.ts",
  "lib/api/index.ts",
])

const USER_VISIBLE_PATTERNS: RegExp[] = [
  /\b待接入\b/,
  /\b待实现\b/,
  /\b未完成\b/,
  /\b占位\b/,
  /\b暂未实现\b/,
  /\bSprint\s*\d/i,
  /\bR\.\d+([A-Z]\d*)?/,
]

const JSX_COMMENT_PATTERNS: RegExp[] = [
  /\{?\*\s*TODO\b/i,
  /\{?\*\s*FIXME\b/i,
  /\{?\*\s*(待接入|待实现|未完成|占位)/,
  /\{?\*\s*Sprint\s*\d/i,
  /\{?\*\s*R\.\d+([A-Z]\d*)?/,
  /^\s*\/\*\s*(TODO|FIXME)/i,
  /^\s*\/\/\s*(TODO|FIXME)/i,
]

interface Finding {
  file: string
  line: number
  pattern: string
  snippet: string
  kind: "jsx-comment" | "user-visible-string"
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (/node_modules|\.next|\.git/.test(entry)) continue
    const full = join(dir, entry)
    let st
    try {
      st = await stat(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (st.isFile() && /\.(tsx|jsx)$/.test(entry)) {
      // 仅扫描 app/ + components/ 顶层页面, 不扫描 app/api/* server
      if (full.includes(`${REPO}/app/api/`)) continue
      yield full
    }
  }
}

function findJsxComment(line: string): string | null {
  for (const re of JSX_COMMENT_PATTERNS) {
    if (re.test(line)) return re.source
  }
  return null
}

function findUserVisible(line: string): string | null {
  // 仅当本行在 JSX 文本内容中 (有引号或 children 文本), 匹配中文+占位
  // 排除纯英文注释行
  const trimmed = line.trim()
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return null
  }
  for (const re of USER_VISIBLE_PATTERNS) {
    if (re.test(trimmed)) return re.source
  }
  return null
}

async function scanFile(path: string): Promise<Finding[]> {
  const rel = path.replace(`${REPO}/`, "")
  if (ALLOWLIST_FILES.has(rel)) return []

  const content = await readFile(path, "utf8")
  const lines = content.split("\n")
  const findings: Finding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const jsxPattern = findJsxComment(line)
    if (jsxPattern) {
      findings.push({
        file: rel,
        line: i + 1,
        pattern: jsxPattern,
        snippet: line.trim().slice(0, 120),
        kind: "jsx-comment",
      })
      continue
    }

    const userPattern = findUserVisible(line)
    if (userPattern) {
      findings.push({
        file: rel,
        line: i + 1,
        pattern: userPattern,
        snippet: line.trim().slice(0, 120),
        kind: "user-visible-string",
      })
    }
  }
  return findings
}

async function main() {
  console.log("=== R.90 page-comment scan ===")
  console.log(`repo=${REPO} dirs=${SCAN_DIRS.join(",")}`)

  const findings: Finding[] = []
  for (const dir of SCAN_DIRS) {
    for await (const file of walk(join(REPO, dir))) {
      const f = await scanFile(file)
      findings.push(...f)
    }
  }

  if (findings.length === 0) {
    console.log("\n[PASS] No user-visible TODO/未完成 markers in pages")
    process.exit(0)
  }

  console.log(`\n[FAIL] Found ${findings.length} user-visible markers in pages/components:`)
  for (const f of findings) {
    console.log(`  [${f.kind}] ${f.file}:${f.line}  ${f.pattern}`)
    console.log(`    ${f.snippet}`)
  }
  console.log("\nFix: replace user-visible 'TODO/待接入' with disabled UI + doc reference.")
  process.exit(2)
}

main().catch((err) => {
  console.error("page-comment scan crashed:", err)
  process.exit(2)
})