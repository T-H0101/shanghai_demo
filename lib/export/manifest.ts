/**
 * Export manifest — 单次导出的元数据 snapshot.
 *
 * 用途:
 *  - 写入 audit_log.after_json (R.13 导出审计)
 *  - 编码为 x-manifest 响应头 (base64), 让前端/审计工具能取回
 *  - e2e 校验 (dataSource/sha256/rowCount 三者必须出现)
 *
 * 不包含: 密码 / secret / 数据库连接串 — sanitize 在 lib/export/sanitize.ts 完成
 */

import type { ExportFormat } from "./index"

export interface ExportManifest {
  exportType: string
  format: ExportFormat
  dataSource: string
  rowCount: number
  sha256: string
  filename: string
  siteCode: string | null
  filters: Record<string, string | null | undefined>
  generatedAt: string
  generator: string
}

export function buildManifest(input: {
  exportType: string
  format: ExportFormat
  dataSource: string
  rowCount: number
  sha256: string
  filename: string
  siteCode: string | null
  filters: Record<string, string | null | undefined>
}): ExportManifest {
  return {
    exportType: input.exportType,
    format: input.format,
    dataSource: input.dataSource,
    rowCount: input.rowCount,
    sha256: input.sha256,
    filename: input.filename,
    siteCode: input.siteCode,
    filters: input.filters,
    generatedAt: new Date().toISOString(),
    generator: "unified-disc-platform/lib/export@R.13",
  }
}
