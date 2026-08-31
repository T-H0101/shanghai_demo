/**
 * Sprint R.101 DDL self-check — early warning projection columns
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(__dirname, "../../..")
const sql = readFileSync(
  resolve(ROOT, "databases/sprint-r101/01-early-warning-columns.sql"),
  "utf8",
)
const init = readFileSync(
  resolve(ROOT, "databases/sprint-2b0/init-docker.sh"),
  "utf8",
)

const checks: Array<{ name: string; ok: boolean }> = [
  {
    name: "adds status column",
    ok: /ADD COLUMN IF NOT EXISTS status SMALLINT/.test(sql),
  },
  {
    name: "adds lib_id column",
    ok: /ADD COLUMN IF NOT EXISTS lib_id BIGINT/.test(sql),
  },
  {
    name: "adds feedback user_name",
    ok: /ADD COLUMN IF NOT EXISTS user_name TEXT/.test(sql),
  },
  {
    name: "registered in init-docker.sh",
    ok: init.includes("databases/sprint-r101/01-early-warning-columns.sql"),
  },
]

let failed = 0
for (const c of checks) {
  if (c.ok) console.log(`PASS  ${c.name}`)
  else {
    console.error(`FAIL  ${c.name}`)
    failed++
  }
}

process.exit(failed > 0 ? 1 : 0)
