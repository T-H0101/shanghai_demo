/**
 * 导出审计 — 把每次成功导出写入 audit_log
 *
 * Sprint R.13: 复用现有 audit_log 表, 不新建 export_log.
 *   action       = 'export'
 *   target_table = exportType (e.g. 'devices', 'sync_package')
 *   target_id    = filename (含 timestamp, 唯一)
 *   after_json   = manifest (完整摘要)
 *   site_code    = siteCode || '__ALL__'
 *   actor        = 'system' (ADFS 未接入)
 *   result       = 'success'
 *   command_no   = "EXPORT-" + sha256 前 8 字符 (+ timestamp 避碰)
 *
 * 失败不写: 避免污染 audit_log (route handler 的 try/catch 已记 console.error).
 * 写入失败也不影响导出本身, 仅 console.warn.
 */

import { query } from "@/lib/db"
import type { ExportManifest } from "./manifest"

export async function recordExport(manifest: ExportManifest): Promise<{ ok: boolean; commandNo: string | null }> {
  const commandNo = `EXPORT-${manifest.sha256.slice(0, 8) || "noop"}-${Date.now().toString(36)}`
  try {
    await query(
      `INSERT INTO audit_log (
        command_no, action, target_table, target_id,
        after_json, site_code, actor, result
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        commandNo,
        "export",
        manifest.exportType,
        manifest.filename,
        JSON.stringify(manifest),
        manifest.siteCode || "__ALL__",
        "system", // ADFS 未接入, R.1 §7 不伪造用户身份
        "success",
      ]
    )
    return { ok: true, commandNo }
  } catch (err) {
    // 审计写入失败不能拖累导出本身 (导出已 200 返回)
    console.warn("[export/audit] recordExport failed:", err)
    return { ok: false, commandNo: null }
  }
}
