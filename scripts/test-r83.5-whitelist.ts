/**
 * R.83.5 Whitelist Self-Check
 *
 * 验证 lib/sync/package-schema.ts 的白名单结构：
 * - ALLOWED_PACKAGE_TABLES 共 88 张 (13 原始 + 15 R.83.1 + 15 R.83.2 + 15 R.83.3 + 15 R.83.4 + 15 R.83.5)
 * - FORBIDDEN_PACKAGE_TABLES 仍包含 tbl_file / tbl_folder
 * - 所有 entry 满足 /^tbl_[a-z0-9_]+$/
 * - 13 张原始表 (Sprint 2E.2) 全部仍存在
 * - 15 张 R.83.1 表全部仍存在
 * - 15 张 R.83.2 表全部仍存在
 * - 15 张 R.83.3 表全部仍存在
 * - 15 张 R.83.4 表全部仍存在
 * - 15 张 R.83.5 表全部存在 (数据接收 + 告警 + 媒体族)
 * - 无重复
 * - 末尾 15 张 (positions 73-87) 顺序与内容完全匹配 R.83.5 batch
 */

import {
  ALLOWED_PACKAGE_TABLES,
  FORBIDDEN_PACKAGE_TABLES,
} from '@/lib/sync/package-schema'

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

// 15 张 R.83.3 batch (检查巡检族)
const R833_TABLES = [
  'tbl_check_category',
  'tbl_check_sub_category',
  'tbl_check_item',
  'tbl_check_sector',
  'tbl_check_template',
  'tbl_check_task',
  'tbl_check_task_item',
  'tbl_check_task_file',
  'tbl_check_file',
  'tbl_check_files',
  'tbl_check_log',
  'tbl_check_patrol_strategy',
  'tbl_check_patrol_task',
  'tbl_check_patrol_task_item',
  'tbl_check_patrol_log',
]

// 15 张 R.83.4 batch (存储卷 + 调度/接口 + 设备业务族)
const R834_TABLES = [
  'tbl_volume_group',
  'tbl_volume_dataclass',
  'tbl_volume_depa',
  'tbl_volume_user',
  'tbl_volume_workspace',
  'tbl_schedule_job',
  'tbl_register_management',
  'tbl_interface_task',
  'tbl_hot_backup_record',
  'tbl_hot_restore_record',
  'tbl_device_device',
  'tbl_drivers',
  'tbl_drivers_burn',
  'tbl_raid_group',
  'tbl_hd_manager',
]

// 15 张 R.83.5 batch (数据接收 + 告警 + 媒体族)
const R835_TABLES = [
  'tbl_data_receive_list',
  'tbl_data_receive_log',
  'tbl_data_receive_tasks',
  'tbl_data_classification',
  'tbl_early_warning',
  'tbl_early_warning_feedback',
  'tbl_disc_print',
  'tbl_disc_inspect',
  'tbl_disc_type',
  'tbl_evidence_details',
  'tbl_evidence_record_drp',
  'tbl_verify_details',
  'tbl_verify_record_drp',
  'tbl_download_record',
  'tbl_upload_record',
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

console.log('R.83.5 Whitelist Self-Check')
console.log('===========================\n')

// 1. 总长度 >= 88 (R.83.6 已扩到 103,本测试只保证 R.83.5 之后的最小集)
check(
  'ALLOWED_PACKAGE_TABLES.length >= 88 (R.83.5 baseline)',
  ALLOWED_PACKAGE_TABLES.length >= 88,
  `actual=${ALLOWED_PACKAGE_TABLES.length} (expected >=88; 后续 sprint 可能扩大)`
)

// 2. 15 R.83.5 表全部存在
const allowedSet = new Set<string>(ALLOWED_PACKAGE_TABLES)
const missing835 = R835_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.5 tables present in ALLOWED_PACKAGE_TABLES',
  missing835.length === 0,
  missing835.length > 0 ? `missing=${missing835.join(',')}` : undefined
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
  'all 88 entries match /^tbl_[a-z0-9_]+$/',
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

// 7. 15 R.83.2 表全部仍存在
const missing832 = R832_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.2 tables still present',
  missing832.length === 0,
  missing832.length > 0 ? `missing=${missing832.join(',')}` : undefined
)

// 8. 15 R.83.3 表全部仍存在
const missing833 = R833_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.3 tables still present',
  missing833.length === 0,
  missing833.length > 0 ? `missing=${missing833.join(',')}` : undefined
)

// 9. 15 R.83.4 表全部仍存在
const missing834 = R834_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 15 R.83.4 tables still present',
  missing834.length === 0,
  missing834.length > 0 ? `missing=${missing834.join(',')}` : undefined
)

// 10. 13 原始 Sprint 2E.2 表全部仍存在
const missingOrig = ORIGINAL_TABLES.filter((t) => !allowedSet.has(t))
check(
  'all 13 original Sprint 2E.2 tables still present',
  missingOrig.length === 0,
  missingOrig.length > 0 ? `missing=${missingOrig.join(',')}` : undefined
)

// 11. positions 73-87 完全是 15 张 R.83.5 表 (按顺序)
const tail = ALLOWED_PACKAGE_TABLES.slice(73, 88)
const expectedTail = R835_TABLES
const tailMatch =
  tail.length === expectedTail.length &&
  tail.every((t, i) => t === expectedTail[i])
check(
  'positions 73-87 are exactly the 15 R.83.5 tables (in order)',
  tailMatch,
  `actual=[${tail.join(',')}] expected=[${expectedTail.join(',')}]`
)

// 12. 健全性: 13 + 15*5 <= 当前实际长度 (R.83.6 已扩到 103,后续 sprint 可继续扩大)
check(
  'sanity: R.83.5 baseline (13+15*5) <= actual length',
  ALLOWED_PACKAGE_TABLES.length >=
    ORIGINAL_TABLES.length +
      R831_TABLES.length +
      R832_TABLES.length +
      R833_TABLES.length +
      R834_TABLES.length +
      R835_TABLES.length,
  `expected >=${
    ORIGINAL_TABLES.length +
    R831_TABLES.length +
    R832_TABLES.length +
    R833_TABLES.length +
    R834_TABLES.length +
    R835_TABLES.length
  } actual=${ALLOWED_PACKAGE_TABLES.length}`
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