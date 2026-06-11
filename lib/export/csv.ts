/**
 * CSV 序列化 (RFC 4180, UTF-8, CRLF)
 *
 * - 包含 " , 换行的单元格用 " 包裹, 内部 " 转为 ""
 * - null/undefined → 空串
 * - object/array → JSON.stringify (e.g. result_json jsonb 字段)
 * - Date → toISOString
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
  columns: Array<keyof Row & string>
): string {
  const header = columns.join(",")
  const body = rows.map((row) => columns.map((col) => csvCell(row[col])).join(","))
  return [header, ...body].join("\r\n")
}
