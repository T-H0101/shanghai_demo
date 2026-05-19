"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { SlotGrid } from "@/components/platform/slot-grid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rackStats, racks as mockRacks, allSites } from "@/lib/mock/racks"
import { sites as mockSites } from "@/lib/mock/sites"
import type { Rack, TransferRecord } from "@/lib/types/rack"
import { HardDrive, Download, RefreshCw, ArrowRightLeft, Clock, CheckCircle, Truck, XCircle, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const statusMap = { normal: ["正常","bg-emerald-100 text-emerald-700"], warning: ["预警","bg-amber-100 text-amber-700"], fault: ["故障","bg-red-100 text-red-700"], maintenance: ["维护","bg-slate-100 text-slate-700"] }
const transferStatusMap = { pending: ["待处理","bg-slate-100 text-slate-600"], in_transit: ["移位中","bg-blue-100 text-blue-700"], completed: ["已完成","bg-emerald-100 text-emerald-700"], cancelled: ["已取消","bg-slate-100 text-slate-400"] }

export default function Page() {
  const [rackList, setRackList] = useState<Rack[]>(mockRacks)
  const [selected, setSelected] = useState<Rack | null>(mockRacks[0])
  const [showTransfer, setShowTransfer] = useState(false)
  const [transfer, setTransfer] = useState({ toSite: "", reason: "", approver: "" })
  const [exporting, setExporting] = useState(false)
  const siteCodeMap = Object.fromEntries(mockSites.map((site) => [site.name, site.code]))
  const nowString = () => new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")

  const handleExport = () => {
    setExporting(true)
    toast({ title: "正在导出盘架数据...", description: "请稍候，正在生成文件" })
    setTimeout(() => {
      setExporting(false)
      const exportData = rackList.map(r => ({
        rackId: r.rackId,
        siteName: r.siteName,
        siteCode: r.siteCode,
        datacenter: r.datacenter,
        cages: r.cages.join(', '),
        usedSlots: r.usedSlots,
        totalSlots: r.totalSlots,
        usagePercent: r.usagePercent,
        status: statusMap[r.status][0],
        lastSyncAt: r.lastSyncAt
      }))
      const content = exportData.map(r => `[${r.lastSyncAt}] ${r.rackId} | ${r.siteName} | ${r.datacenter} | ${r.cages} | ${r.usedSlots}/${r.totalSlots} | ${r.usagePercent}% | ${r.status}`).join('\n')
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `racks_export_${Date.now()}.log`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "导出成功", description: `已导出 ${rackList.length} 条盘架数据` })
    }, 1500)
  }

  const handleTransfer = () => {
    if (!selected || !transfer.toSite || !transfer.reason || !transfer.approver) {
      toast({ title: "请填写完整信息", description: "目标站点、移位原因、审批人均为必填项", variant: "destructive" })
      return
    }
    const requestedAt = nowString()
    const transferRecord: TransferRecord = {
      id: `tr-${Date.now()}`,
      fromSite: selected.siteName,
      toSite: transfer.toSite,
      reason: transfer.reason,
      operator: "张建国",
      approver: transfer.approver,
      requestedAt,
      status: "pending",
    }

    const applyRackUpdate = (updater: (rack: Rack) => Rack) => {
      setRackList((prev) => prev.map((rack) => rack.id === selected.id ? updater(rack) : rack))
      setSelected((prev) => prev && prev.id === selected.id ? updater(prev) : prev)
    }

    applyRackUpdate((rack) => ({
      ...rack,
      status: "maintenance",
      lastSyncAt: requestedAt,
      transferHistory: [transferRecord, ...(rack.transferHistory ?? [])],
    }))

    toast({ title: "移位登记已提交", description: `盘架 ${selected.rackId} 移位至 ${transfer.toSite}，等待审批` })
    setShowTransfer(false)
    setTransfer({ toSite: "", reason: "", approver: "" })

    setTimeout(() => {
      applyRackUpdate((rack) => ({
        ...rack,
        lastSyncAt: nowString(),
        transferHistory: (rack.transferHistory ?? []).map((record) =>
          record.id === transferRecord.id ? { ...record, status: "in_transit" } : record
        ),
      }))
      toast({ title: "盘架移位中", description: `${selected.rackId} 已从 ${selected.siteName} 发出，正在前往 ${transfer.toSite}` })
    }, 1200)

    setTimeout(() => {
      applyRackUpdate((rack) => ({
        ...rack,
        siteName: transfer.toSite,
        siteCode: siteCodeMap[transfer.toSite] ?? rack.siteCode,
        status: "normal",
        lastSyncAt: nowString(),
        transferHistory: (rack.transferHistory ?? []).map((record) =>
          record.id === transferRecord.id ? { ...record, status: "completed", completedAt: nowString() } : record
        ),
      }))
      toast({ title: "移位完成", description: `${selected.rackId} 已完成移入并自动上报统一平台` })
    }, 3200)
  }
  return (
    <AppShell>
      <PageHeader title="盘架管理" description="盘架槽位使用率与盘笼关联管理" badge="RACK MGMT"
        actions={<div className="flex items-center gap-2"><Button variant="outline" size="sm" className="h-8" onClick={handleExport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1"/>}导出</Button><Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700"><RefreshCw className="h-4 w-4 mr-1"/>同步</Button></div>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="盘架总数" value={rackStats.total} unit="个" icon={HardDrive} />
        <StatCard title="正常" value={rackStats.normal} icon={HardDrive} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="预警/故障" value={rackStats.warning + rackStats.fault} icon={HardDrive} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="平均使用率" value={`${rackStats.avgUsage}%`} icon={HardDrive} iconBg="bg-orange-50" iconColor="text-orange-600" footer={<Progress value={rackStats.avgUsage} className="h-2 mt-2"/>} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-3"><CardTitle className="text-base">盘架列表</CardTitle></CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent">
                <TableHead className="text-xs text-slate-500">盘架ID</TableHead><TableHead className="text-xs text-slate-500">站点</TableHead>
                <TableHead className="text-xs text-slate-500">数据中心</TableHead><TableHead className="text-xs text-slate-500">盘笼</TableHead>
                <TableHead className="text-xs text-slate-500">槽位</TableHead><TableHead className="text-xs text-slate-500">使用率</TableHead>
                <TableHead className="text-xs text-slate-500">状态</TableHead><TableHead className="text-xs text-slate-500">同步时间</TableHead>
              </TableRow></TableHeader>
              <TableBody>{rackList.map((r) => (
                <TableRow key={r.id} className={`cursor-pointer hover:bg-slate-50 ${selected?.id===r.id?"bg-blue-50":""}`} onClick={() => setSelected(r)}>
                  <TableCell className="font-mono font-medium text-sm">{r.rackId}</TableCell>
                  <TableCell><p className="text-sm">{r.siteName}</p><p className="text-xs text-slate-400">{r.siteCode}</p></TableCell>
                  <TableCell className="text-sm">{r.datacenter}</TableCell>
                  <TableCell className="text-sm">{r.cages.join(", ")}</TableCell>
                  <TableCell className="text-sm">{r.usedSlots}/{r.totalSlots}</TableCell>
                  <TableCell className="min-w-[100px]"><Progress value={r.usagePercent} className="h-1.5 mb-1"/><span className="text-xs">{r.usagePercent}%</span></TableCell>
                  <TableCell><Badge className={statusMap[r.status][1]}>{statusMap[r.status][0]}</Badge></TableCell>
                  <TableCell className="text-xs text-slate-500">{r.lastSyncAt}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <DetailPanel title="盘架详情" subtitle={selected?.rackId} empty={!selected}
          actions={selected && <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowTransfer(true)}><ArrowRightLeft className="h-3 w-3 mr-1"/>移位登记</Button>}>
          {selected && (
            <Tabs defaultValue="slots">
              <TabsList className="h-8 w-full mb-3">
                <TabsTrigger value="slots" className="text-xs flex-1">盘位信息</TabsTrigger>
                <TabsTrigger value="transfer" className="text-xs flex-1">移位历史</TabsTrigger>
              </TabsList>
              <TabsContent value="slots" className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <DetailRow label="站点" value={selected.siteName} />
                  <DetailRow label="机房" value={selected.room || "—"} />
                  <DetailRow label="数据中心" value={selected.datacenter} />
                  <DetailRow label="状态" value={<Badge className={statusMap[selected.status][1]}>{statusMap[selected.status][0]}</Badge>} />
                  <DetailRow label="盘笼" value={selected.cages.join(", ")} />
                  <DetailRow label="使用率" value={`${selected.usagePercent}%`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700 mb-2">盘位可视化（{selected.usedSlots}/{selected.totalSlots} 已占用）</p>
                  <SlotGrid slots={selected.slots} columns={8} />
                  <div className="flex gap-4 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-blue-600"/>已占用</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-slate-100 border"/>空闲</span>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="transfer">
                <div className="space-y-2">
                  {selected.transferHistory && selected.transferHistory.length > 0 ? (
                    selected.transferHistory.map((t) => (
                      <div key={t.id} className="p-2.5 rounded border border-slate-100 bg-slate-50">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {t.status === "completed" && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
                            {t.status === "in_transit" && <Truck className="h-3.5 w-3.5 text-blue-600" />}
                            {t.status === "pending" && <Clock className="h-3.5 w-3.5 text-slate-400" />}
                            <Badge className={transferStatusMap[t.status][1]}>{transferStatusMap[t.status][0]}</Badge>
                          </div>
                          <span className="text-[10px] text-slate-400">{t.requestedAt}</span>
                        </div>
                        <p className="text-xs text-slate-700 mb-1">{t.fromSite} → {t.toSite}</p>
                        <p className="text-[10px] text-slate-500">{t.reason}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          <span>操作人: {t.operator}</span>
                          <span>审批人: {t.approver}</span>
                          {t.completedAt && <span>完成: {t.completedAt}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">暂无移位记录</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DetailPanel>
      </div>

      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>盘笼移位登记</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>当前站点</Label>
                <Input value={selected?.siteName || ""} disabled className="h-9 bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>目标站点 *</Label>
                <Select value={transfer.toSite} onValueChange={(v) => setTransfer({...transfer, toSite: v})}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="选择目标站点" /></SelectTrigger>
                  <SelectContent>
                    {allSites.filter(s => s !== selected?.siteName).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>移位原因 *</Label>
              <Input value={transfer.reason} onChange={(e) => setTransfer({...transfer, reason: e.target.value})} placeholder="请输入移位原因" className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>审批人 *</Label>
              <Input value={transfer.approver} onChange={(e) => setTransfer({...transfer, approver: e.target.value})} placeholder="请输入审批人姓名" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>取消</Button>
            <Button onClick={handleTransfer} className="bg-blue-600 hover:bg-blue-700">提交登记</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
