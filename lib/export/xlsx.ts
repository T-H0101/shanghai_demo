import ExcelJS from "exceljs"
import type { ExportInput, ExportResult } from "./index"
import { buildManifest } from "./manifest"
import { sanitizeRows } from "./sanitize"
import { contentSha256 } from "./sha256"

export function xlsxNotImplemented<Row extends Record<string, unknown>>(
  input: ExportInput<Row>
): ExportResult {
  const manifest = buildManifest({
    exportType: input.exportType,
    format: "xlsx",
    dataSource: input.dataSource,
    rowCount: 0,
    sha256: "",
    filename: "",
    siteCode: input.siteCode ?? null,
    filters: { ...(input.filters ?? {}), status: "not_implemented" },
  })
  return {
    status: 501,
    body: JSON.stringify({
      code: 501,
      message: "XLSX 导出未接入: 项目无 xlsx/exceljs 依赖, R.13 标记 blocked_by_dependency_policy。请选 csv 或 json 格式。",
      dataSource: "not_implemented",
      requirement: { id: "REQ-5.1.2", status: "partial" },
    }),
    contentType: "application/json; charset=utf-8",
    filename: "",
    sha256: "",
    rowCount: 0,
    manifest,
    code: "not_implemented",
  }
}

export async function buildXlsxExport<Row extends Record<string, unknown>>(
  input: ExportInput<Row>
): Promise<ExportResult> {
  const cleanRows = sanitizeRows(input.rows, input.columns)
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const scope = (input.siteCode && input.siteCode.trim()) || "all-sites"
  const prefix = input.filenamePrefix ?? input.exportType
  const filename = `${prefix}-${scope}-${timestamp}.xlsx`

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "unified-disc-platform"
  workbook.created = new Date()
  const sheet = workbook.addWorksheet("Export")

  sheet.columns = input.columns.map((column) => ({
    header: column,
    key: column,
    width: Math.max(column.length + 4, 16),
  }))
  for (const row of cleanRows) {
    sheet.addRow(
      input.columns.reduce<Record<string, unknown>>((acc, column) => {
        acc[column] = row[column] ?? ""
        return acc
      }, {})
    )
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }]

  const body = Buffer.from(await workbook.xlsx.writeBuffer())
  const sha256 = contentSha256(body)
  const signingKeyRef = process.env.EXPORT_SIGNING_KEY_REF?.trim() || null
  const manifest = buildManifest({
    exportType: input.exportType,
    format: "xlsx",
    dataSource: input.dataSource,
    rowCount: cleanRows.length,
    sha256,
    filename,
    siteCode: input.siteCode ?? null,
    filters: input.filters ?? {},
    signature: signingKeyRef
      ? { status: "configured", keyRef: signingKeyRef, algorithm: "rsa-sha256" }
      : { status: "blocked_by_config", keyRef: null, algorithm: "rsa-sha256" },
  })

  return {
    status: 200,
    body,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename,
    sha256,
    rowCount: cleanRows.length,
    manifest,
    code: "ok",
  }
}
