"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { searchFiles, searchSites, searchDepartments, searchFileTypes } from "@/lib/mock/search"
import type { SearchFile } from "@/lib/types/search"
import { Search, Download, Shield, ChevronLeft, ChevronRight, Filter, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

export default function Page() {
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [siteFilter, setSiteFilter] = useState("全部站点")
  const [deptFilter, setDeptFilter] = useState("全部部门")
  const [typeFilter, setTypeFilter] = useState("全部类型")
  const [discFilter, setDiscFilter] = useState("")
  const [volumeFilter, setVolumeFilter] = useState("")
  const [showExport, setShowExport] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    format: "Excel",
    range: "all",
    splitSize: "",
    targetPath: "\\\\nas-archive\\optical-index\\2026\\05",
    delivery: "push",
  })
  const pageSize = 10

  const filtered = searchFiles.filter((f) => {
    const matchKw = !keyword ||
      f.fileName.includes(keyword) ||
      f.path.includes(keyword) ||
      f.discNo.includes(keyword)
    const matchSite = siteFilter === "全部站点" || f.siteName.includes(siteFilter.replace("全部站点", ""))
    const matchDept = deptFilter === "全部部门" || f.department === deptFilter
    const matchType = typeFilter === "全部类型" || f.fileType === typeFilter
    const matchDisc = !discFilter || f.discNo.includes(discFilter)
    const matchVol = !volumeFilter || f.volume.includes(volumeFilter)
    return matchKw && matchSite && matchDept && matchType && matchDisc && matchVol
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSearch = () => {
    setPage(1)
    if (filtered.length > 0) {
      toast({ title: "检索完成", description: `共找到 ${filtered.length} 条匹配结果` })
    } else {
      toast({ title: "未找到结果", description: "请尝试调整筛选条件" })
    }
  }

  const handleReset = () => {
    setKeyword("")
    setSiteFilter("全部站点")
    setDeptFilter("全部部门")
    setTypeFilter("全部类型")
    setDiscFilter("")
    setVolumeFilter("")
    setPage(1)
    toast({ title: "已重置筛选条件" })
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: "无数据可导出", description: "请先执行检索", variant: "destructive" })
      return
    }
    setShowExport(true)
  }

  const handleConfirmExport = () => {
    setShowExport(false)
    const exportCount = exportOptions.range === "current" ? paged.length : filtered.length
    const splitInfo = exportOptions.range === "split" && exportOptions.splitSize ? `，每 ${exportOptions.splitSize} 条分一个文件` : ""
    const deliveryInfo = exportOptions.delivery === "push" ? `，完成后推送至 ${exportOptions.targetPath}` : "，生成后保留在本地下载区"
    toast({ title: "正在导出...", description: `正在生成 ${exportOptions.format} 文件，请稍候${splitInfo}${deliveryInfo}` })
    setTimeout(() => {
      toast({ title: "导出成功", description: `已导出 ${exportCount} 条检索结果（${exportOptions.format} 格式）${splitInfo}，已添加数字签名并完成${exportOptions.delivery === "push" ? "路径推送" : "本地生成"}` })
    }, 1500)
  }

  const handleRestore = (file: SearchFile) => {
    toast({
      title: "回迁任务已创建",
      description: `文件「${file.fileName}」的回迁任务已提交，请等待调度执行`,
    })
  }

  return (
    <AppShell>
      <PageHeader title="统一检索" description="跨站点全局文件检索" badge="GLOBAL SEARCH"
        actions={<Button variant="outline" size="sm" className="h-8" onClick={handleExport}><Download className="h-4 w-4 mr-1" />导出</Button>} />
      <Card className="gap-0 border-blue-100 bg-blue-50/30">
        <CardContent className="p-4 flex gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-sm"><p className="font-medium">权限可见范围</p>
          <p className="text-slate-600 mt-1">可检索：上海、北京、南京、武汉（4 站点）。广州/成都不可见。</p></div>
        </CardContent>
      </Card>
      <Card className="gap-0">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />高级筛选</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input placeholder="全局搜索..." className="pl-11 h-11" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{searchSites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="光盘编号" className="h-9" value={discFilter} onChange={(e) => { setDiscFilter(e.target.value); setPage(1) }} />
            <Input placeholder="存储卷" className="h-9" value={volumeFilter} onChange={(e) => { setVolumeFilter(e.target.value); setPage(1) }} />
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{searchFileTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{searchDepartments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" className="bg-blue-600" onClick={handleSearch}>检索</Button>
              <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2">检索结果 <Badge className="ml-2">{filtered.length} 条</Badge><span className="text-xs text-slate-500 font-normal ml-2">（共找到 {filtered.length} 条匹配记录，展示第 {(page-1)*pageSize+1}-{(Math.min(page*pageSize, filtered.length))} 条）</span></CardTitle></CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead className="text-xs text-slate-500">文件名</TableHead><TableHead className="text-xs text-slate-500">路径</TableHead>
              <TableHead className="text-xs text-slate-500">大小</TableHead><TableHead className="text-xs text-slate-500">站点</TableHead>
              <TableHead className="text-xs text-slate-500">光盘编号</TableHead><TableHead className="text-xs text-slate-500">盘架/盘笼</TableHead>
              <TableHead className="text-xs text-slate-500">部门</TableHead><TableHead className="text-xs text-slate-500">校验码</TableHead>
              <TableHead className="text-xs text-slate-500">创建时间</TableHead><TableHead className="text-xs text-slate-500">操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-slate-500">未找到匹配的检索结果</TableCell></TableRow>
              ) : paged.map((f) => (
                <TableRow key={f.id} className="hover:bg-slate-50">
                  <TableCell><p className="font-medium text-sm text-blue-700">{f.fileName}</p></TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[160px]">{f.path}</TableCell>
                  <TableCell className="text-sm">{f.size}</TableCell>
                  <TableCell><p className="text-sm">{f.siteName}</p><p className="text-xs text-slate-400">{f.siteCode}</p></TableCell>
                  <TableCell className="font-mono text-sm">{f.discNo}</TableCell>
                  <TableCell className="text-sm">{f.rackSlot}</TableCell>
                  <TableCell>{f.department}</TableCell>
                  <TableCell className="text-xs font-mono text-slate-500">{f.checksum || "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{f.createdAt}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRestore(f)}>
                        发起回迁
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={() => toast({ title: "正在跳转", description: `跳转至 ${f.siteName} 站点详情页` })}>
                        查看站点
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-slate-500">第 {page}/{totalPages} 页，共 {filtered.length} 条</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page<=1} onClick={() => setPage(p=>p-1)}><ChevronLeft className="h-4 w-4"/></Button>
              <Button variant="outline" size="sm" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}><ChevronRight className="h-4 w-4"/></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>索引导出</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>导出格式</Label>
              <Select value={exportOptions.format} onValueChange={(v) => setExportOptions({ ...exportOptions, format: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="CSV">CSV (.csv)</SelectItem>
                  <SelectItem value="JSON">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>导出范围</Label>
              <Select value={exportOptions.range} onValueChange={(v) => setExportOptions({ ...exportOptions, range: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结果 ({filtered.length} 条)</SelectItem>
                  <SelectItem value="current">当前页 ({paged.length} 条)</SelectItem>
                  <SelectItem value="split">分片导出</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exportOptions.range === "split" && (
              <div className="space-y-2">
                <Label>分片大小（条/文件）</Label>
                <Input placeholder="如：500" value={exportOptions.splitSize} onChange={(e) => setExportOptions({ ...exportOptions, splitSize: e.target.value })} className="h-9" />
              </div>
            )}
            <div className="space-y-2">
              <Label>交付方式</Label>
              <Select value={exportOptions.delivery} onValueChange={(v) => setExportOptions({ ...exportOptions, delivery: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">推送至指定路径</SelectItem>
                  <SelectItem value="local">生成本地文件</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标路径</Label>
              <Input
                placeholder="如：\\\\nas-archive\\optical-index\\2026\\05"
                value={exportOptions.targetPath}
                onChange={(e) => setExportOptions({ ...exportOptions, targetPath: e.target.value })}
                className="h-9"
                disabled={exportOptions.delivery !== "push"}
              />
            </div>
            <p className="text-xs text-slate-500">导出文件将自动添加数字签名，确保数据完整性</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>取消</Button>
            <Button onClick={handleConfirmExport} className="bg-blue-600 hover:bg-blue-700">确认导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
