/**
 * 卷分配介质分组 — 纯函数自检（无 DB）
 */
import {
  groupVolumeMediaRows,
} from "@/lib/volumes/media-allocation"

function check(name: string, ok: boolean, detail?: string) {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`)
  }
}

const optical = groupVolumeMediaRows([
  {
    slot_id: "10",
    on_line: 1,
    slot_num: 1, // 卷内序号，不应覆盖 slot_order
    slot_code: null,
    slot_index: 35, // slot_order → 展示 36
    disc_type_raw: 3,
    mag_rfid: "E0040150F6E89D76",
    device_id: "1",
    device_name: "152库",
    device_type: "gen3_library",
    ip_address: "10.0.0.1",
    device_raw: { port: "5000" },
    via_hd: false,
  },
  {
    slot_id: "11",
    on_line: 1,
    slot_num: 2,
    slot_code: null,
    slot_index: 36,
    disc_type_raw: 1,
    mag_rfid: "E0040150F6E89D76",
    device_id: "1",
    device_name: "152库",
    device_type: "gen3_library",
    ip_address: "10.0.0.1",
    device_raw: { port: "5000" },
    via_hd: false,
  },
])

check("光库一组", optical.length === 1, `n=${optical.length}`)
check("光库标题含 RFID", !!optical[0]?.title.includes("E0040150F6E89D76"), optical[0]?.title)
check("光库标题不含 IP 优先", !optical[0]?.title.includes("10.0.0.1"), optical[0]?.title)
check("光库格子 2", optical[0]?.mediaCount === 2)
check(
  "光库盘号用 slot_order+1 而非 slot_num",
  optical[0]?.cells.map((c) => c.displayNo).join(",") === "36,37",
  optical[0]?.cells.map((c) => c.displayNo).join(","),
)

const hdd = groupVolumeMediaRows([
  {
    slot_id: "1000000",
    on_line: 1,
    slot_num: 1, // 卷内 1，应被 slot_order 覆盖
    slot_code: "ZJ0HD0900000001",
    slot_index: 5, // → 展示 6
    disc_type_raw: 1,
    mag_rfid: "emx801-1",
    device_id: "3",
    device_name: "虚拟硬盘库",
    device_type: "hdd_library",
    ip_address: "127.0.0.1",
    device_raw: { port: "2002" },
    via_hd: true,
  },
])

check("硬盘库一组", hdd.length === 1)
check(
  "硬盘标题用 IP:port 不用 RFID",
  !!hdd[0]?.title.includes("127.0.0.1:2002") && !hdd[0]?.title.includes("emx801"),
  hdd[0]?.title,
)
check("硬盘 mediaKind=disk", hdd[0]?.mediaKind === "disk")
check(
  "硬盘盘号用 slot_order+1 而非 slot_num",
  hdd[0]?.cells[0]?.displayNo === 6,
  `displayNo=${hdd[0]?.cells[0]?.displayNo}`,
)

const fallback = groupVolumeMediaRows([
  {
    slot_id: "x",
    on_line: 1,
    slot_num: 9,
    slot_code: null,
    slot_index: null,
    disc_type_raw: null,
    mag_rfid: null,
    device_id: null,
    device_name: "未知设备",
    device_type: null,
    ip_address: null,
    device_raw: null,
    via_hd: false,
  },
])
check(
  "无 slot_order 时回退 slot_num",
  fallback[0]?.cells[0]?.displayNo === 9,
  `displayNo=${fallback[0]?.cells[0]?.displayNo}`,
)

if (process.exitCode) {
  console.error("self-check failed")
  process.exit(1)
}
console.log("volume media-allocation self-check ok")
