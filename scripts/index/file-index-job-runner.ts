/**
 * scripts/index/file-index-job-runner.ts
 * R.86 — single-table file indexer worker
 *
 * 单 (site, table) 单次执行 worker:
 *   1. claimForRun  -> 行级锁, status = running
 *   2. watermark-based SELECT (id / create_date / updated_at)
 *   3. 映射 -> FileIndexDocument, 调 SearchPort.indexFiles
 *   4. reportRun (succeeded | failed | dead_letter | tombstoned)
 *
 * 限制 (per ADR 0001):
 *   - 只索引 R.84 file_index_es 29 张表, 严禁触碰 tbl_file* / tbl_folder* 之外的源表。
 *   - 增量键 = last_watermark_column; 表差异在 readByWatermark 内部分发。
 *
 * 用法:
 *   pnpm tsx scripts/index/file-index-job-runner.ts --site SH01 --table tbl_file
 *   pnpm tsx scripts/index/file-index-job-runner.ts --site SH01 --table tbl_file_2 --batch 200
 *
 * 输出:
 *   JSON { site, table, status, scanned, indexed, failed, watermark, duration_ms }
 */

import { Pool } from "pg"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"
import {
  isValidFileIndexDocument,
  type FileIndexDocument,
} from "@/lib/domain/search/file-index-document"
import {
  createFileIndexJobRepository,
  type FileIndexJobRow,
} from "@/lib/jobs/file-index-job"
import type { FileIndexWatermarkColumn } from "@/lib/jobs/file-index-job-state"
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

const SITE = args.get("site") ?? process.env.SITE_CODE ?? "SH01"
const TABLE = args.get("table") ?? "tbl_file"
const BATCH = Number(args.get("batch") ?? "200")

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

const BEST_EFFORT_FILE_INDEX_TABLES = new Set([
  "tbl_file_parts",
  "tbl_file_path_archive",
  "tbl_file_path_restore",
  "tbl_file_recover_info",
  "tbl_file_stat",
])

/**
 * 不同源表的字段不同; 这里按 (table, watermarkColumn) 分发 SELECT。
 * 已知分支:
 *   tbl_file / tbl_file_1 / tbl_file_2 / tbl_file_3 / tbl_file_1000x
 *     -> 主键 id + file_name / file_remark / file_disc_name / file_size /
 *        hash / folder_id / task_id / create_date / content_type / storage_class
 *   tbl_folder / tbl_folder_1 / tbl_folder_2 / tbl_folder_3 / tbl_folder_10000
 *     -> 主键 id + name / folder_path / s_level / parent / sum_files / files / subs
 *   tbl_file_parts / tbl_file_path_archive / tbl_file_path_restore /
 *   tbl_file_recover_info / tbl_file_stat
 *     -> 主键 id; 文档粒度按 parts/path/recover/stat 单独映射
 *
 * 限制: 分片/扩展表的 schema 在生产环境可能有列差异; 当前 Sprint 仅对
 * 主表 + folder 主表实现精确映射, 其他分片表走 "best-effort 列探测"。
 */
async function readByWatermark(
  pool: Pool,
  table: string,
  column: FileIndexWatermarkColumn,
  watermark: string | null,
  limit: number
): Promise<FileIndexDocument[]> {
  const comparator = watermark == null ? ">" : ">"
  const query = buildSelect(table, column, comparator, watermark, limit)
  if (!query) {
    // 不支持的表 -> 返回空, 后续 reporter 用 tombstoned 标记
    return []
  }
  const r = await pool.query(query.text, query.values)
  return r.rows
    .map((row) => mapRowToDocument(row, table))
    .filter((d): d is FileIndexDocument => d !== null)
}

