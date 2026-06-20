/**
 * lib/sync/dump/manifest.ts
 * Sprint R.55 — dump sync contract
 *
 * Whitelist of tables that may be ingested from a pg_dump table_backup.sql.
 * Hash/cipher fields may be carried through as source ciphertext, but must
 * never be decoded or logged as secrets.
 */

export const DUMP_ALLOWED_TABLES = [
  "tbl_task",
  "tbl_disc_lib",
  "tbl_magzines",
  "tbl_slots",
  "tbl_hd_info",
  "tbl_lib_task",
  "tbl_disc",
  "tbl_logical_volume",
  "tbl_volume_slot",
  "tbl_user_task",
  "tbl_user",
  "tbl_site",
  "tbl_platform",
] as const

export const DUMP_FORBIDDEN_TABLES = ["tbl_file", "tbl_folder"] as const

export const HASH_OR_CIPHER_FIELDS = [
  "encrypt",
  "lib_pwd",
  "password",
  "pwd",
  "password_hash",
] as const

export type DumpAllowedTable = (typeof DUMP_ALLOWED_TABLES)[number]

export interface ParsedDumpTable {
  tableName: DumpAllowedTable
  columns: string[]
  rows: Record<string, string | null>[]
}
