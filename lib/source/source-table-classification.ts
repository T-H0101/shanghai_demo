/**
 * R.84 source table classification constants.
 *
 * These are source-schema decisions, not sync whitelist entries. The
 * `file_index_es` tables must not be added to PG package full sync.
 */

export const FILE_INDEX_ES_TABLES = [
  "tbl_file",
  "tbl_folder",
  "tbl_file_1",
  "tbl_file_1_a",
  "tbl_file_1_empty",
  "tbl_file_1_error",
  "tbl_file_1_repeat",
  "tbl_file_2",
  "tbl_file_2_a",
  "tbl_file_2_empty",
  "tbl_file_2_error",
  "tbl_file_2_repeat",
  "tbl_file_3",
  "tbl_file_3_a",
  "tbl_file_3_empty",
  "tbl_file_3_error",
  "tbl_file_3_repeat",
  "tbl_file_10000",
  "tbl_file_10001",
  "tbl_file_10002",
  "tbl_file_parts",
  "tbl_file_path_archive",
  "tbl_file_path_restore",
  "tbl_file_recover_info",
  "tbl_file_stat",
  "tbl_folder_1",
  "tbl_folder_2",
  "tbl_folder_3",
  "tbl_folder_10000",
] as const

export type FileIndexEsTable = (typeof FILE_INDEX_ES_TABLES)[number]
