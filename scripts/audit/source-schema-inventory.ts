/**
 * R.46 — Source schema inventory for 170-table star_storage_db.
 *
 * Scans all tables, counts rows, matches keywords, lists key columns.
 * Output: markdown table for docs/database-analysis/source-table-inventory-r46.md
 */

import { Client } from "pg"

const url = process.env.SITE_DATABASE_URL
if (!url) {
  console.error("SITE_DATABASE_URL is required")
  process.exit(1)
}

const keywords = [
  "file", "folder", "task", "log", "error", "user", "role", "auth",
  "dept", "depa", "disc", "slot", "mag", "cage", "volume", "hash", "checksum",
  "rack", "device", "patrol", "burn", "restore", "config", "setting",
]

async function main() {
  const client = new Client({ connectionString: url })
  await client.connect()

  const tables = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_type='BASE TABLE'
    ORDER BY table_schema, table_name
  `)

  console.log(`# Source Table Inventory (R.46)\n`)
  console.log(`> Generated: ${new Date().toISOString()}`)
  console.log(`> Database: SITE_DATABASE_URL (star_storage_db, port 5434)`)
  console.log(`> table_count: ${tables.rowCount}\n`)
  console.log(`| # | table | rows | matched_keywords | key_columns |`)
  console.log(`|---:|---|---:|---|---|`)

  let idx = 0
  for (const row of tables.rows) {
    idx++
    const table = `${row.table_schema}.${row.table_name}`
    try {
      const cols = await client.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_schema=$1 AND table_name=$2
         ORDER BY ordinal_position`,
        [row.table_schema, row.table_name],
      )
      const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM "${row.table_schema}"."${row.table_name}"`)
      const names = cols.rows.map((c: { column_name: string }) => c.column_name)
      const haystack = `${row.table_name} ${names.join(" ")}`.toLowerCase()
      const matched = keywords.filter((k) => haystack.includes(k))
      const keyCols = names.filter((n) =>
        /id$|_id$|^id_|no$|name|status|type|time|date|path|size|hash|error|user|dept|site|result|state/i.test(n),
      )
      console.log(`| ${idx} | ${row.table_name} | ${countResult.rows[0].count} | ${matched.join(", ")} | ${keyCols.slice(0, 15).join(", ")} |`)
    } catch (err) {
      console.log(`| ${idx} | ${row.table_name} | ERR | — | ${(err as Error).message?.slice(0, 60)} |`)
    }
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