function buildSelect(
  table: string,
  column: FileIndexWatermarkColumn,
  comparator: string,
  watermark: string | null,
  limit: number
): { text: string; values: unknown[] } | null {
  const safeTable = table.replace(/[^a-z0-9_]/gi, "")
  if (!safeTable) return null

  if (table === "tbl_folder" || table.startsWith("tbl_folder_")) {
    return {
      text: `SELECT id, name, folder_path, s_level, parent, sum_files, files, subs
             FROM ${safeTable}
             WHERE ${column} ${comparator} $1
             ORDER BY ${column}
             LIMIT $2`,
      values: [watermark ?? "0", limit],
    }
  }

  if (BEST_EFFORT_FILE_INDEX_TABLES.has(table)) {
    return {
      text: `SELECT id FROM ${safeTable} WHERE ${column} ${comparator} $1 ORDER BY ${column} LIMIT $2`,
      values: [watermark ?? "0", limit],
    }
  }

  if (table.startsWith("tbl_file")) {
    return {
      text: `SELECT id, file_name, file_remark, file_disc_name, file_size,
                    hash, folder_id, task_id, create_date, content_type, storage_class
             FROM ${safeTable}
             WHERE ${column} ${comparator} $1
             ORDER BY ${column}
             LIMIT $2`,
      values: [watermark ?? "0", limit],
    }
  }

  // 其他 — best-effort 通用投影
  return {
    text: `SELECT id FROM ${safeTable} WHERE ${column} ${comparator} $1 ORDER BY ${column} LIMIT $2`,
    values: [watermark ?? "0", limit],
  }
}

function mapRowToDocument(
  row: Record<string, unknown>,
  table: string
): FileIndexDocument | null {
  const idValue = row.id ?? row["ID"]
  if (idValue == null) return null
  const id = String(idValue)

  if (table === "tbl_folder" || table.startsWith("tbl_folder_")) {
    const doc: FileIndexDocument = {
      source_site_id: SITE,
      source_table: table,
      source_record_id: id,
      file_name: String(row.name ?? `(folder ${id})`),
      file_path: row.folder_path ? String(row.folder_path) : null,
      folder_path: row.folder_path ? String(row.folder_path) : null,
      extension: null,
      size_bytes:
        typeof row.sum_files === "number"
          ? row.sum_files
          : row.sum_files != null
            ? Number(row.sum_files)
            : null,
      volume_code: null,
      disc_code: null,
      department_id: row.parent != null ? String(row.parent) : null,
      task_id: null,
      updated_at: null,
      deleted: false,
    }
    return isValidFileIndexDocument(doc) ? doc : null
  }

  if (BEST_EFFORT_FILE_INDEX_TABLES.has(table)) {
    const doc: FileIndexDocument = {
      source_site_id: SITE,
      source_table: table,
      source_record_id: id,
      file_name: `(meta ${table} ${id})`,
      file_path: null,
      folder_path: null,
      extension: null,
      size_bytes: null,
      volume_code: null,
      disc_code: null,
      department_id: null,
      task_id: null,
      updated_at: null,
      deleted: false,
    }
    return isValidFileIndexDocument(doc) ? doc : null
  }

  if (table.startsWith("tbl_file")) {
    const doc: FileIndexDocument = {
      source_site_id: SITE,
      source_table: table,
      source_record_id: id,
      file_name: String(row.file_name ?? `(row ${id})`),
      file_path: null,
      folder_path: row.folder_id != null ? `/folder/${row.folder_id}` : null,
      extension: deriveExtension(String(row.file_name ?? row.content_type ?? "")),
      size_bytes:
        typeof row.file_size === "number"
          ? row.file_size
          : row.file_size != null
            ? Number(row.file_size)
            : null,
      volume_code: null,
      disc_code: row.file_disc_name ? String(row.file_disc_name) : null,
      department_id: null,
      task_id: row.task_id != null ? String(row.task_id) : null,
      updated_at: toIsoDate(row.create_date),
      deleted: false,
    }
    return isValidFileIndexDocument(doc) ? doc : null
  }

  // fallback best-effort: 仅 ID, 走最小契约
  const doc: FileIndexDocument = {
    source_site_id: SITE,
    source_table: table,
    source_record_id: id,
    file_name: `(meta ${table} ${id})`,
    file_path: null,
    folder_path: null,
    extension: null,
    size_bytes: null,
    volume_code: null,
    disc_code: null,
    department_id: null,
    task_id: null,
    updated_at: null,
    deleted: false,
  }
  return isValidFileIndexDocument(doc) ? doc : null
}

function deriveExtension(nameOrMime: string | null): string | null {
  if (!nameOrMime) return null
  const dot = nameOrMime.lastIndexOf(".")
  if (dot >= 0 && dot < nameOrMime.length - 1) {
    return nameOrMime.slice(dot + 1).toLowerCase()
  }
  return null
}

