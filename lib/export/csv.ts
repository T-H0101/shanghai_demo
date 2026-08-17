/**
 * CSV 序列化 (RFC 4180, UTF-8, CRLF)
 *
 * - 包含 " , 换行的单元格用 " 包裹, 内部 " 转为 ""
 * - null/undefined → 空串
 * - object/array → JSON.stringify (e.g. result_json jsonb 字段)
 * - Date → toISOString
 * - 可选 headers：展示表头（中文等）；缺省则用 columns 字段名
 */

export function csvCell(value: unknown): string {
  if (value == null) return ""
  let text: string
  if (value instanceof Date) text = value.toISOString()
  else if (typeof value === "object") text = JSON.stringify(value)
  else text = String(value)
  // RFC 4180: 含特殊字符必须用 " 包裹, " 自身用 "" 转义
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvFromRows<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: Array<keyof Row & string>,
  headers?: string[],
): string {
  const headerCols =
    headers && headers.length === columns.length
      ? headers
      : (columns as string[])
  const header = headerCols.map((h) => csvCell(h)).join(",")
  const body = rows.map((row) => columns.map((col) => csvCell(row[col])).join(","))
  // Excel 打开中文表头更稳：UTF-8 BOM
  return `\uFEFF${[header, ...body].join("\r\n")}`
}
