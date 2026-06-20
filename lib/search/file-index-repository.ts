/**
 * lib/search/file-index-repository.ts
 * Sprint R.55 — center-owned file index read path
 *
 * Selection rule (per R.55 architecture freeze):
 *   1. ES/OpenSearch configured + index exists  -> query ES
 *   2. ES not configured                        -> query center unified_file_index if present
 *   3. otherwise                                -> return blocked_by_external_system
 *
 * NEVER reads site_restore_db / star_storage_db directly from product APIs.
 * Direct restore DB reads remain only in the bounded audit and import
 * tooling (lib/source/file-index-source), which the product pages do not use.
 */

import { searchFileIndex as searchRestoreBounded } from "@/lib/source/file-index-source"

export type FileIndexSource = "es" | "unified_file_index" | "blocked_by_external_system"

export interface FileIndexQuery {
  q?: string
  keyword?: string
  suffix?: string
  limit?: number
}

export interface FileIndexItem {
  siteCode?: string
  fileName?: string
  filePath?: string
  extension?: string
  hash?: string
  volume?: string
  disc?: string
  department?: string
  source?: string
}

export interface FileIndexResult {
  source: FileIndexSource
  items: FileIndexItem[]
  total: number
  missingDimensions: string[]
  requirements: string[]
  blocker: string | null
}

const isEsConfigured = (): boolean =>
  Boolean(process.env.SEARCH_ES_URL && process.env.SEARCH_ES_INDEX)

export async function searchFileIndex(
  query: FileIndexQuery
): Promise<FileIndexResult> {
  const keyword = query.q ?? query.keyword
  const limit = Math.min(query.limit ?? 50, 200)

  if (isEsConfigured()) {
    try {
      const url = process.env.SEARCH_ES_URL!.replace(/\/$/, "")
      const index = process.env.SEARCH_ES_INDEX
      const body = {
        size: limit,
        query: {
          bool: {
            must: keyword
              ? [{ multi_match: { query: keyword, fields: ["fileName^2", "filePath", "hash"] } }]
              : [{ match_all: {} }],
            filter: query.suffix
              ? [{ term: { extension: query.suffix.toLowerCase() } }]
              : [],
          },
        },
      }
      const res = await fetch(`${url}/${index}/_search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const json = (await res.json()) as {
          hits?: { total?: { value?: number }; hits?: Array<{ _source: FileIndexItem }> }
        }
        return {
          source: "es",
          items: (json.hits?.hits ?? []).map((h) => h._source),
          total: json.hits?.total?.value ?? 0,
          missingDimensions: [],
          requirements: ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
          blocker: null,
        }
      }
    } catch {
      // fall through to center
    }
  }

  // Center unified_file_index is the preferred fallback.
  // When center ingest has not populated it, return explicit blocked state
  // rather than reading from source.
  // The bounded restore reader is retained as a last-resort, audit-only
  // capability that logs source=blocked_by_external_system in the response.
  const centerResult = await searchCenterUnifiedFileIndex(keyword, query.suffix, limit)
  if (centerResult.items.length > 0) {
    return centerResult
  }

  return {
    source: "blocked_by_external_system",
    items: [],
    total: 0,
    missingDimensions: ["department", "volume", "disc"],
    requirements: ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
    blocker: "es_unavailable_center_index_empty",
  }
}

async function searchCenterUnifiedFileIndex(
  keyword: string | undefined,
  suffix: string | undefined,
  limit: number
): Promise<FileIndexResult> {
  try {
    const { query } = await import("@/lib/db/postgres")
    const conditions: string[] = ["1=1"]
    const params: unknown[] = []
    if (keyword) {
      params.push(`%${keyword}%`)
      conditions.push(`(file_name ILIKE $${params.length} OR file_path ILIKE $${params.length})`)
    }
    if (suffix) {
      params.push(suffix.toLowerCase())
      conditions.push(`LOWER(extension) = $${params.length}`)
    }
    params.push(limit)
    const r = await query<Record<string, unknown>>(
      `SELECT site_code, file_name, file_path, extension, hash, volume, disc, department
       FROM unified_file_index
       WHERE ${conditions.join(" AND ")}
       LIMIT $${params.length}`,
      params
    )
    return {
      source: "unified_file_index",
      items: r.rows.map((row) => ({
        siteCode: row.site_code as string | undefined,
        fileName: row.file_name as string | undefined,
        filePath: row.file_path as string | undefined,
        extension: row.extension as string | undefined,
        hash: row.hash as string | undefined,
        volume: row.volume as string | undefined,
        disc: row.disc as string | undefined,
        department: row.department as string | undefined,
      })),
      total: r.rows.length,
      missingDimensions: [],
      requirements: ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
      blocker: null,
    }
  } catch {
    // table may not exist yet
    return {
      source: "blocked_by_external_system",
      items: [],
      total: 0,
      missingDimensions: ["department", "volume", "disc"],
      requirements: ["REQ-4.1.1", "REQ-4.1.2", "REQ-5.2.1"],
      blocker: "unified_file_index_missing",
    }
  }
}

// Audit-only export: do not call from product API
export const __auditOnlyRestoreBounded = searchRestoreBounded
