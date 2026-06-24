"use client"

/**
 * Rbac tab: 字典 (Dictionaries)
 *
 * Sprint R.83.2 Task 6 — read-only view over /api/rbac/dicts.
 * Source: center DB unified_dict_categories / unified_dicts / unified_dict_items /
 *         unified_archives_types / unified_archives_levels / unified_platform_types.
 *
 * The /api/rbac/dicts route supports POST/PUT/DELETE for sync ingestion.
 * The UI is read-only display (no create/edit/delete buttons) per the spec.
 */

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"

interface DictRecord {
  source_site_id?: string
  source_record_id?: string
  source_table?: string
  synced_at?: string
  raw_data?: Record<string, unknown>
}

interface DictsResponse {
  code: number
  data?: {
    items?: DictRecord[]
    total?: number
    sourceTables?: string[]
  }
}

const SOURCE_TABLES = [
  "unified_dict_categories",
  "unified_dicts",
  "unified_dict_items",
  "unified_archives_types",
  "unified_archives_levels",
  "unified_platform_types",
]

export function DictionariesTab() {
  const [items, setItems] = useState<DictRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/rbac/dicts?limit=100", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json: DictsResponse = await res.json()
      if (json.code !== 0) {
        throw new Error("API 返回非 0")
      }
      setItems(json.data?.items ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast({
        title: "加载字典失败",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const renderEnabled = (raw: Record<string, unknown> | undefined) => {
    const enabled = raw?.enabled ?? raw?.is_active ?? raw?.status
    if (enabled === true || enabled === "1" || enabled === "active" || enabled === 1) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs">
          启用
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs">
        {String(enabled ?? "—")}
      </Badge>
    )
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>字典 ({items.length})</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {loading ? "加载中" : error ? "异常" : "实时"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void load()}
              disabled={loading}
              data-testid="rbac-dicts-refresh"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            暂无数据。从 /sites 触发同步后会显示。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>站点</TableHead>
                <TableHead>源记录 ID</TableHead>
                <TableHead>字典名</TableHead>
                <TableHead>字典值</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>同步时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`dict-${it.source_record_id ?? idx}`}>
                  <TableCell className="font-mono text-xs">
                    {it.source_site_id ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {it.source_record_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(it.raw_data?.dict_name as string) ??
                      (it.raw_data?.name as string) ??
                      (it.raw_data?.display_name as string) ?? (
                        <span className="text-slate-400">—</span>
                      )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(it.raw_data?.dict_value as string) ??
                      (it.raw_data?.value as string) ??
                      (it.raw_data?.code as string) ?? "—"}
                  </TableCell>
                  <TableCell>{renderEnabled(it.raw_data)}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {it.synced_at ? formatBeijingTime(it.synced_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          数据来源: {SOURCE_TABLES.join(" / ")}
        </p>
      </CardContent>
    </Card>
  )
}
