"use client"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SearchFile } from "@/lib/types/search"
import { Search, Download, Shield, ChevronLeft, ChevronRight, Filter, RotateCcw, AlertTriangle, Database, RefreshCw, FileDown } from "lucide-react"
import { AppTooltip } from "@/components/shared/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"

interface SearchBlkInfo {
  blocker: string
  reason: string
  requirement: { id: string; text: string; status: string }
  currentReality: { taskLevelFileIndex: number; sourceTable: string; note: string }
  nextStep: string
}

export default function Page() {
  // R.14F: 全文检索 blocked_by_external_system (ES/ClickHouse 未接入)
  // 移除原 lib/mock/search 列表 + setTimeout 假"导出成功", 全部走真 /api/search
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [siteFilter, setSiteFilter] = useState("blocked")
  const [deptFilter, setDeptFilter] = useState("blocked")
  const [typeFilter, setTypeFilter] = useState("blocked")
  const [discFilter, setDiscFilter] = useState("")
  const [volumeFilter, setVolumeFilter] = useState("")
  const [showExport, setShowExport] = useState(false)
  const [blk, setBlk] = useState<SearchBlkInfo | null>(null)
  const [dataSource, setDataSource] = useState<"database" | "empty" | "not_implemented">("not_implemented")
  const [exportOptions, setExportOptions] = useState({
    format: "Excel",
    range: "all",
    splitSize: "",
    targetPath: "\\\\nas-archive\\optical-index\\2026\\05",
    delivery: "push",
  })
  const pageSize = 10

  // R.14F: 真实 /api/search 调用 (当前 501, blocked_by_external_system)
  useEffect(() => {
    let cancelled = false
    fetch("/api/search?q=detect")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.source === "not_implemented" && data?.meta) {
          setBlk({
            blocker: data.meta.blocker ?? data.blocker ?? "blocked_by_external_system",
            reason: data.meta.reason ?? "全文检索未实现",
            requirement: data.meta.requirement ?? { id: "REQ-4.1.1", text: "跨维度检索", status: "blocked_by_external_system" },
            currentReality: data.meta.currentReality ?? { taskLevelFileIndex: 0, sourceTable: "unified_file_index", note: "" },
            nextStep: data.meta.nextStep ?? "等待 ES 接入",
          })
          setDataSource("not_implemented")
        }
      })
      .catch(() => {
        if (cancelled) return
        setDataSource("not_implemented")
      })
    return () => { cancelled = true }
  }, [])

  // R.14F: 检索结果从真实 /api/search 取 (blocked 时 0 行, 不渲染 mock)
  const [searchResults, setSearchResults] = useState<SearchFile[]>([])
  const [searching, setSearching] = useState(false)

  const filtered: SearchFile[] = searchResults
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSearch = async () => {
    setPage(1)
    setSearching(true)
    try {
      const sp = new URLSearchParams({ q: keyword, page: "1", pageSize: String(pageSize) })
      const res = await fetch(`/api/search?${sp.toString()}`)
      const body = await res.json()
      if (res.status === 501 || body?.source === "not_implemented") {
        setSearchResults([])
        setDataSource("not_implemented")
        toast({
          title: "检索未实现",
          description: `REQ-4.1.1 ${body?.meta?.reason ?? "全文检索需 ES/ClickHouse, 当前未接入"}`,
          variant: "destructive",
        })
        return
      }
      if (body?.data?.items) {
        setSearchResults(body.data.items as SearchFile[])
        setDataSource(body.data.items.length > 0 ? "database" : "empty")
        toast({ title: "检索完成", description: `共找到 ${body.data.total ?? body.data.items.length} 条` })
      } else {
        setSearchResults([])
        setDataSource("empty")
      }
    } catch {
      setSearchResults([])
      setDataSource("not_implemented")
      toast({ title: "检索请求失败", description: "/api/search 未实现 (REQ-4.1.1 blocked_by_external_system)", variant: "destructive" })
    } finally {
      setSearching(false)
    }
  }

  const handleReset = () => {
    setKeyword("")
    setSiteFilter("blocked")
    setDeptFilter("blocked")
    setTypeFilter("blocked")
    setDiscFilter("")
    setVolumeFilter("")
    setPage(1)
    setSearchResults([])
    toast({ title: "筛选条件已清空" })
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast({ title: "无数据可导出", description: "请先执行检索或等待全文检索接入", variant: "destructive" })
      return
    }
    setShowExport(true)
  }

  // R.14F: 移除 setTimeout 假"导出成功", 改真请求 /api/search/export (当前 501)
  const handleConfirmExport = async () => {
    setShowExport(false)
    const exportCount = exportOptions.range === "current" ? paged.length : filtered.length
    try {
      const sp = new URLSearchParams({ q: keyword, format: exportOptions.format })
      const res = await fetch(`/api/search/export?${sp.toString()}`)
      if (res.status === 501) {
        const body = await res.json().catch(() => null)
        toast({
          title: "导出未实现",
          description: body?.message ?? "全文检索未接入 (REQ-4.1.1), 无可导出数据",
          variant: "destructive",
        })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const filename = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `search.${exportOptions.format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "导出完成", description: `已生成 ${exportCount} 条检索结果 (${exportOptions.format})` })
    } catch {
      toast({ title: "导出失败", description: "/api/search/export 未实现 (REQ-4.1.1 blocked)", variant: "destructive" })
    }
  }

  const handleRestore = (file: SearchFile) => {
    // R.14F: 真实回迁走 /api/control/commands, 但 file 来源是 ES (当前未接入) → 直接 blocked
    toast({
      title: "回迁命令未提交",
      description: `文件「${file.fileName}」所属 ES 检索未接入 (REQ-4.1.1), 无法定位真实 source_id`,
      variant: "destructive",
    })
  }

  return (
    <AppShell>
      <PageHeader
        title="统一检索"
        description="跨站点全局文件检索"
        badge={dataSource === "not_implemented" ? "BLOCKED" : dataSource.toUpperCase()}
        actions={
          <Button variant="outline" size="sm" className="h-8" onClick={handleExport} data-testid="search-export">
            <Download className="h-4 w-4 mr-1" />导出
          </Button>
        }
      />
      {blk && (
        <Card className="gap-0 border-amber-300 bg-amber-50" data-testid="search-blocker-banner">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm flex-1">
              <p className="font-medium text-amber-900">
                全文检索未实现 (REQ: {blk.requirement.id} {blk.requirement.text})
              </p>
              <p className="text-amber-800 mt-1">
                Blocker: <Badge variant="outline" className="border-amber-400 text-amber-800">{blk.blocker}</Badge>
                {" · "}
                {blk.reason}
              </p>
              <p className="text-amber-700 mt-1 text-xs">
                真实数据: unified_file_index {blk.currentReality.taskLevelFileIndex} 行 (任务级, {blk.currentReality.note})
                {" · "}
                下一步: {blk.nextStep}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="gap-0 border-blue-100 bg-blue-50/30">
        <CardContent className="p-4 flex gap-3">
          <Shield className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">权限可见范围</p>
            <p className="text-slate-600 mt-1">
              {blk
                ? "ES 全文检索未接入, 当前不展示站点可见范围 (REQ-2.2.1 ADFS 阻塞, 见 R.1 §4.1.3)"
                : "可检索：上海、北京、南京、武汉（4 站点）。广州/成都不可见。"}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />高级筛选</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input placeholder="全局搜索..." className="pl-11 h-11" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1) }} data-testid="search-keyword" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9" data-testid="search-site-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blocked">全部站点 (未接入)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="光盘编号" className="h-9" value={discFilter} onChange={(e) => { setDiscFilter(e.target.value); setPage(1) }} data-testid="search-disc-filter" />
            <Input placeholder="存储卷" className="h-9" value={volumeFilter} onChange={(e) => { setVolumeFilter(e.target.value); setPage(1) }} data-testid="search-volume-filter" />
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blocked">全部类型 (未接入)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blocked">全部部门 (未接入)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <AppTooltip content="执行跨站点全文检索 (依赖 ES/ClickHouse, 当前 501)">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors"
                  onClick={handleSearch}
                  data-testid="search-submit"
                  disabled={searching}
                >
                  {searching ? "检索中..." : "检索"}
                </Button>
              </AppTooltip>
              <AppTooltip content="清除所有筛选条件, 显示全部">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={handleReset}
                  data-testid="search-reset"
                  aria-label="重置筛选"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </AppTooltip>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="gap-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            检索结果
            <Badge className="ml-2">{filtered.length} 条</Badge>
            <span className="text-xs text-slate-500 font-normal ml-2">
              {dataSource === "not_implemented"
                ? "（ES 未接入, 当前 0 条; 真实数据见 unified_file_index 任务级）"
                : `（共 ${filtered.length} 条匹配记录, 第 ${(page-1)*pageSize+1}-${Math.min(page*pageSize, filtered.length)} 条）`}
            </span>
          </CardTitle>
        </CardHeader>
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
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500" data-testid="search-empty">
                    {dataSource === "not_implemented"
                      ? "全文检索未接入 (REQ-4.1.1 blocked_by_external_system), 当前无可检索文件"
                      : "未找到匹配的检索结果"}
                  </TableCell>
                </TableRow>
              ) : paged.map((f) => (
                <TableRow key={f.id} className="hover:bg-blue-50/50 transition-colors cursor-pointer">
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
                      <AppTooltip content="发起回迁请求 (依赖 ES 检索定位)">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          onClick={() => handleRestore(f)}
                          data-testid="search-row-restore"
                        >
                          发起回迁
                        </Button>
                      </AppTooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-slate-500">第 {page}/{totalPages} 页，共 {filtered.length} 条</p>
            <div className="flex gap-2">
              <AppTooltip content="上一页">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer hover:bg-slate-100 transition-colors disabled:cursor-not-allowed"
                  disabled={page<=1}
                  onClick={() => setPage(p=>p-1)}
                  aria-label="上一页"
                >
                  <ChevronLeft className="h-4 w-4"/>
                </Button>
              </AppTooltip>
              <AppTooltip content="下一页">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer hover:bg-slate-100 transition-colors disabled:cursor-not-allowed"
                  disabled={page>=totalPages}
                  onClick={() => setPage(p=>p+1)}
                  aria-label="下一页"
                >
                  <ChevronRight className="h-4 w-4"/>
                </Button>
              </AppTooltip>
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
                  <SelectItem value="Excel">Excel (.xlsx) - R.13 未接入</SelectItem>
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
            <p className="text-xs text-slate-500">R.14F: 真实文件将含 SHA-256 完整性摘要 (非数字签名, 需 ADFS 证书)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>取消</Button>
            <Button onClick={handleConfirmExport} className="bg-blue-600 hover:bg-blue-700" data-testid="search-confirm-export">确认导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
