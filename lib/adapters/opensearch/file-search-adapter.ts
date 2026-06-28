/**
 * lib/adapters/opensearch/file-search-adapter.ts
 * R.85 — OpenSearch/ES adapter implementing `SearchPort` (ADR 0002).
 *
 * Routes ES traffic through the existing `lib/search/es-client.ts`
 * (Sprint R.56 neutral HTTP client) but exposes only the port contract.
 * Caller MUST NOT import `lib/search/es-client` directly.
 *
 * Failure model:
 *  - ES not configured (SEARCH_ES_URL or SEARCH_ES_INDEX missing) -> blocked
 *  - ES HTTP error / timeout / parse failure                      -> blocked
 *  - Single document bulk failure                                -> counted in `failed`
 */

import type {
  FileSearchQuery,
  FileSearchHit,
  FileSearchResult,
  SearchPort,
} from "@/lib/ports/search-port"
import type { FileIndexDocument } from "@/lib/domain/search/file-index-document"
import {
  isEsConfigured,
  searchFilesInEs,
  indexFileInEs,
  type EsFileDocument,
} from "@/lib/search/es-client"

const BLOCKER_NOT_CONFIGURED = "es_not_configured"
const BLOCKER_QUERY_FAILED = "es_query_failed"
const BLOCKER_INDEX_FAILED = "es_index_failed"

function fileSearchQueryToEsParams(query: FileSearchQuery) {
  return {
    q: query.keyword,
    siteCodes: query.siteCode ? [query.siteCode] : [],
    limit: Math.min(Math.max(query.limit, 1), 200),
    offset: Math.max(query.offset, 0),
  }
}

function esDocToHit(doc: EsFileDocument, fallbackSite: string): FileSearchHit {
  return {
    sourceSiteId: doc.siteCode ?? fallbackSite,
    sourceRecordId: doc.hash ?? "",
    fileName: doc.fileName ?? "",
    filePath: doc.filePath ?? null,
    folderPath: doc.folderPath ?? null,
    extension: doc.extension ?? null,
    sizeBytes: null,
    volumeCode: doc.volume ?? null,
    discCode: doc.disc ?? null,
    updatedAt: doc.updatedAt ?? null,
  }
}

export function createOpenSearchFileSearchAdapter(): SearchPort {
  return {
    async searchFiles(query: FileSearchQuery): Promise<FileSearchResult> {
      if (!isEsConfigured()) {
        return {
          hits: [],
          total: 0,
          source: "blocked_by_external_system",
          blocker: BLOCKER_NOT_CONFIGURED,
        }
      }
      try {
        const result = await searchFilesInEs(
          fileSearchQueryToEsParams(query)
        )
        return {
          hits: result.items.map((doc) => esDocToHit(doc, query.siteCode ?? "")),
          total: result.total,
          source: "opensearch",
        }
      } catch {
        return {
          hits: [],
          total: 0,
          source: "blocked_by_external_system",
          blocker: BLOCKER_QUERY_FAILED,
        }
      }
    },

    async indexFiles(documents: FileIndexDocument[]) {
      if (!isEsConfigured()) {
        return {
          indexed: 0,
          failed: documents.length,
          blocker: BLOCKER_NOT_CONFIGURED,
        }
      }
      let indexed = 0
      let failed = 0
      for (const doc of documents) {
        try {
          await indexFileInEs({
            siteCode: doc.source_site_id,
            fileName: doc.file_name,
            filePath: doc.file_path ?? "",
            extension: doc.extension ?? undefined,
            folderPath: doc.folder_path ?? undefined,
            volume: doc.volume_code ?? undefined,
            disc: doc.disc_code ?? undefined,
            department: doc.department_id ?? undefined,
            taskId: doc.task_id ?? undefined,
            updatedAt: doc.updated_at ?? undefined,
          })
          indexed++
        } catch {
          failed++
        }
      }
      return { indexed, failed }
    },
  }
}
