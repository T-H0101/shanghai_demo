/**
 * scripts/audit/matrix-strict-stats.ts
 * Sprint R.68 — compute strict status from requirements array.
 *
 * Reports strict and candidate completion counts based on the
 * current_status field.
 */

import { readFileSync } from "node:fs"

const file = "docs/database-analysis/requirements-traceability.json"
const json = JSON.parse(readFileSync(file, "utf8")) as {
  requirements: Array<{ requirement_id: string; current_status: string }>
}

const counts: Record<string, number> = {}
const candidateCounts: Record<string, number> = {}
for (const r of json.requirements) {
  counts[r.current_status] = (counts[r.current_status] ?? 0) + 1
}

console.log("Strict current_status counts:")
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k}: ${v}`)
}

const complete = counts.complete ?? 0
const total = json.requirements.length
const outOfScope = counts.out_of_scope ?? 0
const completion = total - outOfScope === 0 ? 0 : (complete / (total - outOfScope)) * 100
console.log(`\nStrict completion: ${complete}/${total - outOfScope} = ${completion.toFixed(1)}%`)
