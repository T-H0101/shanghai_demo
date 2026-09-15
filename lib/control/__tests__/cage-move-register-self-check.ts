/**
 * 盘笼再迁纯函数自检（无 DB）
 * 运行: pnpm exec tsx lib/control/__tests__/cage-move-register-self-check.ts
 */

import { relocationFilterFromRegion } from "@/lib/search/hit-enrichment"
import type { MagazineRelocation } from "@/lib/control/cage-move-register"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const relocs: MagazineRelocation[] = [
  {
    magazine_rfid: "A1",
    source_region_code: "SH",
    source_site_code: "SH01",
    source_device_ip: "10.0.0.1",
    source_device_port: null,
    target_region_code: "NT",
    target_site_code: null,
    target_device_ip: null,
    target_device_port: null,
  },
  {
    magazine_rfid: "B2",
    source_region_code: "NT",
    source_site_code: null,
    source_device_ip: null,
    source_device_port: null,
    target_region_code: "BJ",
    target_site_code: null,
    target_device_ip: null,
    target_device_port: null,
  },
]

const nt = relocationFilterFromRegion(relocs, "NT", ["NT01"])
assert(nt.inboundRfids.includes("A1"), "A1 inbound NT")
assert(nt.outboundRfids.includes("B2"), "B2 outbound NT via source_region")
assert(!nt.outboundRfids.includes("A1"), "A1 not outbound NT")

const bj = relocationFilterFromRegion(relocs, "BJ", [])
assert(bj.inboundRfids.includes("B2"), "B2 inbound BJ")
assert(bj.outboundRfids.length === 0, "BJ no outbound")

console.log("cage-move-register-self-check: ok")
