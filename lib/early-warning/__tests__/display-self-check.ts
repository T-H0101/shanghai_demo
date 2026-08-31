/**
 * Sprint R.101 — early warning display mapping self-check
 */
import assert from "node:assert/strict"
import {
  earlyWarningLevelLabel,
  earlyWarningStatusLabel,
  earlyWarningTypeLabel,
  mapEarlyWarningFeedbackRow,
  mapEarlyWarningRow,
} from "../../../lib/early-warning/display"

const mapped = mapEarlyWarningRow({
  source_site_id: "SH01",
  source_record_id: "103",
  src_warning_id: 103,
  warning_type: "0",
  warning_level: "3",
  message: "磁盘卷剩余空间偏低",
  triggered_at: "2026-08-25T16:00:01.000Z",
  status: 0,
  lib_id: null,
  raw_data: {},
})

assert.equal(mapped.typeLabel, earlyWarningTypeLabel(0))
assert.equal(mapped.levelLabel, earlyWarningLevelLabel(3))
assert.equal(mapped.statusLabel, earlyWarningStatusLabel(0))
assert.equal(mapped.title, "磁盘卷剩余空间偏低")

const fromRaw = mapEarlyWarningRow({
  source_site_id: "SH01",
  source_record_id: "1",
  raw_data: {
    id: 1,
    title: "from-raw",
    type: 2,
    s_level: 1,
    status: 2,
  },
})
assert.equal(fromRaw.title, "from-raw")
assert.equal(fromRaw.typeLabel, "设备异常")
assert.equal(fromRaw.levelLabel, "错误")
assert.equal(fromRaw.statusLabel, "已完成")

const fb = mapEarlyWarningFeedbackRow({
  source_site_id: "SH01",
  source_record_id: "4",
  warning_id: 2,
  feedback_text: "测试",
  user_name: "admin",
  feedback_at: "2026-07-24T10:03:49.000Z",
  raw_data: {},
})
assert.equal(fb.content, "测试")
assert.equal(fb.userName, "admin")
assert.equal(fb.warningId, 2)

console.log("PASS early-warning display mapping")
