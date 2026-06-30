/**
 * lib/ports/search-port.ts
 * R.85 — SearchPort interface (ADR 0002)
 *
 * The single port that `/api/search` and any future search UI must call.
 * The OpenSearch/ES adapter (`lib/adapters/opensearch/file-search-adapter.ts`)
 * implements this port. When ES is unavailable, the adapter returns a
 * `blocked_by_external_system` result so the API route can surface the
 * correct semantic status without leaking driver-level errors.
 *
 * NEVER import `pg` or `@opensearch-project/opensearch` here; this is the
 * contract layer only.
 */

import type { FileIndexDocument } from "@/lib/domain/search/file-index-document"

export type FileSearchQuery = {
  keyword: string
  siteCode?: string
  departmentIds?: string[]
  limit: number
  offset: number
}

export type FileSearchHit = {
  sourceSiteId: string
  sourceRecordId: string
  fileName: string
  filePath: string | null
  folderPath: string | null
  extension: string | null
  sizeBytes: number | null
  volumeCode: string | null
  discCode: string | null
  updatedAt: string | null
}

export type FileSearchSource = "opensearch" | "blocked_by_external_system"

export type FileSearchResult = {
  hits: FileSearchHit[]
  total: number
  source: FileSearchSource
  /** Human-readable reason when source = blocked_by_external_system */
  blocker?: string
}

export interface SearchPort {
  /**
   * Search the OpenSearch/ES file index.
   *
   * Contract:
   *  - Returns `{ source: "opensearch", hits, total }` on success.
   *  - Returns `{ source: "blocked_by_external_system", hits: [], total: 0, blocker }`
   *    when ES is unconfigured, unreachable, or returns an error.
   *  - NEVER throws on driver-level failure; all errors are converted to
   *    blocked status so the caller can render consistent UX.
   */
  searchFiles(query: FileSearchQuery): Promise<FileSearchResult>

  /**
   * Index a batch of documents (used by file-indexer.ts).
   *
   * Contract:
   *  - Returns `{ indexed, failed }` counts. NEVER throws for partial failures.
   *  - Caller is responsible for retry/dead-letter decisions.
   */
  indexFiles(documents: FileIndexDocument[]): Promise<{
    indexed: number
    failed: number
    blocker?: string
  }>
}
