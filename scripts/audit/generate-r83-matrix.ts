/**
 * R.83.1 Task 5 — Generate 170-table governance matrix.
 *
 * Reads /tmp/r83-tables.txt (dumped from site_restore_full_postgres.star_storage_db),
 * classifies every tbl_* table into target_storage / unified_table / blocker / round,
 * and writes a single markdown document to
 *   docs/database-analysis/r83-170-table-governance-matrix.md
 *
 * Classification rules (applied in order):
 *   1. tbl_file* / tbl_folder* → forbidden / never
 *   2. R.83.1 15 new tables → pg17_small / R.83.1
 *   3. existing whitelist 13 tables → pg17_small / already
 *   4. <32KB → pg17_small / R.83.2+
 *   5. 32KB–10MB → pg17_small / R.83.2+
 *   6. ≥10MB → opensearch / deferred / blocked_by_external_system
 *
 * Usage:
 *   pnpm tsx scripts/audit/generate-r83-matrix.ts
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const INPUT = "/tmp/r83-tables.txt"
const OUTPUT = resolve(
  process.cwd(),
  "docs/database-analysis/r83-170-table-governance-matrix.md",
)

const R831_NEW: ReadonlySet<string> = new Set([
  "tbl_user_role",
  "tbl_depa",
  "tbl_workspace",
  "tbl_workspace_user",
  "tbl_depa_user",
  "tbl_depa_user_info",
  "tbl_project",
  "tbl_project_site",
  "tbl_task_projects",
  "tbl_task_receipts",
  "tbl_task_files",
  "tbl_task_check",
  "tbl_receipt",
  "tbl_receipt_check",
  "tbl_receipt_file",
])

const ALREADY_WHITELIST: ReadonlySet<string> = new Set([
  "tbl_task",
  "tbl_disc_lib",
  "tbl_magzines",
  "tbl_slots",
  "tbl_hd_info",
  "tbl_lib_task",
  "tbl_disc",
  "tbl_logical_volume",
  "tbl_volume_slot",
  "tbl_user_task",
  "tbl_user",
  "tbl_site",
  "tbl_platform",
])

interface Row {
  src: string
  size: string
  raw: number
  target: "pg17_small" | "opensearch" | "clickhouse" | "forbidden" | "out_of_scope"
  unified: string
  blocker: "none" | "blocked_by_source_schema" | "blocked_by_external_system"
  round: "R.83.1" | "already" | "R.83.2+" | "deferred" | "never"
  notes: string
}

function classify(tableName: string, size: string, raw: number): Omit<Row, "src" | "size" | "raw"> {
  // Rule 1: large forbidden tables (tbl_file*, tbl_folder*, and slot_file shards via tbl_file*)
  if (/^tbl_(file|folder)/.test(tableName)) {
    return {
      target: "forbidden",
      unified: "—",
      blocker: "blocked_by_source_schema",
      round: "never",
      notes: "大表 (Sprint 2D.1 + R.82 已锁定不进 PG;走 ES/ClickHouse)",
    }
  }

  // Rule 2: R.83.1 15 new tables
  if (R831_NEW.has(tableName)) {
    return {
      target: "pg17_small",
      unified: `unified_${stripPrefix(tableName)}`,
      blocker: "none",
      round: "R.83.1",
      notes: "部门/项目/接收单 (R.83.1 已落地)",
    }
  }

  // Rule 3: existing whitelist (13 tables)
  if (ALREADY_WHITELIST.has(tableName)) {
    return {
      target: "pg17_small",
      unified: `unified_${stripPrefix(tableName)}`,
      blocker: "none",
      round: "already",
      notes: "既有白名单",
    }
  }

  // Rule 4 & 5: small / medium business tables (under 10MB) → R.83.2+ candidate
  const TEN_MB = 10 * 1024 * 1024
  if (raw < TEN_MB) {
    // Note: rule 4 (<32KB) is folded into rule 5 since both round to R.83.2+;
    // the size bucket distinction matters for prioritization but not the round label.
    return {
      target: "pg17_small",
      unified: `unified_${stripPrefix(tableName)}`,
      blocker: "none",
      round: "R.83.2+",
      notes: raw < 32 * 1024 ? "业务小表 (候选接入)" : "业务表 (中等,候选)",
    }
  }

  // Rule 6: large tables ≥10MB → opensearch, deferred
  return {
    target: "opensearch",
    unified: "—",
    blocker: "blocked_by_external_system",
    round: "deferred",
    notes: `大表 (${size}),需 ES 接入`,
  }
}

function stripPrefix(name: string): string {
  return name.replace(/^tbl_/, "")
}

function parseInput(text: string): Array<{ name: string; size: string; raw: number }> {
  const rows: Array<{ name: string; size: string; raw: number }> = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split("|")
    if (parts.length < 3) continue
    const name = parts[0]
    const size = parts[1]
    const raw = Number(parts[2])
    if (!name || !Number.isFinite(raw)) continue
    rows.push({ name, size, raw })
  }
  return rows
}

function buildMarkdown(rows: Row[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const counts = countByRound(rows)
  const lines: string[] = []
  lines.push("# R.83 170 表治理矩阵")
  lines.push("")
  lines.push("> 实查站点:`site_restore_full_postgres.star_storage_db`")
  lines.push("> 维护命令:`pnpm tsx scripts/audit/generate-r83-matrix.ts`(重新生成本文档)")
  lines.push("> 维护人:R.83 Sprint 系列")
  lines.push(`> 最近更新:${today}`)
  lines.push("")
  lines.push("## 分类规则")
  lines.push("")
  lines.push("| 列 | 含义 |")
  lines.push("|---|---|")
  lines.push("| `src_table` | 源端 `star_storage_db` 的 `tbl_*` 表名 |")
  lines.push("| `size` | `pg_total_relation_size` 人类可读值 |")
  lines.push("| `target_storage` | 中心库落点:`pg17_small` / `opensearch` / `clickhouse` / `forbidden` / `out_of_scope` |")
  lines.push("| `unified_table` | 中心库对应 `unified_<stripped>` 名;非 `pg17_small` 标 `—` |")
  lines.push("| `blocker` | 阻塞类型:`none` / `blocked_by_source_schema` / `blocked_by_external_system` |")
  lines.push("| `round` | 落地 Sprint 桶:`R.83.1` / `already` / `R.83.2+` / `deferred` / `never` |")
  lines.push("| `notes` | 简要说明 |")
  lines.push("")
  lines.push("## 分类规则优先级 (按顺序匹配)")
  lines.push("")
  lines.push("1. `tbl_file*` / `tbl_folder*` → `forbidden`,`never`,阻塞 `blocked_by_source_schema`(Sprint 2D.1 + R.82 已锁定,走 ES/ClickHouse)")
  lines.push("2. R.83.1 落地的 15 张新表 → `pg17_small`,`R.83.1`,阻塞 `none`")
  lines.push("3. 既有白名单 13 张表 → `pg17_small`,`already`,阻塞 `none`")
  lines.push("4. 表大小 < 32KB → `pg17_small`,`R.83.2+`,阻塞 `none`(业务小表,候选接入)")
  lines.push("5. 表大小 32KB ~ 10MB → `pg17_small`,`R.83.2+`,阻塞 `none`(业务表,中等,候选)")
  lines.push("6. 表大小 ≥ 10MB → `opensearch`,`deferred`,阻塞 `blocked_by_external_system`(大表,需 ES 接入)")
  lines.push("")
  lines.push("## 桶分布")
  lines.push("")
  lines.push("| 桶 | 计数 | 说明 |")
  lines.push("|---|---:|---|")
  lines.push(`| \`R.83.1\` | ${counts["R.83.1"] ?? 0} | Sprint R.83.1 已落地 (部门/项目/接收单 15 张) |`)
  lines.push(`| \`already\` | ${counts["already"] ?? 0} | R.83.1 之前的 13 张白名单 |`)
  lines.push(`| \`R.83.2+\` | ${counts["R.83.2+"] ?? 0} | 候选业务表 (小/中,后续 Sprint 评估) |`)
  lines.push(`| \`deferred\` | ${counts["deferred"] ?? 0} | 大表 (≥10MB),走 ES,需外部系统接入 |`)
  lines.push(`| \`never\` | ${counts["never"] ?? 0} | tbl_file* / tbl_folder* 已锁定不进 PG |`)
  lines.push(`| **合计** | **${rows.length}** | **= star_storage_db 全部 tbl_* 表** |`)
  lines.push("")
  lines.push(`## 矩阵表 (${rows.length} 张)`)
  lines.push("")
  lines.push("| # | src_table | size | target_storage | unified_table | blocker | round | notes |")
  lines.push("|---:|---|---|---|---|---|---|---|")
  rows.forEach((row, idx) => {
    lines.push(
      `| ${idx + 1} | ${row.src} | ${row.size} | ${row.target} | ${row.unified} | ${row.blocker} | ${row.round} | ${row.notes} |`,
    )
  })
  lines.push("")
  return lines.join("\n")
}

function countByRound(rows: Row[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    out[r.round] = (out[r.round] ?? 0) + 1
  }
  return out
}

function main() {
  const text = readFileSync(INPUT, "utf8")
  const raw = parseInput(text)
  if (raw.length === 0) {
    console.error(`No rows parsed from ${INPUT}; aborting.`)
    process.exit(1)
  }
  const rows: Row[] = raw.map((r) => {
    const cls = classify(r.name, r.size, r.raw)
    return { src: r.name, size: r.size, raw: r.raw, ...cls }
  })
  const md = buildMarkdown(rows)
  writeFileSync(OUTPUT, md, "utf8")
  const counts = countByRound(rows)
  console.log(`Wrote ${rows.length} rows → ${OUTPUT}`)
  console.log(`Round buckets:`, counts)
}

main()