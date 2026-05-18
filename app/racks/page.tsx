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
import { rackStats, racks } from "@/lib/mock/racks"
import type { Rack } from "@/lib/types/rack"
import { HardDrive, Download, RefreshCw, ArrowRightLeft } from "lucide-react"

const statusMap = { normal: ["正常","bg-emerald-100 text-emerald-700"], warning: ["预警","bg-amber-100 text-amber-700"], fault: ["故障","bg-red-100 text-red-700"], maintenance: ["维护","bg-slate-100 text-slate-700"] }

export default function Page() {
  const [selected, setSelected] = useState<Rack | null>(racks[0])
  return (
    <AppShell>
      <PageHeader title="盘架管理" description="盘架槽位使用率与盘笼关联管理" badge="RACK MGMT"
        actions={<><Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1"/>导出</Button><Button size="sm" className="bg-blue-600"><RefreshCw className="h-4 w-4 mr-1"/>同步</Button></>} />
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
              <TableBody>{racks.map((r) => (
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
          actions={selected && <div className="flex gap-1"><Button variant="outline" size="sm" className="h-7 text-xs"><ArrowRightLeft className="h-3 w-3 mr-1"/>移位</Button><Button variant="outline" size="sm" className="h-7 text-xs"><RefreshCw className="h-3 w-3"/></Button></div>}>
          {selected && (
            <div className="space-y-4">
              <DetailRow label="站点" value={selected.siteName} /><DetailRow label="机房" value={selected.room || "—"} />
              <DetailRow label="槽位" value={`${selected.usedSlots}/${selected.totalSlots}`} /><DetailRow label="最后同步" value={selected.lastSyncAt} />
              <p className="text-xs font-medium text-slate-700 pt-2">盘位可视化</p>
              <SlotGrid slots={selected.slots} columns={8} />
              <div className="flex gap-2 text-xs text-slate-500 pt-2">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-600"/>已占用</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 border"/>空闲</span>
              </div>
            </div>
          )}
        </DetailPanel>
      </div>
    </AppShell>
  )
}
