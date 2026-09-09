/**
 * 盘位 A/B 展示 — 纯函数自检（无 DB）
 * 运行: pnpm exec tsx lib/devices/__tests__/disc-slot-display-self-check.ts
 */

import {
  displaySlotIndex,
  displaySlotLabel,
  formatDiscSideSuffix,
  isDualSidedMagazine,
} from "../disc-slot-display"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(displaySlotIndex(0) === 1, "slot_order 0 → 1")
assert(displaySlotIndex(3) === 4, "slot_order 3 → 4")

assert(isDualSidedMagazine({ magDiscType: 8 }), "disc_type 8 = 双面")
assert(isDualSidedMagazine({ discTypeSide: 2 }), "disc_side 2 = 双面")
assert(!isDualSidedMagazine({ magDiscType: 1, discTypeSide: 1 }), "单面")

assert(formatDiscSideSuffix(0, true) === "A", "side 0 → A")
assert(formatDiscSideSuffix(1, true) === "B", "side 1 → B")
assert(formatDiscSideSuffix(0, false) === "", "单面无后缀")

assert(displaySlotLabel(0, { magDiscType: 1 }) === "1", "单面 1")
assert(displaySlotLabel(1, { magDiscType: 1 }) === "2", "单面 2")
assert(
  displaySlotLabel(0, { magDiscType: 8, discSide: 0 }) === "1A",
  "双面 1A",
)
assert(
  displaySlotLabel(0, { magDiscType: 8, discSide: 1 }) === "1B",
  "双面 1B",
)
assert(
  displaySlotLabel(1, { discTypeSide: 2, discSide: 0 }) === "2A",
  "类型表双面 2A",
)
assert(
  displaySlotLabel(1, { discTypeSide: 2, discSide: 1 }) === "2B",
  "类型表双面 2B",
)

console.log("disc-slot-display-self-check: ok")
