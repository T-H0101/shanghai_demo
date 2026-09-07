/**
 * lib/search/es-client.ts
 * OpenSearch/ES HTTP client — 对齐业务 syncDB 推送契约 (snake_case disc_file_index)
 * 分页：仅按文档 _id 排序 + search_after（不用 from，避免 max_result_window=10000）
 * 关键字：wildcard 整段包含（LIKE '%关键字%'），不分词；排序仍按 _id
 */

export type EsIndexDocument = {
  source_site_id?: string
  source_table?: string
  source_record_id?: string
  volume_id?: number | null
  /** 逻辑卷类型：1光盘 2NAS 3硬盘 5磁带库 7磁带机 */
  volume_type?: number | null
  doc_type?: string
  file_name?: string | null
  file_size?: number | null
  folder_id?: number | null
  hash?: string | null
  task_id?: string | null
  items_id?: string | null
  create_date?: string | null
  status?: number | null
  slot_id?: number | null
  slot_order?: number | null
  /** 光盘 AB 面：0=A，1=B（来自 tbl_slots.disc_side） */
  disc_side?: number | null
  magazine_rfid?: string | null
  device_ip?: string | null
  device_port?: string | null
  /** 硬盘序列号（volume_type=3） */
  serial_num?: string | null
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

export interface EsSiteRfidFilter {
  inboundRfids?: string[]
  outboundRfids?: string[]
}

export interface EsSearchParams {
  q: string
  siteCodes: string[]
  /** 按索引/当前设备 IP 筛选（含盘笼移位 inbound/outbound） */
  deviceIp?: string
  docType?: "file" | "folder"
  limit: number
  /** 上一页最后一条文档 _id；首页不传 */
  searchAfter?: string | null
  inboundRfids?: string[]
  outboundRfids?: string[]
  deviceInboundRfids?: string[]
  deviceOutboundRfids?: string[]
}

export type EsCountParams = {
  q: string
  siteCodes: string[]
  deviceIp?: string
  docType?: "file" | "folder"
  inboundRfids?: string[]
  outboundRfids?: string[]
  deviceInboundRfids?: string[]
  deviceOutboundRfids?: string[]
}

export type EsSearchHit = EsIndexDocument & { _id: string }

export interface EsSearchResult {
  items: EsSearchHit[]
  /** 本页最后一条 _id，供下一页 search_after；无下一页时为 null */
  nextSearchAfter: string | null
  hasMore: boolean
}

/** LIKE '%keyword%'：转义用户输入中的通配符，避免 * ? \ 被当成语法 */
function escapeWildcardLiteral(value: string): string {
  return value.replace(/[\\*?]/g, "\\$&")
}

function wildcardContains(field: string, keyword: string) {
  return {
    wildcard: {
      [field]: {
        value: `*${escapeWildcardLiteral(keyword)}*`,
        case_insensitive: true,
      },
    },
  }
}

function siteOwnershipFilter(params: {
  siteCodes: string[]
  inboundRfids?: string[]
  outboundRfids?: string[]
}): object | null {
  const inbound = (params.inboundRfids ?? []).filter(Boolean)
  const outbound = (params.outboundRfids ?? []).filter(Boolean)
  if (!params.siteCodes.length) {
    if (inbound.length) {
      return { terms: { magazine_rfid: inbound } }
    }
    return null
  }
  const nativeMust: object[] = [{ terms: { source_site_id: params.siteCodes } }]
  if (outbound.length) {
    nativeMust.push({ bool: { must_not: [{ terms: { magazine_rfid: outbound } }] } })
  }
  const should: object[] = [{ bool: { must: nativeMust } }]
  if (inbound.length) {
    should.push({ terms: { magazine_rfid: inbound } })
  }
  return { bool: { should, minimum_should_match: 1 } }
}

function deviceOwnershipFilter(params: {
  deviceIp: string
  inboundRfids?: string[]
  outboundRfids?: string[]
}): object | null {
  const deviceIp = params.deviceIp.trim()
  if (!deviceIp) return null
  const inbound = (params.inboundRfids ?? []).filter(Boolean)
  const outbound = (params.outboundRfids ?? []).filter(Boolean)
  const nativeMust: object[] = [{ term: { device_ip: deviceIp } }]
  if (outbound.length) {
    nativeMust.push({ bool: { must_not: [{ terms: { magazine_rfid: outbound } }] } })
  }
  const should: object[] = [{ bool: { must: nativeMust } }]
  if (inbound.length) {
    should.push({ terms: { magazine_rfid: inbound } })
  }
  return { bool: { should, minimum_should_match: 1 } }
}

function buildSearchQuery(params: {
  q: string
  siteCodes: string[]
  deviceIp?: string
  docType?: "file" | "folder"
  inboundRfids?: string[]
  outboundRfids?: string[]
  deviceInboundRfids?: string[]
  deviceOutboundRfids?: string[]
}): object {
  const filters: object[] = []
  const ownership = siteOwnershipFilter(params)
  if (ownership) {
    filters.push(ownership)
  }
  const deviceOwnership = deviceOwnershipFilter({
    deviceIp: params.deviceIp ?? "",
    inboundRfids: params.deviceInboundRfids,
    outboundRfids: params.deviceOutboundRfids,
  })
  if (deviceOwnership) {
    filters.push(deviceOwnership)
  }
  // 仅排除 doc_type=folder 的目录文档；文件仍可用路径关键字命中（folder_path）
  filters.push({ term: { doc_type: "file" } })
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
  // 不分词，整段包含（等价 LIKE '%关键字%'）。「你好中国」不会命中只有「你好」或只有「中国」。
  // 打在 .keyword / keyword 字段上，避免 standard 把中文拆成单字、把 2025-001.jpg 拆成 2025/001/jpg。
  // 路径字段保留：文件可通过父路径/目录层级关键字检索到。
  const must =
    keyword && keyword !== "detect"
      ? [
          {
            bool: {
              should: [
                wildcardContains("file_name.keyword", keyword),
                wildcardContains("folder_path.keyword", keyword),
                wildcardContains("hash", keyword),
                wildcardContains("extension", keyword),
                wildcardContains("source_record_id", keyword),
              ],
              minimum_should_match: 1,
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
