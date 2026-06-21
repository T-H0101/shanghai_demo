"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { AlertTriangle, Database, Download, Lock, LockOpen, ShieldAlert, UserRound, Users } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"

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

// Sprint R.27/R.28: Auth 账号接口
interface AuthAccount {
  id: string
  username: string
  display_name: string | null
  role: string
  department: string | null
  accessible_sites: string[] | null
  status: string
  failed_attempts: number
  locked_until: string | null
  last_login_at: string | null
  created_at: string
}

export default function Page() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [dataSource, setDataSource] = useState<DataSource>("empty")
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "xlsx">("csv")

  // Sprint R.27: Auth 账号状态
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>([])
  const [authTab, setAuthTab] = useState<"unified" | "auth">("unified")
  const [unlocking, setUnlocking] = useState<string | null>(null)

  const loadAuthAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/accounts?limit=100", { cache: "no-store" })
      if (!res.ok) return
      const json = await res.json()
      setAuthAccounts(json.data?.items ?? [])
    } catch {
      // Auth schema may not exist yet
    }
  }, [])

  useEffect(() => {
    loadAuthAccounts()
  }, [loadAuthAccounts])

  const handleUnlock = async (accountId: string, username: string) => {
    setUnlocking(accountId)
    try {
      const res = await fetch(`/api/auth/accounts/${accountId}/unlock`, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "解锁成功", description: `账号 ${username} 已解锁` })
      await loadAuthAccounts()
    } catch (e) {
      toast({ title: "解锁失败", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setUnlocking(null)
    }
  }

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
        description="账号只读视图；认证、生命周期与权限分配按接入状态展示"
        badge={dataSource === "database" ? "实时" : dataSource === "empty" ? "暂无数据" : dataSource === "error" ? "异常" : "加载中"}
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

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">认证与权限写能力部分可用</p>
            <p className="mt-1 text-xs">
              账号管理已接入查看、启用、禁用、解锁和重置密码。
              权限分配与跨站点权限同步仍待接入。
            </p>
          </div>
        </div>
      </div>

      {dataSource === "error" && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error ?? "中心库用户数据读取失败"}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="平台账号" value={users.length} icon={Users} />
        <StatCard title="来源站点" value={siteCount} icon={Database} />
        <StatCard title="有角色编码" value={mappedRoleCount} icon={UserRound} />
        <StatCard title="Auth 账号" value={authAccounts.length} icon={Lock} />
      </div>

      <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "unified" | "auth")}>
        <TabsList className="h-9">
          <TabsTrigger value="unified" className="text-xs">统一用户视图</TabsTrigger>
          <TabsTrigger value="auth" className="text-xs">Auth 账号管理</TabsTrigger>
        </TabsList>

        <TabsContent value="unified" className="mt-4">
      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
        <Card className="gap-0 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>用户列表</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {dataSource === "database" ? "实时" : dataSource === "empty" ? "暂无数据" : dataSource === "error" ? "异常" : "加载中"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-0">
            {dataSource === "empty" ? (
              <p className="py-8 text-center text-sm text-slate-500">
                当前暂无用户数据，不使用演示数据填充。
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
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selected?.id === user.id ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
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
              <div className="mt-4 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                站点多对多关系、设备/数据权限树与账号生命周期需真实 Auth/RBAC 服务，
                当前不推断、不模拟。
              </div>
            </div>
          )}
        </DetailPanel>
      </div>
        </TabsContent>

        <TabsContent value="auth" className="mt-4">
          <Card className="gap-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>Auth 账号列表</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {authAccounts.length} 个账号
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto pt-0">
              {authAccounts.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  auth_accounts 当前为空，请先登录以初始化 schema。
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>用户名</TableHead>
                      <TableHead>显示名</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>失败次数</TableHead>
                      <TableHead>最近登录</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authAccounts.map((acc, idx) => {
                      const isLocked = acc.status === "locked" || (acc.locked_until && new Date(acc.locked_until).getTime() > Date.now())
                      return (
                        <TableRow key={`auth-${acc.id}-${idx}`}>
                          <TableCell className="font-mono text-sm">{acc.username}</TableCell>
                          <TableCell className="text-sm">{acc.display_name ?? "—"}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{acc.role}</Badge></TableCell>
                          <TableCell className="text-sm">{acc.department ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${
                              acc.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                              isLocked ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                              acc.status === "disabled" ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" :
                              "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}>
                              {isLocked ? "已锁定" : acc.status === "active" ? "正常" : acc.status === "disabled" ? "已禁用" : acc.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">{acc.failed_attempts}</TableCell>
                          <TableCell className="text-xs text-slate-500">{acc.last_login_at ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              {isLocked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  disabled={unlocking === acc.id}
                                  onClick={() => handleUnlock(acc.id, acc.username)}
                                  data-testid={`unlock-${acc.username}`}
                                >
                                  <LockOpen className="h-3 w-3 mr-1" />
                                  解锁
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}

function formatTime(value: string) {
  return formatBeijingTime(value) || value
}
