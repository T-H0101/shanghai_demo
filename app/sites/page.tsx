"use client"

import { useState, useEffect } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { OnlineStatusBadge, SyncStatusBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { siteStats, sites as mockSites } from "@/lib/mock/sites"
import type { Site } from "@/lib/types/site"
import type { OnlineStatus } from "@/lib/types/common"
import { LayoutGrid, Server, RefreshCw, AlertTriangle, ExternalLink, Search, Loader2, Power } from "lucide-react"
import { toast } from "@/hooks/use-toast"

type SiteStatusFilter = "all" | OnlineStatus

export default function Page() {
  const [sites, setSites] = useState<Site[]>(mockSites)
  const [selected, setSelected] = useState<Site | null>(mockSites[0])
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<SiteStatusFilter>("all")
  const [syncing, setSyncing] = useState(false)
  const [showNewSite, setShowNewSite] = useState(false)
  const [newSite, setNewSite] = useState({ name: "", code: "", datacenter: "", ip: "", port: "" })

  const filtered = sites.filter((s) => {
    const matchKeyword = !keyword ||
      s.name.includes(keyword) ||
      s.code.toLowerCase().includes(keyword.toLowerCase()) ||
      s.datacenter.includes(keyword)
    const matchStatus = statusFilter === "all" || s.status === statusFilter
    return matchKeyword && matchStatus
  })

  const handleSync = () => {
    setSyncing(true)
    toast({ title: "同步中...", description: "正在执行全量同步，请稍候" })
    setTimeout(() => {
      setSyncing(false)
      const now = new Date()
      const timeStr = now.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
      setSites(prev => prev.map(s => ({ ...s, lastSyncAt: timeStr, syncStatus: "synced" })))
      toast({ title: "同步成功", description: "所有站点数据已更新至最新状态" })
    }, 1500)
  }

  const handleSSO = (siteName: string) => {
    toast({
      title: "正在跳转",
      description: `正在跳转至 ${siteName} 本地站点系统，请稍候...`,
    })
    setTimeout(() => {
      toast({
        title: "跳转成功",
        description: `已成功跳转至 ${siteName} SSO 控制台`,
      })
    }, 1000)
  }

  const handleToggleStatus = (site: Site) => {
    const newStatus = site.status === "online" ? "offline" : "online"
    setSites(prev => prev.map(s => s.id === site.id ? { ...s, status: newStatus } : s))
    if (selected?.id === site.id) {
      setSelected(prev => prev ? { ...prev, status: newStatus } : null)
    }
    toast({
      title: newStatus === "online" ? "站点已启用" : "站点已禁用",
      description: `${site.name} 状态已更新为 ${newStatus === "online" ? "在线" : "离线"}`,
    })
  }

  const handleCreateSite = () => {
    if (!newSite.name || !newSite.code) {
      toast({ title: "请填写必填字段", description: "站点名称和编码为必填项", variant: "destructive" })
      return
    }
    const site: Site = {
      id: `s${Date.now()}`,
      name: newSite.name,
      code: newSite.code,
      status: "online",
      ip: newSite.ip || "10.0.0.1",
      port: parseInt(newSite.port) || 8443,
      datacenter: newSite.datacenter || "未知数据中心",
      contact: "待配置",
      contactPhone: "待配置",
      deviceCount: 0,
      lastSyncAt: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      syncStatus: "synced",
      storageUsedPercent: 0,
      storageTotal: "0 TB",
      storageUsed: "0 TB",
      region: "华东",
      ssoEnabled: false,
    }
    setSites(prev => [...prev, site])
    setShowNewSite(false)
    setNewSite({ name: "", code: "", datacenter: "", ip: "", port: "" })
    toast({ title: "站点创建成功", description: `${site.name} 已成功注册到统一管控平台` })
  }

  return (
    <AppShell>
      <PageHeader
        title="站点管理"
        description="统一管理各数据中心光盘库站点，监控在线状态与存储容量"
        badge="SITE MGMT"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              全量同步
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowNewSite(true)}>注册新站点</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="站点总数" value={sites.length} unit="个站点" icon={LayoutGrid} badge={<Badge className="bg-emerald-500 text-white">ACTIVE</Badge>} footer={
          <div className="flex gap-3 text-xs"><span className="text-emerald-600">在线 {sites.filter(s => s.status === "online").length}</span><span className="text-amber-600">降级 {sites.filter(s => s.status === "degraded").length}</span><span className="text-red-600">离线 {sites.filter(s => s.status === "offline").length}</span></div>
        } />
        <StatCard title="同步中站点" value={siteStats.syncing} unit="个" icon={RefreshCw} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="平均存储使用率" value={`${siteStats.avgStorageUsed}%`} icon={Server} iconBg="bg-orange-50" iconColor="text-orange-600" footer={<Progress value={siteStats.avgStorageUsed} className="h-2 mt-2" />} />
        <StatCard title="异常站点" value={sites.filter(s => s.status === "offline" || s.status === "degraded").length} unit="需关注" icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">站点列表</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SiteStatusFilter)}>
                  <SelectTrigger className="h-9 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="online">在线</SelectItem>
                    <SelectItem value="degraded">降级</SelectItem>
                    <SelectItem value="offline">离线</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input placeholder="搜索站点、编码、机房..." className="pl-9 h-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs text-slate-500">站点</TableHead>
                  <TableHead className="text-xs text-slate-500">状态</TableHead>
                  <TableHead className="text-xs text-slate-500">IP:端口</TableHead>
                  <TableHead className="text-xs text-slate-500">数据中心</TableHead>
                  <TableHead className="text-xs text-slate-500">联系人</TableHead>
                  <TableHead className="text-xs text-slate-500">设备</TableHead>
                  <TableHead className="text-xs text-slate-500">同步</TableHead>
                  <TableHead className="text-xs text-slate-500">存储</TableHead>
                  <TableHead className="text-xs text-slate-500">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">未找到匹配的站点</TableCell>
                  </TableRow>
                ) : filtered.map((site) => (
                  <TableRow key={site.id} className={`cursor-pointer hover:bg-slate-50 ${selected?.id === site.id ? "bg-blue-50" : ""}`} onClick={() => setSelected(site)}>
                    <TableCell>
                      <p className="font-medium text-sm">{site.name}</p>
                      <p className="text-xs text-slate-400">{site.code}</p>
                    </TableCell>
                    <TableCell><OnlineStatusBadge status={site.status} /></TableCell>
                    <TableCell className="text-sm font-mono">{site.ip}:{site.port}</TableCell>
                    <TableCell className="text-sm">{site.datacenter}</TableCell>
                    <TableCell><p className="text-sm">{site.contact}</p><p className="text-xs text-slate-400">{site.contactPhone}</p></TableCell>
                    <TableCell className="text-sm">{site.deviceCount}</TableCell>
                    <TableCell><SyncStatusBadge status={site.syncStatus} /><p className="text-xs text-slate-400 mt-1">{site.lastSyncAt}</p></TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="flex justify-between text-xs mb-1"><span>{site.storageUsedPercent}%</span><span className="text-slate-400">{site.storageUsed}</span></div>
                      <Progress value={site.storageUsedPercent} className="h-1.5" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={site.status === "online" ? "禁用" : "启用"}
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(site) }}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        {site.ssoEnabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleSSO(site.name) }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />SSO
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <DetailPanel title="站点详情" subtitle={selected?.code} empty={!selected}>
          {selected && (
            <div className="space-y-4">
              <DetailRow label="站点名称" value={selected.name} />
              <DetailRow label="区域" value={selected.region} />
              <DetailRow label="在线状态" value={<OnlineStatusBadge status={selected.status} />} />
              <DetailRow label="同步状态" value={<SyncStatusBadge status={selected.syncStatus} />} />
              <DetailRow label="最后同步" value={selected.lastSyncAt} />
              <DetailRow label="存储总量" value={selected.storageTotal} />
              <DetailRow label="已用存储" value={`${selected.storageUsed} (${selected.storageUsedPercent}%)`} />
              <Progress value={selected.storageUsedPercent} className="h-2" />
              <DetailRow label="盘架数量" value={selected.rackCount ?? "—"} />
              <DetailRow label="活跃任务" value={selected.taskCount ?? 0} />
              {selected.description && (
                <p className="text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-lg p-3">{selected.description}</p>
              )}
              {selected.ssoEnabled && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" size="sm" onClick={() => handleSSO(selected.name)}>
                  <ExternalLink className="h-4 w-4 mr-2" />进入站点 SSO 控制台
                </Button>
              )}
            </div>
          )}
        </DetailPanel>
      </div>

      <Dialog open={showNewSite} onOpenChange={setShowNewSite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>注册新站点</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>站点名称 *</Label>
                <Input value={newSite.name} onChange={(e) => setNewSite(prev => ({ ...prev, name: e.target.value }))} placeholder="如：上海研发中心" />
              </div>
              <div className="space-y-2">
                <Label>站点编码 *</Label>
                <Input value={newSite.code} onChange={(e) => setNewSite(prev => ({ ...prev, code: e.target.value }))} placeholder="如：SH-RD-01" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>数据中心</Label>
              <Input value={newSite.datacenter} onChange={(e) => setNewSite(prev => ({ ...prev, datacenter: e.target.value }))} placeholder="如：浦东 IDC-A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP 地址</Label>
                <Input value={newSite.ip} onChange={(e) => setNewSite(prev => ({ ...prev, ip: e.target.value }))} placeholder="如：10.12.8.101" />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input value={newSite.port} onChange={(e) => setNewSite(prev => ({ ...prev, port: e.target.value }))} placeholder="如：8443" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSite(false)}>取消</Button>
            <Button onClick={handleCreateSite} className="bg-blue-600 hover:bg-blue-700">确认注册</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}