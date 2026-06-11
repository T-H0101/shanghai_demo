/**
 * JSON 序列化
 *
 * 输出结构 (R.13 稳定 schema, 同时输出 items + data 两个别名以兼容旧 e2e):
 *   {
 *     exportType: string,        // R.13: 标识导出对象 (e.g. devices)
 *     dataSource: string,        // 真实表名
 *     siteCode: string | null,   // 全站为 null
 *     count: number,             // = items.length
 *     columns: string[],         // 列名顺序
 *     items: Row[],              // R.13 新名 (主)
 *     data: Row[]                // R.13 兼容别名 (旧 sync/export e2e 依赖 exportJson.data)
 *   }
 *
 * Date → toISOString (JSON.stringify 默认行为, 在此明确)
 */

export function jsonFromRows<Row extends Record<string, unknown>>(
  exportType: string,
  dataSource: string,
  rows: Row[],
  columns: Array<keyof Row & string>,
  siteCode: string | null
): string {
  // 强制按 columns 顺序裁剪, 避免泄漏 SELECT * 拉来的额外字段
  const items = rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const col of columns) {
      const v = row[col]
      out[col] = v instanceof Date ? v.toISOString() : v
    }
    return out
  })
  return JSON.stringify({
    exportType,
    dataSource,
    siteCode,
    count: items.length,
    columns,
    items,
    data: items, // R.13 旧 e2e 兼容: 旧 sync/export 用 exportJson.data
  }, null, 2)
}
