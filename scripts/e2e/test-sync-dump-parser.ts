/**
 * test-sync-dump-parser.ts
 * Sprint R.55 — TDD test for pg_dump COPY block parser
 *
 * Asserts:
 * - Allowed tables (tbl_task, tbl_user) are parsed correctly
 * - Forbidden tables (tbl_file) cause the parser to throw
 * - Hash/cipher fields are preserved as source ciphertext (never decoded)
 */

import { parsePgDumpCopyTables } from "../../lib/sync/dump/parser"
import { DUMP_ALLOWED_TABLES, DUMP_FORBIDDEN_TABLES } from "../../lib/sync/dump/manifest"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const dump = `
COPY public.tbl_task (id, task_name, encrypt, updated_at) FROM stdin;
1\tT-001\t$2a$hash\t2026-06-20 10:00:00
\\.
COPY public.tbl_user (id, user_name, lib_pwd) FROM stdin;
7\tadmin\tcipher-text
\\.
`

const tables = parsePgDumpCopyTables(dump)
assert(DUMP_ALLOWED_TABLES.includes("tbl_task"), "tbl_task allowed")
assert(DUMP_FORBIDDEN_TABLES.includes("tbl_file"), "tbl_file forbidden")
assert(tables.length === 2, `two tables parsed (got ${tables.length})`)
assert(tables[0].tableName === "tbl_task", "tbl_task parsed first")
assert(tables[0].rows[0].encrypt === "$2a$hash", "hash/cipher value preserved")
assert(tables[1].rows[0].lib_pwd === "cipher-text", "lib_pwd preserved as source ciphertext")
assert(tables[1].rows[0].user_name === "admin", "user_name parsed")

// Forbidden table must throw
let threw = false
try {
  parsePgDumpCopyTables(`
COPY public.tbl_file (id, file_name) FROM stdin;
1\ta.txt
\\.
`)
} catch {
  threw = true
}
assert(threw, "tbl_file must throw forbidden error")

// Unknown table must throw
threw = false
try {
  parsePgDumpCopyTables(`
COPY public.unknown_table (id) FROM stdin;
1\t1
\\.
`)
} catch {
  threw = true
}
assert(threw, "unknown table must throw not-allowed error")

console.log("sync dump parser: PASS")
