"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { PermissionTree } from "@/components/platform/permission-tree"
import { AccountStatusBadge, SyncStatusBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { userStats, users } from "@/lib/mock/users"
import type { User } from "@/lib/types/user"
import { Users, Shield, RefreshCw, AlertTriangle } from "lucide-react"

export default function Page() {
  const [selected, setSelected] = useState<User | null>(users[0])
  const p = selected?.permissions
  return (
    <AppShell>
      <PageHeader title="用户与权限" description="RBAC 角色权限与站点访问控制" badge="RBAC"
        actions={<Button size="sm" className="bg-blue-600"><RefreshCw className="h-4 w-4 mr-1"/>同步权限</Button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="用户总数" value={userStats.total} icon={Users} />
        <StatCard title="活跃账号" value={userStats.active} icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="已锁定" value={userStats.locked} icon={Shield} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="待同步权限" value={userStats.syncPending} icon={RefreshCw} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-3"><CardTitle className="text-base">用户列表</CardTitle></CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500">用户</TableHead><TableHead className="text-xs text-slate-500">部门</TableHead>
                <TableHead className="text-xs text-slate-500">角色</TableHead><TableHead className="text-xs text-slate-500">可访问站点</TableHead>
                <TableHead className="text-xs text-slate-500">状态</TableHead><TableHead className="text-xs text-slate-500">最后登录</TableHead>
                <TableHead className="text-xs text-slate-500">权限同步</TableHead>
              </TableRow></TableHeader>
              <TableBody>{users.map((u) => (
                <TableRow key={u.id} className={`cursor-pointer hover:bg-slate-50 ${selected?.id===u.id?"bg-blue-50":""}`} onClick={() => setSelected(u)}>
                  <TableCell><p className="font-medium text-sm">{u.displayName}</p><p className="text-xs text-slate-400">{u.username}</p></TableCell>
                  <TableCell className="text-sm">{u.department}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{u.roleLabel}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate">{u.accessibleSites.join(", ")}</TableCell>
                  <TableCell><AccountStatusBadge status={u.status} /></TableCell>
                  <TableCell className="text-xs text-slate-500">{u.lastLoginAt}</TableCell>
                  <TableCell><SyncStatusBadge status={u.permissionSyncStatus} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <DetailPanel title="权限详情" subtitle={selected?.displayName} empty={!selected}>
          {selected && p && (
            <div className="space-y-4">
              {p.hasConflict && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0"/><span>{p.conflictMessage}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-slate-600">全站点提醒</span>
                <Switch checked={p.allSiteNotify} />
              </div>
              <Tabs defaultValue="sites">
                <TabsList className="h-8 w-full"><TabsTrigger value="sites" className="text-xs flex-1">站点</TabsTrigger><TabsTrigger value="devices" className="text-xs flex-1">设备</TabsTrigger><TabsTrigger value="volumes" className="text-xs flex-1">存储卷</TabsTrigger><TabsTrigger value="tasks" className="text-xs flex-1">任务</TabsTrigger><TabsTrigger value="logs" className="text-xs flex-1">日志</TabsTrigger></TabsList>
                <TabsContent value="sites" className="mt-3 space-y-1">{p.siteLabels.map((l,i) => <label key={l} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.sites[i]} readOnly className="rounded"/>{l}</label>)}</TabsContent>
                <TabsContent value="devices" className="mt-3"><PermissionTree nodes={p.devices} /></TabsContent>
                <TabsContent value="volumes" className="mt-3"><PermissionTree nodes={p.volumes} /></TabsContent>
                <TabsContent value="tasks" className="mt-3"><PermissionTree nodes={p.tasks} /></TabsContent>
                <TabsContent value="logs" className="mt-3"><PermissionTree nodes={p.logs} /></TabsContent>
              </Tabs>
            </div>
          )}
        </DetailPanel>
      </div>
    </AppShell>
  )
}
