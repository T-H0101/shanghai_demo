/**
 * 统一导出框架 (Sprint R.13)
 *
 * 提供单一 buildExport() 入口, 由 csv/json/xlsx 子模块产出带 SHA-256
 * 摘要的 ExportResult, 调用方 (route handler) 用 toNextResponse() 统一返回.
 *
 * 约束 (R.1):
 *  - 不允许 mock 数据, 调用方负责真实 DB 查询
 *  - SHA-256 仅作完整性摘要, 不是数字签名 (无证书)
 *  - 默认 sanitize 字段名包含 password/secret/token/auth 的内容
 *  - 必须 dataSource = database | empty | error, 禁止 mock
 *  - XLSX 当前未接入 (零依赖政策, blocked_by_dependency_policy)
 */

import { csvFromRows } from "./csv"
import { jsonFromRows } from "./json"
import { xlsxNotImplemented } from "./xlsx"
import { sanitizeRows } from "./sanitize"
import { contentSha256 } from "./sha256"
import { buildManifest, type ExportManifest } from "./manifest"

export type ExportFormat = "csv" | "json" | "xlsx"

export interface ExportInput<Row extends Record<string, unknown>> {
  /** 导出对象标识 (e.g. devices, logs, sync_package) */
  exportType: string
  /** 源数据库表/视图名, 写到 manifest.dataSource */
  dataSource: string
  /** 目标格式 */
  format: ExportFormat
  /** 列顺序, 决定 CSV 表头和 JSON 字段次序 */
  columns: Array<keyof Row & string>
  /** 已查询的真实数据行 (调用方负责 DB 查询) */
  rows: Row[]
  /** siteCode 过滤参数, 写到 manifest.siteCode 和文件名 */
  siteCode?: string | null
  /** 额外的过滤参数, 写到 manifest.filters (不允许包含 secret) */
  filters?: Record<string, string | null | undefined>
  /** 自定义文件名前缀, 默认 = exportType */
  filenamePrefix?: string
}

export interface ExportResult {
  status: 200 | 501
  body: string | Buffer
  contentType: string
  filename: string
  sha256: string
  rowCount: number
  manifest: ExportManifest
  /** 错误情况下的 code, success 时为 ok */
  code: "ok" | "not_implemented"
}

/**
 * 统一导出入口 — 一律返回 ExportResult, 由 route handler 用 toNextResponse() 包装.
 *
 * 不允许在这里访问数据库, rows 必须是 route 已查好的真实数据.
 * sanitize 在框架内强制执行, 调用方无法绕过.
 */
export function buildExport<Row extends Record<string, unknown>>(
  input: ExportInput<Row>
): ExportResult {
  // XLSX 决策 (R.13): 不引入重依赖, 显式 not_implemented
  if (input.format === "xlsx") {
    return xlsxNotImplemented(input)
  }

  // sanitize: 框架兜底, 去掉 password/secret/token/auth/database_url 等字段
  const cleanRows = sanitizeRows(input.rows, input.columns)

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const scope = (input.siteCode && input.siteCode.trim()) || "all-sites"
  const prefix = input.filenamePrefix ?? input.exportType
  const ext = input.format
  const filename = `${prefix}-${scope}-${timestamp}.${ext}`

  let body: string
  let contentType: string
  if (input.format === "json") {
    body = jsonFromRows(input.exportType, input.dataSource, cleanRows, input.columns, input.siteCode ?? null)
    contentType = "application/json; charset=utf-8"
  } else {
    body = csvFromRows(cleanRows, input.columns)
    contentType = "text/csv; charset=utf-8"
  }

  const sha256 = contentSha256(body)
  const manifest = buildManifest({
    exportType: input.exportType,
    format: input.format,
    dataSource: input.dataSource,
    rowCount: cleanRows.length,
    sha256,
    filename,
    siteCode: input.siteCode ?? null,
    filters: input.filters ?? {},
  })

  return {
    status: 200,
    body,
    contentType,
    filename,
    sha256,
    rowCount: cleanRows.length,
    manifest,
    code: "ok",
  }
}

/**
 * 统一头部生成器 — 三个旧端点用过 3 种不一致命名, R.13 起一律用 x-* 小写.
 *
 * 兼容性: 同时输出旧名 (x-content-sha256, x-export-record-count) + 新名 (x-sha256, x-record-count)
 * 旧 e2e (test-racks/test-sync) 无需修改即可继续工作.
 *
 * - x-data-source: 真实表名 (不允许 'mock')
 * - x-record-count / x-export-record-count: 行数 (新/旧)
 * - x-sha256 / x-content-sha256: 64 hex 完整性摘要 (新/旧, R.1 §7 不能写 signature)
 * - x-export-type: exportType
 * - x-export-format: csv/json
 * - x-export-kind: exportType (旧 sync 端点用 x-export-kind 也保留)
 * - x-manifest: base64 编码的 manifest JSON
 */
export function exportHeaders(result: ExportResult): Record<string, string> {
  const manifestB64 = Buffer.from(JSON.stringify(result.manifest), "utf8").toString("base64")
  return {
    "content-type": result.contentType,
    "content-disposition": `attachment; filename="${result.filename}"`,
    "cache-control": "no-store",
    "x-data-source": result.manifest.dataSource,
    "x-export-type": result.manifest.exportType,
    "x-export-kind": result.manifest.exportType, // 旧 sync 端点 header 名兼容
    "x-export-format": result.manifest.format,
    "x-record-count": String(result.rowCount),
    "x-export-record-count": String(result.rowCount), // 旧 racks/sync e2e 兼容
    "x-sha256": result.sha256,
    "x-content-sha256": result.sha256, // 旧 racks/sync e2e 兼容
    "x-manifest": manifestB64,
  }
}

export type { ExportManifest } from "./manifest"
