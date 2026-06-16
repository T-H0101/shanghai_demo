"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Database, Download, ShieldAlert, UserRound, Users } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"

interface UserRecord {
  id: string
  sourceSiteId: string
  sourceTable: string
  sourceId: string
  userId: string | null
  username: string | null
  displayName: string | null
  status: string | null
  role: string | null
  department: string | null
  phone: string | null
  email: string | null
  createdAt: string
}

type DataSource = "database" | "empty" | "error"

export default function Page() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>("empty")
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx">("csv")

  const handleExport = async () => {
    setExporting(true)
    try {
      const sp = new URLSearchParams({ format: exportFormat })
      const response = await fetch(`/api/users/export?${sp.toString()}`)
      if (response.status === 501) {
        const body = await response.json().catch(() => null)
        const msg = body?.message ?? "Excel 暂未接入, 请选择 CSV 或 JSON"
        toast({ title: "导出格式暂未接入", description: msg, variant: "destructive" })
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const sha256 = response.headers.get("x-sha256") ?? ""
      const recordCount = response.headers.get("x-record-count") ?? "0"
      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") ?? ""
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `users.${exportFormat}`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)

      toast({
        title: "导出完成",
        description: `${recordCount} 条真实账号, SHA-256 摘要已生成 (${sha256.slice(0, 12)}…)`,
      })
    } catch {
      toast({
        title: "账号导出失败",
        description: "未生成本地替代数据，请检查中心库连接后重试。",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      try {
        const response = await fetch("/api/users?pageSize=100", { cache: "no-store" })
        const body = await response.json()
        if (!response.ok || body.source !== "database") {
          throw new Error(body.message ?? "用户数据读取失败")
        }

        const items: UserRecord[] = body.data?.items ?? []
        if (cancelled) return
        setUsers(items)
        setSelected(items[0] ?? null)
        setDataSource(items.length > 0 ? "database" : "empty")
      } catch (loadError) {
        if (cancelled) return
        setUsers([])
        setSelected(null)
        setDataSource("error")
        setError(loadError instanceof Error ? loadError.message : "用户数据读取失败")
      }
    }

    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const siteCount = useMemo(
    () => new Set(users.map((user) => user.sourceSiteId)).size,
    [users]
  )
  const statusCount = useMemo(
    () => new Set(users.map((user) => user.status).filter(Boolean)).size,
    [users]
  )
  const mappedRoleCount = users.filter((user) => Boolean(user.role)).length

  return (
    <AppShell>
      <PageHeader
        title="用户与权限"
        description="中心库账号只读视图；认证、生命周期与权限分配尚未接入"
        badge={dataSource === "database" ? "DATABASE" : dataSource.toUpperCase()}
        actions={
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as typeof exportFormat)}>
              <SelectTrigger className="h-8 w-[100px]" data-testid="users-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="xlsx">XLSX (未接入)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void handleExport()}
              disabled={exporting || dataSource === "error"}
              data-testid="users-export"
            >
              <Download className="mr-1 h-4 w-4" />
              {exporting ? "导出中" : `导出 ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">认证与权限写能力 blocked_by_auth</p>
            <p className="mt-1 text-xs">
              账号创建、启用、禁用、删除、密码重置、权限分配与跨站点权限同步均未实现。
              当前仅展示 unified_users 已同步字段，不把前端 local state 冒充真实操作。
            </p>
          </div>
        </div>
      </div>

      {dataSource === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error ?? "中心库用户数据读取失败"}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="中心库账号" value={users.length} icon={Users} />
        <StatCard title="来源站点" value={siteCount} icon={Database} />
        <StatCard title="有角色编码" value={mappedRoleCount} icon={UserRound} />
        <StatCard title="状态种类" value={statusCount} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
        <Card className="gap-0 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>用户列表</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                source: {dataSource}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
            {dataSource === "empty" ? (
              <p className="py-8 text-center text-sm text-slate-500">
                unified_users 当前为空，不使用 mock 数据填充。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>账号</TableHead>
                    <TableHead>来源站点</TableHead>
                    <TableHead>角色编码</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user, idx) => (
                    <TableRow
                      key={`user-${user.id}-${idx}`}
                      className={`cursor-pointer ${selected?.id === user.id ? "bg-blue-50" : ""}`}
                      onClick={() => setSelected(user)}
                    >
                      <TableCell>
                        <p className="text-sm font-medium">
                          {user.displayName || user.username || "未命名账号"}
                        </p>
                        <p className="text-xs text-slate-400">{user.username ?? "—"}</p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{user.sourceSiteId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role ?? "未映射"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.department ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={user.status ? "secondary" : "outline"}>
                          {user.status ?? "未知"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <DetailPanel
          title="账号详情"
          subtitle={selected?.displayName || selected?.username || undefined}
          empty={!selected}
        >
          {selected && (
            <div className="space-y-1">
              <DetailRow label="来源站点" value={selected.sourceSiteId} />
              <DetailRow label="源表" value={selected.sourceTable} />
              <DetailRow label="源记录 ID" value={selected.sourceId} />
              <DetailRow label="用户 ID" value={selected.userId ?? "—"} />
              <DetailRow label="用户名" value={selected.username ?? "—"} />
              <DetailRow label="显示名" value={selected.displayName ?? "—"} />
              <DetailRow label="角色编码" value={selected.role ?? "未映射"} />
              <DetailRow label="部门" value={selected.department ?? "—"} />
              <DetailRow label="电话" value={selected.phone ?? "—"} />
              <DetailRow label="邮箱" value={selected.email ?? "—"} />
              <DetailRow label="同步时间" value={formatTime(selected.createdAt)} />
              <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                站点多对多关系、设备/数据权限树与账号生命周期需真实 Auth/RBAC 服务，
                当前不推断、不模拟。
              </div>
            </div>
          )}
        </DetailPanel>
      </div>
    </AppShell>
  )
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN")
}
