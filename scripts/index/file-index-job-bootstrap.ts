/**
 * scripts/index/file-index-job-bootstrap.ts
 * R.86 — seed file_index_jobs for R.84 file_index_es 29 tables × N sites
 *
 * 给每张 file_index_es 表 × 每个站点插入默认 pending 行 (idempotent)。
 * 不读站点数据, 不写 ES, 仅负责把调度账本准备好。
 *
 * 用法:
 *   pnpm tsx scripts/index/file-index-job-bootstrap.ts --sites SH01,BJ02
 *
 * 输出:
 *   { sites: [...], inserted, skipped, total_jobs }
 */

import { Pool } from "pg"
import { createFileIndexJobRepository } from "@/lib/jobs/file-index-job"
import { FILE_INDEX_ES_TABLES } from "@/lib/source/source-table-classification"

const args = new Map<string, string>()
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg.startsWith("--")) {
    const stripped = arg.replace(/^--/, "")
    if (stripped.includes("=")) {
      const [k, v] = stripped.split("=")
      args.set(k, v ?? "true")
    } else if (i + 1 < process.argv.length && !process.argv[i + 1].startsWith("--")) {
      args.set(stripped, process.argv[i + 1])
      i++
    } else {
      args.set(stripped, "true")
    }
  }
}

const SITES = (args.get("sites") ?? process.env.SITE_CODE ?? "SH01")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`${name} not set`)
  }
  return v
}

const CENTRAL_URL = process.env.CENTRAL_DATABASE_URL ?? process.env.DATABASE_URL ?? ""
if (!CENTRAL_URL) {
  throw new Error("CENTRAL_DATABASE_URL or DATABASE_URL must be set")
}

async function main() {
  console.log("=== R.86 file_index_jobs bootstrap ===")
  console.log(`sites=${SITES.join(",")} tables=${FILE_INDEX_ES_TABLES.length}`)

  const pool = new Pool({ connectionString: CENTRAL_URL })
  const repo = createFileIndexJobRepository(pool)

  let inserted = 0
  let skipped = 0
  for (const site of SITES) {
    const seed = await repo.ensureSeedRows(site, FILE_INDEX_ES_TABLES)
    inserted += seed.inserted
    skipped += seed.skipped
  }

  console.log(
    JSON.stringify(
      {
        sites: SITES,
        inserted,
        skipped,
        total_jobs: SITES.length * FILE_INDEX_ES_TABLES.length,
      },
      null,
      2
    )
  )
  await pool.end()
}

main().catch((err) => {
  console.error("file-index-job-bootstrap crashed:", err)
  process.exit(2)
})