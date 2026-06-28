/**
 * R.83.2 Whitelist Self-Check
 *
 * 验证 lib/sync/package-schema.ts 的白名单结构：
 * - ALLOWED_PACKAGE_TABLES 共 43 张 (13 原始 + 15 R.83.1 + 15 R.83.2)
 * - FORBIDDEN_PACKAGE_TABLES 仍包含 tbl_file / tbl_folder
 * - 所有 entry 满足 /^tbl_[a-z0-9_]+$/
 * - 13 张原始表 (Sprint 2E.2) 全部仍存在
 * - 15 张 R.83.1 表全部仍存在
 * - 15 张 R.83.2 新增表全部存在
 * - 无重复
 */

import {
  ALLOWED_PACKAGE_TABLES,
  FORBIDDEN_PACKAGE_TABLES,
} from '../lib/sync/package-schema'

// 13 张 Sprint 2E.2 baseline 表
const ORIGINAL_TABLES = [
  'tbl_task',
  'tbl_disc_lib',
  'tbl_magzines',
  'tbl_slots',
  'tbl_hd_info',
  'tbl_lib_task',
  'tbl_disc',
  'tbl_logical_volume',
  'tbl_volume_slot',
  'tbl_user_task',
  'tbl_user',
  'tbl_site',
  'tbl_platform',
]

// 15 张 R.83.1 batch (部门/项目/任务接收单)
const R831_TABLES = [
  'tbl_user_role',
  'tbl_depa',
  'tbl_workspace',
  'tbl_workspace_user',
  'tbl_depa_user',
  'tbl_depa_user_info',
  'tbl_project',
  'tbl_project_site',
  'tbl_task_projects',
  'tbl_task_receipts',
  'tbl_task_files',
  'tbl_task_check',
  'tbl_receipt',
  'tbl_receipt_check',
  'tbl_receipt_file',
]

// 15 张 R.83.2 batch (RBAC + 字典 + 日志 + 凭据)
const R832_TABLES = [
  'tbl_role',
  'tbl_role_fuc',
  'tbl_fuc',
  'tbl_dict_category',
  'tbl_dict',
  'tbl_dict_item',
  'tbl_sys_log',
  'tbl_api_log',
  'tbl_api_interface',
  'tbl_user_mfa',
  'tbl_archives_type',
  'tbl_archives_level',
  'tbl_platform_type',
  'tbl_credible_prove',
  'tbl_credible_verify',
]

let passCount = 0
let failCount = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passCount++
    console.log(`  PASS  ${name}`)
  } else {
    failCount++
    const msg = detail ? `${name} — ${detail}` : name
    failures.push(msg)
    console.log(`  FAIL  ${msg}`)
  }
}

console.log('R.83.2 Whitelist Self-Check')
console.log('===========================\n')

// 1. 总长度 >= 43 (后续 R.83.x 扩展后不应破坏 R.83.2 基线)
check(
  'ALLOWED_PACKAGE_TABLES.length >= 43 (R.83.2 baseline)',
  ALLOWED_PACKAGE_TABLES.length >= 43,
  `actual=${ALLOWED_PACKAGE_TABLES.length} (expected >=43; 后续 sprint 可扩大)`
)

// 2. 15 R.83.2 表全部存在
const allowedSet = new Set<string>(ALLOWED_PACKAGE_TABLES)
const missing832 = R832_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.2 tables present in ALLOWED_PACKAGE_TABLES',
  missing832.length === 0,
  missing832.length > 0 ? `missing=${missing832.join(',')}` : undefined
)

// 3. 无重复
const seen = new Set<string>()
const dups: string[] = []
for (const t of ALLOWED_PACKAGE_TABLES) {
  if (seen.has(t)) dups.push(t)
  seen.add(t)
}
check(
  'no duplicates in ALLOWED_PACKAGE_TABLES',
  dups.length === 0,
  dups.length > 0 ? `duplicates=${dups.join(',')}` : undefined
)

// 4. FORBIDDEN 包含 tbl_file 和 tbl_folder
const forbiddenSet = new Set<string>(FORBIDDEN_PACKAGE_TABLES)
check(
  'FORBIDDEN_PACKAGE_TABLES contains tbl_file AND tbl_folder',
  forbiddenSet.has('tbl_file') && forbiddenSet.has('tbl_folder')
)

// 5. 所有 entry 满足 /^tbl_[a-z0-9_]+$/
const invalid = ALLOWED_PACKAGE_TABLES.filter((t) => !/^tbl_[a-z0-9_]+$/.test(t))
check(
  'all whitelist entries match /^tbl_[a-z0-9_]+$/',
  invalid.length === 0,
  invalid.length > 0 ? `invalid=${invalid.join(',')}` : undefined
)

// 6. 15 R.83.1 表全部仍存在
const missing831 = R831_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.1 tables still present',
  missing831.length === 0,
  missing831.length > 0 ? `missing=${missing831.join(',')}` : undefined
)

// 7. 13 原始 Sprint 2E.2 表全部仍存在
const missingOrig = ORIGINAL_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 13 original Sprint 2E.2 tables still present',
  missingOrig.length === 0,
  missingOrig.length > 0 ? `missing=${missingOrig.join(',')}` : undefined
)

// 8. 健全性：13 + 15 + 15 <= 当前实际长度
check(
  'sanity: R.83.2 baseline <= actual length',
  ORIGINAL_TABLES.length + R831_TABLES.length + R832_TABLES.length <= ALLOWED_PACKAGE_TABLES.length,
  `expected >=${ORIGINAL_TABLES.length + R831_TABLES.length + R832_TABLES.length} actual=${ALLOWED_PACKAGE_TABLES.length}`
)

console.log('\n===========================')
console.log(`Total: ${passCount} PASS, ${failCount} FAIL`)

if (failCount > 0) {
  console.log('\nFailures:')
  for (const f of failures) {
    console.log(`  - ${f}`)
  }
  console.log('\nRESULT: FAIL')
  process.exit(1)
}

console.log('\nRESULT: PASS')
process.exit(0)
