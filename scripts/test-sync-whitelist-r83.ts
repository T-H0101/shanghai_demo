/**
 * Verify R.83.1 sync package whitelist
 *
 * Self-contained tsx script (项目无 vitest,沿用 scripts/test-*.ts 模式)。
 * 退出码 0 表示全过,非 0 表示失败。
 */

import { ALLOWED_PACKAGE_TABLES, FORBIDDEN_PACKAGE_TABLES } from "../lib/sync/package-schema"

let failed = 0
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`)
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`)
    failed++
  }
}

const R831_NEW = [
  "tbl_user_role", "tbl_depa", "tbl_workspace", "tbl_workspace_user",
  "tbl_depa_user", "tbl_depa_user_info", "tbl_project", "tbl_project_site",
  "tbl_task_projects", "tbl_task_receipts", "tbl_task_files", "tbl_task_check",
  "tbl_receipt", "tbl_receipt_check", "tbl_receipt_file",
] as const

console.log("=== R.83.1 sync whitelist self-check ===")

// 1. 总条数 = 28
check("白名单总条数 = 28", (ALLOWED_PACKAGE_TABLES as readonly string[]).length === 28, `actual: ${ALLOWED_PACKAGE_TABLES.length}`)

// 2. R.83.1 新增 15 项全部命中
for (const t of R831_NEW) {
  check(`包含 R.83.1 新增: ${t}`, ALLOWED_PACKAGE_TABLES.includes(t as typeof ALLOWED_PACKAGE_TABLES[number]))
}

// 3. 既有 13 项保留
const ORIGINAL = [
  "tbl_task", "tbl_disc_lib", "tbl_magzines", "tbl_slots", "tbl_hd_info",
  "tbl_lib_task", "tbl_disc", "tbl_logical_volume", "tbl_volume_slot",
  "tbl_user_task", "tbl_user", "tbl_site", "tbl_platform",
]
for (const t of ORIGINAL) {
  check(`保留既有项: ${t}`, ALLOWED_PACKAGE_TABLES.includes(t as typeof ALLOWED_PACKAGE_TABLES[number]))
}

// 4. tbl_file / tbl_folder 仍 forbidden
check("FORBIDDEN 仍是 tbl_file/tbl_folder",
  JSON.stringify([...FORBIDDEN_PACKAGE_TABLES]) === JSON.stringify(["tbl_file", "tbl_folder"]))

// 5. 白名单不含 forbidden
check("白名单不含 tbl_file", !ALLOWED_PACKAGE_TABLES.includes("tbl_file" as never))
check("白名单不含 tbl_folder", !ALLOWED_PACKAGE_TABLES.includes("tbl_folder" as never))

// 6. 唯一性
const set = new Set(ALLOWED_PACKAGE_TABLES)
check("白名单条目唯一", set.size === ALLOWED_PACKAGE_TABLES.length)

console.log("")
if (failed === 0) {
  console.log(`✅ ALL ${4 + R831_NEW.length + ORIGINAL.length + 2} checks passed`)
  process.exit(0)
} else {
  console.error(`❌ ${failed} check(s) failed`)
  process.exit(1)
}