/**
 * lib/search/es-client.ts
 * Sprint R.56 — neutral ES/OpenSearch HTTP client.
 *
 * Reads only from environment. Never reads source DB.
 */

export interface EsFileDocument {
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

export interface EsSearchParams {
  q: string
  siteCodes: string[]
  limit: number
  offset: number
}

export interface EsSearchResult {
  total: number
  items: EsFileDocument[]
}

export async function searchFilesInEs(
  params: EsSearchParams
): Promise<EsSearchResult> {
  if (!isEsConfigured()) {
    return { total: 0, items: [] }
  }
  const url = process.env.SEARCH_ES_URL!.replace(/\/$/, "")
  const index = process.env.SEARCH_ES_INDEX
  const body = {
    from: params.offset,
    size: params.limit,
    query: {
      bool: {
        must: params.q
          ? [
              {
                multi_match: {
                  query: params.q,
                  fields: ["fileName^2", "filePath", "hash"],
                },
              },
            ]
          : [{ match_all: {} }],
        filter: params.siteCodes.length
          ? [{ terms: { siteCode: params.siteCodes } }]
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
  if (!res.ok) {
    throw new Error(`es_query_failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as {
    hits?: {
      total?: { value?: number }
      hits?: Array<{ _source: EsFileDocument }>
    }
  }
  return {
    total: json.hits?.total?.value ?? 0,
    items: (json.hits?.hits ?? []).map((h) => h._source),
  }
}

export async function indexFileInEs(
  doc: EsFileDocument
): Promise<{ id: string }> {
  if (!isEsConfigured()) {
    throw new Error("es_not_configured")
  }
  const url = process.env.SEARCH_ES_URL!.replace(/\/$/, "")
  const index = process.env.SEARCH_ES_INDEX
  const res = await fetch(`${url}/${index}/_doc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(doc),
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) {
    throw new Error(`es_index_failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as { _id?: string }
  return { id: json._id ?? "" }
}
