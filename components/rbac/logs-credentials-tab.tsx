"use client"

/**
 * Rbac tab: 日志与凭据 (Logs and credentials)
 *
 * Sprint R.83.2 Task 6 — read-only view over /api/rbac/logs.
 * Source: center DB unified_sys_logs / unified_api_logs / unified_api_interfaces.
 *
 * The /api/rbac/logs route is read-only (no POST/PUT/DELETE).
 * The UI is also read-only display per the spec.
 */

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"

interface LogRecord {
  source_site_id?: string
  source_record_id?: string
  source_table?: string
  synced_at?: string
  raw_data?: Record<string, unknown>
}

interface LogsResponse {
  code: number
  data?: {
    items?: LogRecord[]
    total?: number
    sourceTables?: string[]
  }
}

const SOURCE_TABLES = [
  "unified_sys_logs",
  "unified_api_logs",
  "unified_api_interfaces",
]

export function LogsCredentialsTab() {
  const [items, setItems] = useState<LogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/rbac/logs?limit=100", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json: LogsResponse = await res.json()
      if (json.code !== 0) {
        throw new Error("API 返回非 0")
      }
      setItems(json.data?.items ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast({
        title: "加载日志失败",
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

  const renderLevel = (raw: Record<string, unknown> | undefined) => {
    const level = (raw?.log_level as string) ?? (raw?.level as string) ?? "—"
    const variant = level === "ERROR" || level === "error"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : level === "WARN" || level === "warning"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : level === "INFO" || level === "info"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
    return (
      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${variant}`}>
        {level}
      </span>
    )
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>日志与凭据 ({items.length})</span>
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
              data-testid="rbac-logs-refresh"
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
                <TableHead>日志级别</TableHead>
                <TableHead>模块</TableHead>
                <TableHead>消息</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`log-${it.source_record_id ?? idx}`}>
                  <TableCell className="font-mono text-xs">
                    {it.source_site_id ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {it.source_record_id ?? "—"}
                  </TableCell>
                  <TableCell>{renderLevel(it.raw_data)}</TableCell>
                  <TableCell className="text-sm">
                    {(it.raw_data?.module as string) ??
                      (it.raw_data?.category as string) ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-slate-600 dark:text-slate-400">
                    <span className="line-clamp-2">
                      {(it.raw_data?.message as string) ??
                        (it.raw_data?.msg as string) ??
                        (it.raw_data?.content as string) ?? "—"}
                    </span>
                  </TableCell>
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
