/**
 * lib/domain/search/file-index-document.ts
 * R.85 — file index document contract (domain rule)
 *
 * Mirrors the OpenSearch `disc_file_index` mapping fields declared in
 * `docs/architecture/es-large-table-roadmap.md §3 索引字段`. The domain type
 * is the only place where business semantics live; port and adapter files
 * import from here, never define their own field shape.
 *
 * Per ADR 0001, `tbl_file*` / `tbl_folder*` must NOT enter PG full sync.
 * Documents are produced by `scripts/index/file-indexer.ts` (R.86+ will add
 * incremental watermark + tombstone support).
 */

export type FileIndexDocument = {
  /** site identifier, e.g. SH01 */
  source_site_id: string
  /** source table name, e.g. tbl_file */
  source_table: string
  /** primary key in source table */
  source_record_id: string
  /** file display name */
  file_name: string
  /** absolute or relative file path */
  file_path: string | null
  /** folder path */
  folder_path: string | null
  /** file extension without leading dot, lowercased */
  extension: string | null
  /** file size in bytes, null when unknown */
  size_bytes: number | null
  /** logical volume code, e.g. vol-001 */
  volume_code: string | null
  /** physical disc code, e.g. disc-2026-001 */
  disc_code: string | null
  /** owning department id */
  department_id: string | null
  /** task id that produced this file */
  task_id: string | null
  /** last update timestamp from source (ISO-8601) */
  updated_at: string | null
  /** soft delete flag, true means the file is tombstoned in ES */
  deleted: boolean
}

/**
 * Required fields for ES bulk indexing. Documents missing any of these
 * cannot be indexed and must be skipped with a counted error.
 */
export const REQUIRED_FILE_INDEX_FIELDS = [
  "source_site_id",
  "source_table",
  "source_record_id",
  "file_name",
] as const

export function isValidFileIndexDocument(
  doc: Partial<FileIndexDocument>
): doc is FileIndexDocument {
  return REQUIRED_FILE_INDEX_FIELDS.every(
    (field) => typeof doc[field] === "string" && (doc[field] as string).length > 0
  )
}
