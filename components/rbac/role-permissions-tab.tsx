"use client"

/**
 * Rbac tab: 角色权限 (Role permissions)
 *
 * Sprint R.83.2 Task 6 — read-only view over /api/rbac/roles.
 * Source: center DB unified_roles / unified_role_fucs / unified_fucs / unified_user_mfas.
 *
 * The /api/rbac/roles route supports POST/PUT/DELETE for sync ingestion.
 * The UI is read-only display (no create/edit/delete buttons) per the spec.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"

interface RoleRecord {
  source_site_id?: string
  source_record_id?: string
  source_table?: string
  synced_at?: string
  raw_data?: Record<string, unknown>
}

interface RolesResponse {
  code: number
  data?: {
    items?: RoleRecord[]
    total?: number
    sourceTables?: string[]
  }
}


export function RolePermissionsTab() {
  const [items, setItems] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/rbac/roles?limit=100", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json: RolesResponse = await res.json()
      if (json.code !== 0) {
        throw new Error("API 返回非 0")
      }
      setItems(json.data?.items ?? [])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast({
        title: "加载角色权限失败",
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

  const renderRoleName = (raw: Record<string, unknown> | undefined): ReactNode => {
    if (!raw) return <span className="text-slate-400">—</span>
    if (raw.role_name) return String(raw.role_name)
    if (raw.name) return String(raw.name)
    if (raw.display_name) return String(raw.display_name)
    return <span className="text-slate-400">—</span>
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>角色权限 ({items.length})</span>
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
              data-testid="rbac-roles-refresh"
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
                <TableHead>角色名</TableHead>
                <TableHead>启用</TableHead>
                <TableHead>同步时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`role-${it.source_record_id ?? idx}`}>
                  <TableCell className="font-mono text-xs">
                    {it.source_site_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {renderRoleName(it.raw_data)}
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
              </CardContent>
    </Card>
  )
}
