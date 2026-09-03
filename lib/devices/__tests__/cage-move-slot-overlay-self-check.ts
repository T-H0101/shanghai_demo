/**
 * 盘笼移位详情盘位映射 — 纯函数自检（无 DB）
 * 运行: pnpm exec tsx lib/devices/__tests__/cage-move-slot-overlay-self-check.ts
 */

import {
  applyHistoricalSlotOverlay,
  findInboundRelocationForMagazine,
  indexHistoricalSlotsByOrder,
  isRelocationTargetForDevice,
} from "@/lib/devices/cage-move-slot-overlay"
import {
  magazineRfidVariants,
  magazineRfidsMatch,
  reverseMagazineRfidHexPairs,
} from "@/lib/devices/magazine-rfid"
import type { MagazineRelocation } from "@/lib/control/cage-move-register"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? `: ${detail}` : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? `: ${detail}` : ""}`)
  }
}

const reloc: MagazineRelocation = {
  magazine_rfid: "E00401D003AFE0A5",
  source_region_code: "SH",
  source_site_code: "SH01",
  source_device_ip: "10.0.0.1",
  source_device_port: "8080",
  target_region_code: "BJ",
  target_site_code: "BJ02",
  target_device_ip: "10.0.0.2",
  target_device_port: null,
}

console.log("=== cage-move-slot-overlay self-check ===\n")

check(
  "RFID 字节对倒序",
  reverseMagazineRfidHexPairs("E00401D003AFE0A5") === "A5E0AF03D00104E0"
)
check(
  "RFID 变体含正反序",
  magazineRfidVariants("E00401D003AFE0A5").includes("A5E0AF03D00104E0")
)
check(
  "RFID 正反序互认",
  magazineRfidsMatch("E00401D003AFE0A5", "A5E0AF03D00104E0")
)

check(
  "目标设备匹配（port 空则只比 IP）",
  isRelocationTargetForDevice(reloc, {
    siteCode: "BJ02",
    deviceIp: "10.0.0.2",
    devicePort: "9999",
  })
)
check(
  "非目标站点不匹配",
  !isRelocationTargetForDevice(reloc, {
    siteCode: "SH01",
    deviceIp: "10.0.0.2",
  })
)

const found = findInboundRelocationForMagazine(
  [reloc],
  "A5E0AF03D00104E0",
  { siteCode: "BJ02", deviceIp: "10.0.0.2" }
)
check("入站登记可按反序 RFID 命中", !!found)

const history = indexHistoricalSlotsByOrder([
  {
    slot_index: 0,
    raw_data: { disc_type: 2, max_cap: 100, rest_cap: 10, slot_order: 0 },
    occupied: true,
    status: "used",
    media_id: "D1",
    capacity: "100",
  },
  {
    slot_index: 1,
    raw_data: { disc_type: 3, slot_order: 1 },
    occupied: true,
    status: "used",
    media_id: null,
    capacity: null,
  },
])

const overlaid0 = applyHistoricalSlotOverlay(
  {
    magazineRfid: "E00401D003AFE0A5",
    slotOrder: 0,
    rawData: { disc_type: 1, slot_order: 0, max_cap: 50 },
    occupied: true,
    status: "used",
    mediaId: null,
    capacity: "50",
  },
  history
)
check(
  "有历史时覆盖 disc_type 未刻→满盘",
  overlaid0.rawData?.disc_type === 2,
  `disc_type=${overlaid0.rawData?.disc_type}`
)
check(
  "有历史时覆盖容量字段",
  Number((overlaid0.rawData as Record<string, unknown>).max_cap) === 100 &&
    Number((overlaid0.rawData as Record<string, unknown>).rest_cap) === 10
)

const overlaidMissing = applyHistoricalSlotOverlay(
  {
    magazineRfid: "E00401D003AFE0A5",
    slotOrder: 9,
    rawData: { disc_type: 1, slot_order: 9 },
    occupied: true,
    status: "used",
    mediaId: null,
    capacity: null,
  },
  history
)
check(
  "无对应 slot_order 时保持当前新盘态",
  overlaidMissing.rawData?.disc_type === 1
)

const noOverlay = applyHistoricalSlotOverlay(
  {
    magazineRfid: "E00401D003AFE0A5",
    slotOrder: 0,
    rawData: { disc_type: 1 },
    occupied: true,
    status: "used",
    mediaId: null,
    capacity: null,
  },
  undefined
)
check("无登记映射时保持当前", noOverlay.rawData?.disc_type === 1)

console.log(`\n结果: ${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
