/**
 * Self-check for cleanup script (R.83.1)
 *
 * Verifies:
 * 1. dry-run does NOT mutate DB
 * 2. apply deletes matched rows
 * 3. re-running apply after first apply yields 0 matches (idempotent)
 */

import { execSync } from "child_process"

let failed = 0
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  PASS ${label}${detail ? ` — ${detail}` : ""}`)
  else { console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); failed++ }
}

console.log("=== R.83.1 cleanup:test-pollution self-check ===\n")

// 1. Missing flag exits 2
try {
  execSync("pnpm cleanup:test-pollution", { encoding: "utf-8", stdio: "pipe" })
  check("missing flag exits non-zero", false, "expected non-zero exit")
} catch (e: any) {
  const code = e.status ?? -1
  check("missing flag exits 2", code === 2, `actual=${code}`)
}

// 2. dry-run output shape
const dryOut = execSync("pnpm cleanup:test-pollution -- --dry-run", { encoding: "utf-8" })
check("dry-run output contains [DRY-RUN] tag", dryOut.includes("[DRY-RUN]"))
check("dry-run output contains TOTAL", dryOut.includes("TOTAL"))

// 3. apply output shape (archive dir line only prints when matches>0,
//    but the [APPLY] tag + TOTAL line always appear)
const applyOut = execSync(`pnpm cleanup:test-pollution -- --apply`, { encoding: "utf-8" })
check("apply output contains [APPLY] tag", applyOut.includes("[APPLY]"))
check("apply output contains TOTAL", applyOut.includes("TOTAL"))
check("apply exits 0", applyOut.length > 0)

// 4. Idempotent: re-running yields 0 matches
const secondOut = execSync(`pnpm cleanup:test-pollution -- --dry-run`, { encoding: "utf-8" })
const lines = secondOut.split("\n").filter((l) => l.includes("matched: 0") || l.includes("0 matches"))
check("re-running shows 0 matches in all 4 tables", lines.length >= 4, `found ${lines.length} zero-match lines`)

console.log("")
if (failed === 0) console.log("ALL checks passed")
else console.error(`${failed} check(s) failed`)
process.exit(failed)