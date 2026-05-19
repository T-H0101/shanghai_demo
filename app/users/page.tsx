"use client"
import { useState, useEffect } from "react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { userStats, users as allUsers } from "@/lib/mock/users"
import { sites as allSites } from "@/lib/mock/sites"
import { Checkbox } from "@/components/ui/checkbox"
import type { User } from "@/lib/types/user"
import type { MockSession } from "@/lib/types/auth"
import { Users, Shield, RefreshCw, AlertTriangle, Plus, UserCog, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getSession } from "@/lib/auth/session"

const roleLabels: Record<string, string> = {
  super_admin: "超级管理员",
  site_admin: "站点管理员",
  operator: "操作员",
  auditor: "审计员",
  viewer: "只读用户",
}

export default function Page() {
  const [session, setSession] = useState<MockSession | null>(null)
  const [users, setUsers] = useState<User[]>(allUsers)
  const [selected, setSelected] = useState<User | null>(allUsers[0])
  const [showCreate, setShowCreate] = useState(false)
  const [newUser, setNewUser] = useState({ username: "", displayName: "", department: "", role: "operator", sites: ["上海研发中心"] as string[] })
  const [syncing, setSyncing] = useState(false)
  const p = selected?.permissions

  const updatePermissionNodes = (nodes: User["permissions"]["devices"], targetId: string): User["permissions"]["devices"] =>
    nodes.map((node) => {
      if (node.id === targetId) {
        return {
          ...node,
          checked: !node.checked,
          children: node.children?.map((child) => ({ ...child, checked: !node.checked })),
        }
      }
      if (node.children?.length) {
        const nextChildren = updatePermissionNodes(node.children, targetId)
        const anyChecked = nextChildren.some((child) => child.checked)
        return { ...node, checked: anyChecked, children: nextChildren }
      }
      return node
    })

  const updateUserById = (userId: string, updater: (user: User) => User) => {
    setUsers((prev) => prev.map((user) => user.id === userId ? updater(user) : user))
    setSelected((prev) => prev && prev.id === userId ? updater(prev) : prev)
  }

  useEffect(() => {
    const s = getSession()
    setSession(s)
    if (s) {
      if (s.role === "集团超级管理员" || s.roleLevel === "group_admin") {
        setUsers(allUsers)
      } else {
        const userObj = allUsers.find(u => u.username === s.user)
        if (userObj) {
          setUsers(allUsers.filter(u => userObj.accessibleSites.some(site => u.accessibleSites.includes(site))))
        }
      }
    }
  }, [])

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.displayName) {
      toast({ title: "请填写必填项", description: "用户名和显示姓名不能为空", variant: "destructive" })
      return
    }
    // 创建新用户对象
    const createdUser: User = {
      id: `user-${Date.now()}`,
      username: newUser.username,
      displayName: newUser.displayName,
      department: newUser.department,
      role: newUser.role as User["role"],
      roleLabel: roleLabels[newUser.role as keyof typeof roleLabels] || newUser.role,
      accessibleSites: newUser.sites.includes("全部站点") ? ["全部站点"] : newUser.sites,
      permissions: {
        sites: newUser.sites.includes("全部站点") ? [true, true, true, true, true] : [false, false, false, false, false],
        siteLabels: ["北京数据中心", "广州数据中心", "南京数据中心", "上海研发中心", "武汉数据中心"],
        hasConflict: false,
        allSiteNotify: false,
        devices: [],
        volumes: [],
        tasks: [],
        logs: [],
      },
      status: "active",
      lastLoginAt: "—",
      permissionSyncStatus: "pending",
      email: `${newUser.username}@corp.example.com`,
    }
    setUsers(prev => [...prev, createdUser])
    toast({ title: "账号创建成功", description: `账号 ${newUser.displayName} (${newUser.username}) 已创建` })
    setShowCreate(false)
    setNewUser({ username: "", displayName: "", department: "", role: "operator", sites: ["上海研发中心"] })
  }

  const handleSyncPermissions = () => {
    if (users.length === 0) return
    setSyncing(true)
    setUsers((prev) => prev.map((user) => ({ ...user, permissionSyncStatus: "syncing" })))
    setSelected((prev) => prev ? { ...prev, permissionSyncStatus: "syncing" } : null)
    toast({ title: "权限同步中...", description: "正在向所有站点同步权限配置" })
    setTimeout(() => {
      setSyncing(false)
      setUsers((prev) => prev.map((user) => ({
        ...user,
        permissionSyncStatus: user.permissions.hasConflict ? "failed" : "synced",
      })))
      setSelected((prev) => prev ? {
        ...prev,
        permissionSyncStatus: prev.permissions.hasConflict ? "failed" : "synced",
      } : prev)
      const failedCount = users.filter((user) => user.permissions.hasConflict).length
      toast({
        title: failedCount > 0 ? "同步完成，存在异常" : "同步完成",
        description: failedCount > 0
          ? `${failedCount} 个账号因权限冲突同步失败，其余账号已同步至所有站点`
          : "权限配置已同步至所有站点，部分节点可能需要几分钟生效",
      })
    }, 2000)
  }

  const handleToggleNotify = (checked: boolean) => {
    if (!selected) return
    updateUserById(selected.id, (user) => ({
      ...user,
      permissionSyncStatus: "pending",
      permissions: {
        ...user.permissions,
        allSiteNotify: checked,
      },
    }))
    toast({
      title: checked ? "已开启全站点提醒" : "已关闭全站点提醒",
      description: `${selected.displayName} 的提醒策略已更新，等待同步到站点`,
    })
  }

  const handleTogglePermission = (group: "devices" | "volumes" | "tasks" | "logs", nodeId: string) => {
    if (!selected) return
    updateUserById(selected.id, (user) => ({
      ...user,
      permissionSyncStatus: "pending",
      permissions: {
        ...user.permissions,
        [group]: updatePermissionNodes(user.permissions[group], nodeId),
      },
    }))
    toast({ title: "权限已变更", description: `${selected.displayName} 的${group === "devices" ? "设备" : group === "volumes" ? "存储卷" : group === "tasks" ? "任务" : "日志"}权限待同步` })
  }

  const handleUnlock = (user: User) => {
    if (!session) return
    const isAdmin = session.roleLevel === "group_admin"
    if (!isAdmin) {
      toast({ title: "权限不足", description: "仅管理员可执行解锁操作", variant: "destructive" })
      return
    }
    // 站点权限校验：只能管理自己可访问站点的用户
    const currentUser = allUsers.find(u => u.username === session.user)
    const canManage = currentUser?.accessibleSites.some(site =>
      site === "全部站点" || user.accessibleSites.includes(site)
    )
    if (!canManage) {
      toast({ title: "权限不足", description: "无法管理非可访问站点的用户", variant: "destructive" })
      return
    }
    // 解锁：将状态改为 active
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: "active" } : u))
    if (selected?.id === user.id) {
      setSelected(prev => prev ? { ...prev, status: "active" } : null)
    }
    toast({ title: "账号已解锁", description: `用户 ${user.displayName} 已恢复登录权限` })
  }

  const handleBan = (user: User) => {
    if (!session) return
    const isAdmin = session.roleLevel === "group_admin"
    if (!isAdmin) {
      toast({ title: "权限不足", description: "仅管理员可执行封禁操作", variant: "destructive" })
      return
    }
    // 站点权限校验：只能管理自己可访问站点的用户
    const currentUser = allUsers.find(u => u.username === session.user)
    const canManage = currentUser?.accessibleSites.some(site =>
      site === "全部站点" || user.accessibleSites.includes(site)
    )
    if (!canManage) {
      toast({ title: "权限不足", description: "无法管理非可访问站点的用户", variant: "destructive" })
      return
    }
    // 封禁：将状态改为 disabled
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: "disabled" } : u))
    if (selected?.id === user.id) {
      setSelected(prev => prev ? { ...prev, status: "disabled" } : null)
    }
    toast({ title: "账号已封禁", description: `用户 ${user.displayName} 已限制登录` })
  }

  return (
    <AppShell>
      <PageHeader title="用户与权限" description="RBAC 角色权限与站点访问控制" badge="RBAC"
        actions={<div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8" onClick={handleSyncPermissions} disabled={syncing}>{syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1"/>}同步权限</Button><Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1"/>创建账号</Button></div>} />
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
                <TableHead className="text-xs text-slate-500">权限同步</TableHead><TableHead className="text-xs text-slate-500">操作</TableHead>
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
                  <TableCell>
                    {session && session.roleLevel === "group_admin" && (
                      u.status === "locked" || u.status === "disabled" ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUnlock(u)}>
                          解锁
                        </Button>
                      ) : u.status === "active" ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleBan(u)}>
                          封禁
                        </Button>
                      ) : null
                    )}
                  </TableCell>
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
                <Switch checked={p.allSiteNotify} onCheckedChange={handleToggleNotify} />
              </div>
              <Tabs defaultValue="sites">
                <TabsList className="h-8 w-full"><TabsTrigger value="sites" className="text-xs flex-1">站点</TabsTrigger><TabsTrigger value="devices" className="text-xs flex-1">设备</TabsTrigger><TabsTrigger value="volumes" className="text-xs flex-1">存储卷</TabsTrigger><TabsTrigger value="tasks" className="text-xs flex-1">任务</TabsTrigger><TabsTrigger value="logs" className="text-xs flex-1">日志</TabsTrigger></TabsList>
                <TabsContent value="sites" className="mt-3 space-y-1">{p.siteLabels.map((l,i) => <label key={i} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.sites[i]} readOnly className="rounded"/>{l}</label>)}</TabsContent>
                <TabsContent value="devices" className="mt-3"><PermissionTree nodes={p.devices} onToggle={(id) => handleTogglePermission("devices", id)} /></TabsContent>
                <TabsContent value="volumes" className="mt-3"><PermissionTree nodes={p.volumes} onToggle={(id) => handleTogglePermission("volumes", id)} /></TabsContent>
                <TabsContent value="tasks" className="mt-3"><PermissionTree nodes={p.tasks} onToggle={(id) => handleTogglePermission("tasks", id)} /></TabsContent>
                <TabsContent value="logs" className="mt-3"><PermissionTree nodes={p.logs} onToggle={(id) => handleTogglePermission("logs", id)} /></TabsContent>
              </Tabs>
            </div>
          )}
        </DetailPanel>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>用户名 *</Label>
                <Input value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} placeholder="域账号" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label>显示姓名 *</Label>
                <Input value={newUser.displayName} onChange={(e) => setNewUser({...newUser, displayName: e.target.value})} placeholder="真实姓名" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>部门</Label>
                <Input value={newUser.department} onChange={(e) => setNewUser({...newUser, department: e.target.value})} placeholder="所在部门" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                    <SelectItem value="site_admin">站点管理员</SelectItem>
                    <SelectItem value="operator">操作员</SelectItem>
                    <SelectItem value="auditor">审计员</SelectItem>
                    <SelectItem value="viewer">只读用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>可访问站点</Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-slate-700 bg-slate-950/50">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="site-all"
                    checked={newUser.sites.includes("全部站点")}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setNewUser({...newUser, sites: ["全部站点"]})
                      } else {
                        setNewUser({...newUser, sites: ["上海研发中心"]})
                      }
                    }}
                  />
                  <Label htmlFor="site-all" className="text-sm font-normal cursor-pointer">全部站点</Label>
                </div>
                {allSites.filter(s => s.name !== "全部站点").map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`site-${s.id}`}
                      checked={newUser.sites.includes(s.name)}
                      onCheckedChange={(checked) => {
                        if (newUser.sites.includes("全部站点")) {
                          setNewUser({...newUser, sites: [s.name]})
                        } else if (checked) {
                          setNewUser({...newUser, sites: [...newUser.sites, s.name]})
                        } else {
                          const filtered = newUser.sites.filter(site => site !== s.name)
                          setNewUser({...newUser, sites: filtered.length ? filtered : ["上海研发中心"]})
                        }
                      }}
                    />
                    <Label htmlFor={`site-${s.id}`} className="text-sm font-normal cursor-pointer">{s.name}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreateUser} className="bg-blue-600 hover:bg-blue-700">确认创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
