/**
 * R.48 — File index source adapter.
 *
 * Reads from star_storage_db (port 5434) tbl_file_* partition tables.
 * Does NOT ingest full tbl_file into PG17 center DB.
 * Bounded queries with strict LIMIT for safety.
 */

import { Client } from "pg"

export type FileIndexSearchParams = {
  keyword?: string
  siteCode?: string
  suffix?: string
  department?: string
  volumeId?: string
  discNo?: string
  limit: number
}

export type FileIndexSearchResult = {
  filePath: string
  fileName: string
  suffix: string | null
  fileSize: number | null
  createdAt: string | null
  siteCode: string
  volumeId: string | null
  discNo: string | null
  department: string | null
  checksum: string | null
  sourceTable: string
  sourcePrimaryKey: string
}

const SITE_DB_URL = process.env.SITE_DATABASE_URL

// Table priority: largest partition first for best coverage
const FILE_TABLES = [
  "tbl_file_2",      // 40421 rows
  "tbl_file_3_a",    // 27658 rows
  "tbl_file_1",      // 1773 rows
  "tbl_file_10000",  // 41 rows
  "tbl_file_10001",  // 42 rows
  "tbl_file_10002",  // 42 rows
  "tbl_file",        // 4 rows (base)
]

async function getClient(): Promise<Client | null> {
  if (!SITE_DB_URL) return null
  const client = new Client({ connectionString: SITE_DB_URL })
  try {
    await client.connect()
    return client
  } catch {
    return null
  }
}

function extractSuffix(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".")
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : null
}

/**
 * Search across tbl_file_* partitions with bounded LIMIT.
 * Stops after finding enough results.
 */
export async function searchFileIndex(params: FileIndexSearchParams): Promise<{
  source: string
  items: FileIndexSearchResult[]
  limitations: string[]
  missingDimensions: string[]
}> {
  const limit = Math.min(params.limit ?? 50, 200)
  const client = await getClient()

  if (!client) {
    return {
      source: "blocked_by_external_system",
      items: [],
      limitations: ["SITE_DATABASE_URL not configured"],
      missingDimensions: ["file", "hash", "disc"],
    }
  }

  try {
    const items: FileIndexSearchResult[] = []
    const limitations: string[] = []

    for (const table of FILE_TABLES) {
      if (items.length >= limit) break

      const remaining = limit - items.length
      let query = ""
      const queryParams: (string | number)[] = []

      // Build WHERE clause
      const conditions: string[] = []

      if (params.keyword) {
        conditions.push(`file_name ILIKE $${conditions.length + 1}`)
        queryParams.push(`%${params.keyword}%`)
      }
      if (params.suffix) {
        conditions.push(`file_name ILIKE $${conditions.length + 1}`)
        queryParams.push(`%.${params.suffix}`)
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

      query = `
        SELECT id::text, uuid, file_name, file_size, hash, hash1,
               folder_id::text, create_date, content_type, task_id::text, slot_id::text
        FROM ${table}
        ${where}
        ORDER BY create_date DESC NULLS LAST
        LIMIT $${conditions.length + 1}
      `
      queryParams.push(remaining)

      try {
        const res = await client.query(query, queryParams)

        for (const row of res.rows) {
          const suffix = extractSuffix(row.file_name ?? "")
          // Apply suffix filter in JS if the SQL LIKE didn't catch it
          if (params.suffix && suffix !== params.suffix.toLowerCase()) continue

          items.push({
            filePath: row.uuid ?? `/${table}/${row.id}`,
            fileName: row.file_name ?? "",
            suffix,
            fileSize: row.file_size != null ? Number(row.file_size) : null,
            createdAt: row.create_date ? new Date(row.create_date).toISOString() : null,
            siteCode: "SH01",
            volumeId: row.task_id ?? null,
            discNo: row.slot_id != null ? `slot_${row.slot_id}` : null,
            department: null,
            checksum: row.hash ?? row.hash1 ?? null,
            sourceTable: table,
            sourcePrimaryKey: row.id,
          })
        }
      } catch {
        // Table might not exist or have different schema
        limitations.push(`${table}: query failed`)
      }
    }

    // Determine missing dimensions
    const missingDimensions: string[] = []
    if (items.every((i) => !i.department)) missingDimensions.push("department (tbl_depa empty)")
    if (items.every((i) => !i.volumeId || i.volumeId === items[0]?.volumeId))
      missingDimensions.push("volume (tbl_logical_volume only 3 rows)")

    return {
      source: "site_restore_db",
      items: items.slice(0, limit),
      limitations,
      missingDimensions,
    }
  } finally {
    await client.end()
  }
}

/**
 * Export file index as CSV-ready rows.
 */
export async function exportFileIndex(params: FileIndexSearchParams): Promise<{
  source: string
  items: FileIndexSearchResult[]
}> {
  const result = await searchFileIndex(params)
  return { source: result.source, items: result.items }
}
