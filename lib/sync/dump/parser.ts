/**
 * lib/sync/dump/parser.ts
 * Sprint R.55 — parse PostgreSQL `COPY ... FROM stdin;` blocks from
 * a `pg_dump --data-only` file. Only allowed tables are accepted;
 * forbidden tables (tbl_file, tbl_folder) throw immediately.
 *
 * The parser does NOT decode hash/cipher fields; values are carried
 * through as raw source text.
 */

import {
  DUMP_ALLOWED_TABLES,
  DUMP_FORBIDDEN_TABLES,
  type DumpAllowedTable,
  type ParsedDumpTable,
} from "./manifest"

const COPY_RE = /^COPY\s+(?:(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?)\s+\(([^)]+)\)\s+FROM\s+stdin;$/i

function decodePgCopyValue(value: string): string | null {
  if (value === "\\N") return null
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
}

function isAllowedTable(tableName: string): tableName is DumpAllowedTable {
  return (DUMP_ALLOWED_TABLES as readonly string[]).includes(tableName)
}

export function parsePgDumpCopyTables(sql: string): ParsedDumpTable[] {
  const lines = sql.split(/\r?\n/)
  const tables: ParsedDumpTable[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    const match = COPY_RE.exec(line)
    if (!match) {
      index += 1
      continue
    }

    const tableName = match[1]
    const columns = match[2]
      .split(",")
      .map((col) => col.trim().replace(/^"|"$/g, ""))

    if ((DUMP_FORBIDDEN_TABLES as readonly string[]).includes(tableName)) {
      throw new Error(`${tableName} is forbidden in dump ingestion`)
    }
    if (!isAllowedTable(tableName)) {
      throw new Error(`${tableName} is not in dump ingestion whitelist`)
    }

    index += 1
    const rows: Record<string, string | null>[] = []
    while (index < lines.length && lines[index] !== "\\.") {
      const rawValues = lines[index].split("\t")
      const row: Record<string, string | null> = {}
      for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
        row[columns[colIndex]] = decodePgCopyValue(rawValues[colIndex] ?? "\\N")
      }
      rows.push(row)
      index += 1
    }

    tables.push({ tableName, columns, rows })
    index += 1
  }

  return tables
}
