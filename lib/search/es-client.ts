/**
 * lib/search/es-client.ts
 * OpenSearch/ES HTTP client — 对齐业务 syncDB 推送契约 (snake_case disc_file_index)
 * 分页：仅按文档 _id 排序 + search_after（不用 from，避免 max_result_window=10000）
 */

export type EsIndexDocument = {
  source_site_id?: string
  source_table?: string
  source_record_id?: string
  volume_id?: number | null
  doc_type?: string
  file_name?: string | null
  file_size?: number | null
  folder_id?: number | null
  hash?: string | null
  hash1?: string | null
  task_id?: string | null
  items_id?: string | null
  create_date?: string | null
  status?: number | null
  slot_id?: number | null
  content_type?: string | null
  extension?: string | null
  folder_name?: string | null
  folder_path?: string | null
  disc_path?: string | null
  indexed_at?: string | null
  deleted?: boolean
}

/** @deprecated 旧 camelCase 写入样例；检索已切 snake_case */
export type EsFileDocument = {
  siteCode: string
  fileName: string
  filePath: string
  extension?: string
  hash?: string
  folderPath?: string
  volume?: string
  disc?: string
  department?: string
  taskId?: string
  updatedAt?: string
}

export function isEsConfigured(): boolean {
  return Boolean(process.env.SEARCH_ES_URL && process.env.SEARCH_ES_INDEX)
}

function esBaseUrl(): string {
  return process.env.SEARCH_ES_URL!.replace(/\/$/, "")
}

function esIndex(): string {
  return process.env.SEARCH_ES_INDEX!
}

function resolveEsPassword(): string {
  const direct = process.env.SEARCH_ES_PASSWORD?.trim()
  if (direct) return direct
  const ref = process.env.SEARCH_ES_PASSWORD_KEY_REF?.trim()
  if (ref && process.env[ref]) return String(process.env[ref]).trim()
  return ""
}

function esAuthHeaders(): Record<string, string> {
  const user = process.env.SEARCH_ES_USERNAME?.trim() ?? ""
  const pass = resolveEsPassword()
  if (!user || !pass) return {}
  const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64")
  return { Authorization: `Basic ${token}` }
}

export interface EsSearchParams {
  q: string
  siteCodes: string[]
  volumeId?: number
  docType?: "file" | "folder"
  limit: number
  /** 上一页最后一条文档 _id；首页不传 */
  searchAfter?: string | null
}

export type EsCountParams = {
  q: string
  siteCodes: string[]
  volumeId?: number
  docType?: "file" | "folder"
}

export type EsSearchHit = EsIndexDocument & { _id: string }

export interface EsSearchResult {
  items: EsSearchHit[]
  /** 本页最后一条 _id，供下一页 search_after；无下一页时为 null */
  nextSearchAfter: string | null
  hasMore: boolean
}

function buildSearchQuery(params: {
  q: string
  siteCodes: string[]
  volumeId?: number
  docType?: "file" | "folder"
}): object {
  const filters: object[] = []
  if (params.siteCodes.length) {
    filters.push({ terms: { source_site_id: params.siteCodes } })
  }
  if (params.volumeId != null && Number.isFinite(params.volumeId)) {
    filters.push({ term: { volume_id: params.volumeId } })
  }
  if (params.docType === "file" || params.docType === "folder") {
    filters.push({ term: { doc_type: params.docType } })
  }
  filters.push({
    bool: {
      should: [
        { term: { deleted: false } },
        { bool: { must_not: { exists: { field: "deleted" } } } },
      ],
      minimum_should_match: 1,
    },
  })

  const keyword = params.q?.trim() ?? ""
  const must =
    keyword && keyword !== "detect"
      ? [
          {
            multi_match: {
              query: keyword,
              fields: [
                "file_name^3",
                "folder_name^2",
                "folder_path",
                "hash",
                "hash1",
                "content_type",
                "extension",
                "source_record_id",
              ],
            },
          },
        ]
      : [{ match_all: {} }]

  return {
    bool: {
      must,
      filter: filters,
    },
  }
}

export async function searchFilesInEs(
  params: EsSearchParams
): Promise<EsSearchResult> {
  if (!isEsConfigured()) {
    return { items: [], nextSearchAfter: null, hasMore: false }
  }

  const limit = Math.min(Math.max(params.limit, 1), 500)
  const body: Record<string, unknown> = {
    size: limit,
    track_total_hits: false,
    query: buildSearchQuery(params),
    sort: [{ _id: "asc" }],
  }

  const after = params.searchAfter?.trim()
  if (after) {
    body.search_after = [after]
  }

  const res = await fetch(`${esBaseUrl()}/${esIndex()}/_search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...esAuthHeaders(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    throw new Error(`es_query_failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    hits?: {
      hits?: Array<{ _id?: string; _source?: EsIndexDocument; sort?: unknown[] }>
    }
  }

  const rawHits = json.hits?.hits ?? []
  const items: EsSearchHit[] = rawHits.map((h) => ({
    ...(h._source ?? {}),
    _id: h._id ?? (typeof h.sort?.[0] === "string" ? h.sort[0] : ""),
  }))

  const lastId = items.length > 0 ? items[items.length - 1]._id : null
  const hasMore = items.length >= limit && Boolean(lastId)

  return {
    items,
    nextSearchAfter: hasMore ? lastId : null,
    hasMore,
  }
}

/** 与检索同条件的精确命中总数（/_count）；千万级可能较慢，应由前端在条件变化时调用一次 */
export async function countFilesInEs(params: EsCountParams): Promise<number> {
  if (!isEsConfigured()) {
    return 0
  }

  const res = await fetch(`${esBaseUrl()}/${esIndex()}/_count`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...esAuthHeaders(),
    },
    body: JSON.stringify({ query: buildSearchQuery(params) }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`es_count_failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as { count?: number }
  const n = Number(json.count)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export async function indexFileInEs(
  doc: EsFileDocument
): Promise<{ id: string }> {
  if (!isEsConfigured()) {
    throw new Error("es_not_configured")
  }
  const res = await fetch(`${esBaseUrl()}/${esIndex()}/_doc`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...esAuthHeaders(),
    },
    body: JSON.stringify(doc),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`es_index_failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as { _id?: string }
  return { id: json._id ?? "" }
}
