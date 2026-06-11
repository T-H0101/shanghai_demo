/**
 * XLSX 实现状态 (Sprint R.13)
 *
 * 决策: 不在 R.13 接 XLSX 真实实现.
 *
 * 理由 (CLAUDE.md 核心约束 + R.1 §7):
 *  1. 项目无 xlsx / exceljs 依赖, 引入需领导决策 (Excel 库 ~700KB-1.1MB)
 *  2. R.1 §7 禁止伪造: 不允许用 .xlsx 文件名包 CSV/JSON 内容
 *  3. requirements.md §5.1 仅要求"Excel/CSV/JSON 三选", CSV/JSON 已真实
 *
 * 当前行为: 返回 ExportResult { status: 501, code: 'not_implemented' }
 * 由 toNextResponse() 翻译为 HTTP 501 + 显式 message.
 *
 * 后续 Sprint 候选 (R.14+):
 *  - 引入 exceljs 依赖, 走真实 XLSX 流式生成
 *  - 或基于 OOXML zip 自实现 (Node.js 内置无 zip, 需引 archiver)
 *  - 任一方向都需先解禁 dependency policy
 */

import type { ExportInput, ExportResult } from "./index"
import { buildManifest } from "./manifest"

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
