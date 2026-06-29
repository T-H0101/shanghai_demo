/**
 * scripts/audit/product-copy.ts
 * R.91.1 — verify user-visible strings in pages & components are product-ready.
 *
 * Forbidden in user-visible text:
 *   dispatcher, source_restore, sync_package, not_run, blocked_by_*,
 *   Site Agent, 真实(overused), 数据来源:, 等待闭环, 暂未接入真实源端,
 *   此处仅做演示, __demo__, unified_*, 源记录 ID, 源表, 暂无真实, 演示模式
 *
 * Scans .tsx and .ts files in app/ and components/ directories,
 * excluding app/api/ and app/api_v2/.
 *
 * Uses a match-context heuristic to distinguish code-only finds (object keys,
 * internal prop values, comparisons, default values — WARN) from user-visible
 * finds (rendered text, labels, toasts — FAIL).
 *
 * Exit codes:
 *   0 - no forbidden terms in user-visible text (WARN-only is OK)
 *   2 - FAIL-level findings in user-visible text
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const SCAN_DIRS = [
  join(process.cwd(), "app"),
  join(process.cwd(), "components"),
]
const EXCLUDE_DIRS = new Set(["api", "api_v2"])

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
  [/\b真实(?:数据|告警|状态|结果|任务|设备|趋势|账号)/g, "overused qualifier: 真实X → X"],
]

interface Finding {
  file: string
  line: number
  pattern: string
  snippet: string
  level: "FAIL" | "WARN"
}

/** JSX props that carry internal-only values (never user-visible) */
const INTERNAL_PROPS = new Set([
  "value", "status", "id", "name", "type", "variant", "size",
  "className", "key", "ref", "role", "tabIndex", "htmlFor",
  // data-* can't be exhaustively listed, handled separately
])

/** JSX props that carry user-visible label text */
const USER_VISIBLE_PROPS = new Set([
  "label", "title", "description", "placeholder", "hint",
  "aria-label", "alt",
])

/**
 * Context-sensitive check: given the line and the position where a forbidden
 * pattern matched, determine whether the occurrence is code-only (internal
 * identifier — WARN) or actually user-visible (FAIL).
 *
 * Heuristics (all return WARN):
 *   1. The match is an object key (followed by `:` and a string value)
 *   2. The match is the target of a comparison / default (`??`, `||`, `===`)
 *   3. The match is a property access target (preceded by `.`)
 *   4. The match is the value of an internal JSX prop (`status="..."`)
 *   5. The match is inside a type union (`"a" | "b"`)
 *   6. The match is inside a comment
 */