function toIsoDate(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

async function runSingle(
  pool: Pool,
  repo: ReturnType<typeof createFileIndexJobRepository>,
  siteId: string,
  table: string
): Promise<{
  status: string
  scanned: number
  indexed: number
  failed: number
  durationMs: number
  error: string | null
  watermark: string | null
}> {
  const claimed = await repo.claimForRun(siteId, table)
  if (!claimed) {
    return {
      status: "skipped",
      scanned: 0,
      indexed: 0,
      failed: 0,
      durationMs: 0,
      error: "not_claimable",
      watermark: null,
    }
  }

  const startedAt = Date.now()
  const adapter = createOpenSearchFileSearchAdapter()
  let docs: FileIndexDocument[] = []
  try {
    docs = await readByWatermark(
      pool,
      table,
      claimed.last_watermark_column,
      claimed.last_watermark_value,
      BATCH
    )
  } catch (err) {
    const duration = Date.now() - startedAt
    const message = `source_read_failed:${(err as Error).message}`
    const failure = await repo.reportFailure(
      siteId,
      table,
      0,
      0,
      1,
      0,
      duration,
      message
    )
    return {
      status: failure?.status ?? "failed",
      scanned: 0,
      indexed: 0,
      failed: 1,
      durationMs: duration,
      error: message,
      watermark: claimed.last_watermark_value,
    }
  }

  if (docs.length === 0) {
    const duration = Date.now() - startedAt
    await repo.reportRun(siteId, table, {
      newStatus: "succeeded",
      nextWatermark: claimed.last_watermark_value,
      scanned: 0,
      indexed: 0,
      failed: 0,
      tombstoned: 0,
      durationMs: duration,
      error: null,
      retryCount: claimed.retry_count,
    })
    return {
      status: "succeeded",
      scanned: 0,
      indexed: 0,
      failed: 0,
      durationMs: duration,
      error: null,
      watermark: claimed.last_watermark_value,
    }
  }

  const result = await adapter.indexFiles(docs)
  const duration = Date.now() - startedAt

  if (result.failed > 0 && result.indexed === 0) {
    await repo.reportFailure(
      siteId,
      table,
      docs.length,
      0,
      result.failed,
      0,
      duration,
      result.blocker ? `blocker:${result.blocker}` : "all_failed"
    )
    return {
      status: "failed",
      scanned: docs.length,
      indexed: 0,
      failed: result.failed,
      durationMs: duration,
      error: result.blocker ?? "all_failed",
      watermark: claimed.last_watermark_value,
    }
  }

  // 推进 watermark: 用最后一条成功的 id (id 类) 或 updated_at
  const last = docs[result.indexed - 1] ?? docs[docs.length - 1]
  const nextWatermark =
    claimed.last_watermark_column === "id"
      ? last.source_record_id
      : last.updated_at ?? claimed.last_watermark_value

  await repo.reportRun(siteId, table, {
    newStatus: "succeeded",
    nextWatermark,
    scanned: docs.length,
    indexed: result.indexed,
    failed: result.failed,
    tombstoned: 0,
    durationMs: duration,
    error: result.blocker ? `blocker:${result.blocker}` : null,
    retryCount: claimed.retry_count,
  })

  return {
    status: "succeeded",
    scanned: docs.length,
    indexed: result.indexed,
    failed: result.failed,
    durationMs: duration,
    error: result.blocker ?? null,
    watermark: nextWatermark,
  }
}

async function main() {
  console.log("=== R.86 file index job runner ===")
  console.log(`site=${SITE} table=${TABLE} batch=${BATCH}`)

  if (!FILE_INDEX_ES_TABLES.includes(TABLE as (typeof FILE_INDEX_ES_TABLES)[number])) {
    console.error(
      `[FATAL] ${TABLE} is not in R.84 file_index_es classification; refusing to run.`
    )
    process.exit(2)
  }

  const sitePool = new Pool({ connectionString: requireEnv("SITE_DATABASE_URL") })
  const centralPool = new Pool({
    connectionString: CENTRAL_URL,
  })

  try {
    const repo = createFileIndexJobRepository(centralPool)
    const seed = await repo.ensureSeedRows(SITE, [TABLE])
    if (seed.inserted > 0) {
      console.log(`[seed] inserted ${seed.inserted} file_index_jobs rows`)
    }
    const outcome = await runSingle(sitePool, repo, SITE, TABLE)
    console.log(JSON.stringify({ site: SITE, table: TABLE, ...outcome }, null, 2))
  } finally {
    await sitePool.end()
    await centralPool.end()
  }
}

main().catch((err) => {
  console.error("file-index-job-runner crashed:", err)
  process.exit(2)
})
