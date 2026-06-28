/**
 * scripts/index/file-indexer.ts
 * R.85 — file indexer (read tbl_file / tbl_folder bounded sample, push to ES)
 *
 * Reads a bounded sample from the site DB `tbl_file` table (29 R.84
 * `file_index_es` candidates; we sample from `tbl_file` only in R.85,
 * R.86 will add the rest + watermark + tombstone) and indexes them into
 * OpenSearch/ES via `SearchPort`.
 *
 * Usage:
 *   pnpm tsx scripts/index/file-indexer.ts
 *   pnpm tsx scripts/index/file-indexer.ts --limit 1000 --site SH01
 *
 * Env requirements:
 *   SEARCH_ES_URL      e.g. http://localhost:9200
 *   SEARCH_ES_INDEX    e.g. disc_file_index
 *   SITE_DATABASE_URL  site DB with tbl_file (or tbl_file_1 fallback)
 *
 * Output:
 *   scanned, indexed, failed, blocker
 */

import { Pool } from "pg"
import { createOpenSearchFileSearchAdapter } from "@/lib/adapters/opensearch/file-search-adapter"
import {
  isValidFileIndexDocument,
  type FileIndexDocument,
} from "@/lib/domain/search/file-index-document"

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
const LIMIT = Number(args.get("limit") ?? "100")
const SITE = args.get("site") ?? process.env.SITE_CODE ?? "SH01"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`${name} not set`)
  }
  return v
}

interface FileRow {
  id: string | number
  file_name?: string
  file_remark?: string
  file_disc_name?: string
  file_size?: number | string | null
  hash?: string
  folder_id?: number | string | null
  task_id?: number | string | null
  create_date?: Date | string | null
  content_type?: string | null
  storage_class?: number | string | null
}

async function readBoundedSample(
  pool: Pool,
  table: string,
  limit: number
): Promise<FileRow[]> {
  try {
    const r = await pool.query<FileRow>(
      `SELECT id,
              file_name,
              file_remark,
              file_disc_name,
              file_size,
              hash,
              folder_id,
              task_id,
              create_date,
              content_type,
              storage_class
       FROM ${table}
       ORDER BY id
       LIMIT $1`,
      [limit]
    )
    return r.rows
  } catch (err) {
    // tbl_file may not exist in dev env; bubble as empty sample with a warning
    console.warn(`[indexer] ${table} unreadable: ${(err as Error).message}`)
    return []
  }
}

function rowToDocument(row: FileRow, sourceTable: string): FileIndexDocument | null {
  const doc: FileIndexDocument = {
    source_site_id: SITE,
    source_table: sourceTable,
    source_record_id: String(row.id),
    file_name: row.file_name ?? `(row ${row.id})`,
    file_path: null,
    folder_path: row.folder_id != null ? `/folder/${row.folder_id}` : null,
    extension: deriveExtension(row.file_name ?? row.content_type ?? null),
    size_bytes:
      typeof row.file_size === "number"
        ? row.file_size
        : row.file_size != null
          ? Number(row.file_size)
          : null,
    volume_code: null,
    disc_code: row.file_disc_name ?? null,
    department_id: null,
    task_id: row.task_id != null ? String(row.task_id) : null,
    updated_at:
      row.create_date instanceof Date
        ? row.create_date.toISOString()
        : row.create_date ?? null,
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

async function ensureIndex(): Promise<void> {
  const url = (process.env.SEARCH_ES_URL ?? "").replace(/\/$/, "")
  const index = process.env.SEARCH_ES_INDEX ?? "disc_file_index"
  if (!url) return
  try {
    const head = await fetch(`${url}/${index}`, { method: "HEAD" })
    if (head.ok) return
    await fetch(`${url}/${index}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mappings: {
          properties: {
            siteCode: { type: "keyword" },
            fileName: { type: "text", fields: { keyword: { type: "keyword" } } },
            filePath: { type: "text" },
            folderPath: { type: "text" },
            extension: { type: "keyword" },
            volume: { type: "keyword" },
            disc: { type: "keyword" },
            department: { type: "keyword" },
            taskId: { type: "keyword" },
            hash: { type: "keyword" },
            updatedAt: { type: "date" },
          },
        },
      }),
    })
  } catch {
    // best effort; OpenSearch auto-creates with default mapping if PUT fails
  }
}

async function main() {
  console.log("=== R.85 file indexer ===")
  console.log(`site=${SITE} limit=${LIMIT}`)

  await ensureIndex()

  const pool = new Pool({ connectionString: requireEnv("SITE_DATABASE_URL") })
  const adapter = createOpenSearchFileSearchAdapter()

  let scanned = 0
  let skipped = 0
  try {
    const rows = await readBoundedSample(pool, "tbl_file", LIMIT)
    scanned = rows.length
    const docs: FileIndexDocument[] = []
    for (const row of rows) {
      const doc = rowToDocument(row, "tbl_file")
      if (doc) {
        docs.push(doc)
      } else {
        skipped++
      }
    }
    const result = await adapter.indexFiles(docs)
    console.log(
      JSON.stringify(
        {
          scanned,
          indexed: result.indexed,
          failed: result.failed,
          skipped,
          blocker: result.blocker ?? null,
        },
        null,
        2
      )
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("file-indexer crashed:", err)
  process.exit(2)
})