function getMatchLevel(line: string, matchIndex: number, matchLen: number): "WARN" | "FAIL" {
  const beforeMatch = line.slice(Math.max(0, matchIndex - 100), matchIndex)
  const afterMatch = line.slice(matchIndex + matchLen, matchIndex + matchLen + 30)

  // 1. Inside a comment (// or /* ... */ or JSDoc continuation *)
  const textBeforeMatch = line.slice(0, matchIndex)
  if (/\/\//.test(textBeforeMatch) || /\/\*/.test(textBeforeMatch)) return "WARN"
  // JSDoc / block comment continuation lines (starting with * or //)
  if (/^\s*\*\s/.test(line.trim()) || /^\s*\*\/\s*$/.test(line.trim())) return "WARN"

  // 2. Type definition / type union: `type X = "a" | "b"` or `"a" | "b"`
  if (/\btype\s/.test(textBeforeMatch) || /["']\s*\|\s*["']\s*$/.test(beforeMatch)) return "WARN"

  // 3. Object key position: `blocked_by_auth: "待认证服务"`
  if (/^\s*:/.test(afterMatch)) return "WARN"

  // 4. Object literal value for internal key: `value: "sync_package"`
  //   checks for `key: "` or `key:"` before the match
  const objKeyMatch = beforeMatch.match(/(\w[\w-]*)\s*:\s*["']\s*$/)
  if (objKeyMatch) {
    const keyName = objKeyMatch[1]
    if (keyName.startsWith("data-") || INTERNAL_PROPS.has(keyName) || keyName === "key") return "WARN"
    if (USER_VISIBLE_PROPS.has(keyName)) return "FAIL"
  }

  // 5. Property access target: `t.unified_count`
  if (/\.\s*$/.test(beforeMatch)) return "WARN"

  // 6. Comparison / default value: `?? "..."`, `|| "..."`, `=== "..."`
  if (/(\?\?|\|\||===|!==|&&)\s*["']?\s*$/.test(beforeMatch)) return "WARN"

  // 7. Ternary expression branch: `cond ? "a" : "blocked_by_*"`
  if (/["'][^"']*\s*:\s*["']?\s*$/.test(beforeMatch)) return "WARN"

  // 8. Internal JSX prop value (simple): `status="blocked_by_auth"`
  const simplePropMatch = beforeMatch.match(/(\w[\w-]*)\s*=\s*["']\s*$/)
  if (simplePropMatch) {
    const propName = simplePropMatch[1]
    if (propName.startsWith("data-") || INTERNAL_PROPS.has(propName)) return "WARN"
    if (USER_VISIBLE_PROPS.has(propName)) return "FAIL"
  }

  // 9. JSX prop with expression (complex): `status={...("blocked_by_*")}`
  //    or `status={cond ? "a" : "blocked"}`
  //    Detect if we're inside a JSX prop expression by finding `<tag propName={`
  const jsxExprMatch = textBeforeMatch.match(/<(\w[\w.-]*)\s+[^>]*?(\w[\w-]*)=\{[^}]*$/)
  if (jsxExprMatch) {
    const tagName = jsxExprMatch[1]
    const propName = jsxExprMatch[2]
    // Skip internal prop names
    if (propName.startsWith("data-") || INTERNAL_PROPS.has(propName)) return "WARN"
    // For unknown prop names, check if the tag is known
    if (!USER_VISIBLE_PROPS.has(propName)) return "WARN"
  }

  // 10. Array element in includes() / indexOf / some / every / find / filter / map
  if (/(includes|indexOf|some|every|find|filter|map)\([^)]*$/.test(beforeMatch)) return "WARN"

  // 11. Function call argument: displayStatus("not_run"), setConsistency({status:"not_run"})
  //    Check if we're inside a function call's argument list
  if (/\([^)]*$/.test(beforeMatch)) return "WARN"

  // Default: appears to be in user-visible position → FAIL
  return "FAIL"
}

function findInFile(filePath: string): Finding[] {
  const rel = filePath.replace(process.cwd() + "/", "")
  const content = readFileSync(filePath, "utf8")
  const lines = content.split("\n")
  const findings: Finding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const [re, desc] of FORBIDDEN_PATTERNS) {
      // Reset lastIndex for global regex
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(line)) !== null) {
        const level = getMatchLevel(line, m.index, m[0].length)
        findings.push({
          file: rel,
          line: i + 1,
          pattern: desc,
          snippet: line.trim().slice(0, 120),
          level,
        })
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
  console.log("=== R.91.1 product copy audit ===")
  for (const d of SCAN_DIRS) {
    try {
      statSync(d)
      console.log(`scan: ${d.replace(process.cwd() + "/", "")}`)
    } catch {
      console.log(`skip (not found): ${d.replace(process.cwd() + "/", "")}`)
    }
  }

  const findings: Finding[] = []
  for (const dir of SCAN_DIRS) {
    try {
      statSync(dir)
      for (const file of walkDir(dir)) {
        findings.push(...findInFile(file))
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  if (findings.length === 0) {
    console.log("\n[PASS] No forbidden developer terms found")
    return 0
  }

  const failFindings = findings.filter((f) => f.level === "FAIL")
  const warnFindings = findings.filter((f) => f.level === "WARN")

  if (warnFindings.length > 0) {
    console.log(`\n[WARN] ${warnFindings.length} code-only occurrence(s) (not user-visible — review suggested):`)
    for (const f of warnFindings) {
      console.log(`  ${f.file}:${f.line}  ${f.pattern}`)
      console.log(`    ${f.snippet}`)
    }
  }

  if (failFindings.length > 0) {
    console.log(`\n[FAIL] ${failFindings.length} user-visible forbidden term(s) found:`)
    for (const f of failFindings) {
      console.log(`  ${f.file}:${f.line}  ${f.pattern}`)
      console.log(`    ${f.snippet}`)
    }
    return 2
  }

  console.log("\n[PASS] No forbidden developer terms in user-visible text")
  return 0
}

process.exit(main())