"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { StatCard } from "@/components/platform/stat-card"
import { DetailPanel } from "@/components/platform/detail-panel"
import { LogResultBadge } from "@/components/platform/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditStats, auditLogs } from "@/lib/mock/audit"
import type { AuditLog, AuditTab } from "@/lib/types/audit"
import type { LogResult } from "@/lib/types/common"
import { FileText, Download, ShieldCheck, Link2, Loader2, Copy, Check } from "lucide-react"
import { toast } from "@/hooks/use-toast"

const tabMap: { label: string; value: AuditTab }[] = [
  { label: "操作流水", value: "operations" }, { label: "安全日志", value: "security" },
  { label: "系统日志", value: "system" }, { label: "任务日志", value: "task" },
  { label: "合规报表", value: "compliance" }, { label: "告警策略", value: "alerts" },
]

export default function Page() {
  const [logs] = useState<AuditLog[]>(auditLogs)
  const [tab, setTab] = useState<AuditTab>("operations")
  const [selected, setSelected] = useState<AuditLog | null>(auditLogs[0])
  const [siteFilter, setSiteFilter] = useState("")
  const [operatorFilter, setOperatorFilter] = useState("")
  const [resultFilter, setResultFilter] = useState<LogResult | "all">("all")
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const filtered = logs.filter((l) => {
    const matchTab =
      tab === "operations" ? l.type === "operation" :
      tab === "security" ? l.type === "security" :
      tab === "system" ? l.type === "system" :
      tab === "task" ? l.type === "task" :
      tab === "compliance" ? l.type === "compliance" :
      true
    const matchSite = !siteFilter || l.siteName.includes(siteFilter)
    const matchOperator = !operatorFilter || l.operator.includes(operatorFilter)
    const matchResult = resultFilter === "all" || l.result === resultFilter
    return matchTab && matchSite && matchOperator && matchResult
  })

  const handleExport = (format: string) => {
    setExporting(true)
    toast({ title: `正在导出 ${format}...`, description: "请稍候" })
    setTimeout(() => {
      setExporting(false)
      toast({ title: "导出成功", description: `审计日志已导出为 ${format} 格式，共 ${filtered.length} 条记录` })
    }, 1500)
  }

  const handleVerifySignature = () => {
    if (!selected) return
    toast({
      title: "数字签名校验中...",
      description: "正在验证签名完整性...",
    })
    setTimeout(() => {
      if (selected.signatureValid) {
        toast({ title: "校验通过", description: "数字签名验证成功，日志内容未被篡改" })
      } else {
        toast({ title: "校验失败", description: "数字签名验证失败，日志可能已被篡改", variant: "destructive" })
      }
    }, 1000)
  }

  const handleCopyJson = () => {
    if (!selected) return
    navigator.clipboard.writeText(JSON.stringify(selected.detail, null, 2))
    setCopied(true)
    toast({ title: "已复制", description: "JSON 数据已复制到剪贴板" })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AppShell>
      <PageHeader title="审计日志" description="操作流水、安全事件与合规审计" badge="AUDIT"
        actions={<>
          <Button variant="outline" size="sm" onClick={() => handleExport("Excel")} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1"/>}Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("CSV")} disabled={exporting}>CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("JSON")} disabled={exporting}>JSON</Button>
        </>} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="24h 日志量" value={auditStats.total24h.toLocaleString()} icon={FileText} />
        <StatCard title="成功率" value={`${auditStats.successRate}%`} icon={FileText} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="安全事件" value={auditStats.securityEvents} icon={ShieldCheck} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard title="失败操作" value={auditStats.failedOps} icon={FileText} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>
      <Card className="gap-0">
        <CardHeader className="pb-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as AuditTab)}>
            <TabsList className="h-9 flex-wrap">
              {tabMap.map((t) => <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <Select defaultValue="全部">
              <SelectTrigger className="h-9"><SelectValue placeholder="日志类型"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部类型</SelectItem>
                <SelectItem value="RESTORE">回迁任务</SelectItem>
                <SelectItem value="BACKUP">备份任务</SelectItem>
                <SelectItem value="INSPECT">巡检任务</SelectItem>
                <SelectItem value="PERMISSION">权限操作</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="站点" className="h-9" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} />
            <Input placeholder="操作人" className="h-9" value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} />
            <Input placeholder="任务类型" className="h-9" />
            <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as LogResult | "all")}>
              <SelectTrigger className="h-9"><SelectValue placeholder="结果"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部结果</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failure">失败</SelectItem>
                <SelectItem value="warning">警告</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="h-9" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 overflow-x-auto">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs text-slate-500">日志ID</TableHead><TableHead className="text-xs text-slate-500">类型</TableHead>
                  <TableHead className="text-xs text-slate-500">任务类型</TableHead><TableHead className="text-xs text-slate-500">站点</TableHead>
                  <TableHead className="text-xs text-slate-500">操作人</TableHead><TableHead className="text-xs text-slate-500">时间</TableHead>
                  <TableHead className="text-xs text-slate-500">结果</TableHead><TableHead className="text-xs text-slate-500">摘要</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">未找到匹配的日志记录</TableCell></TableRow>
                  ) : filtered.map((l) => (
                    <TableRow key={l.id} className={`cursor-pointer hover:bg-slate-50 ${selected?.id===l.id?"bg-blue-50":""}`} onClick={() => setSelected(l)}>
                      <TableCell className="font-mono text-xs">{l.logId}</TableCell>
                      <TableCell className="text-sm">{l.typeLabel}</TableCell>
                      <TableCell className="text-xs">{l.taskType || "—"}</TableCell>
                      <TableCell className="text-sm">{l.siteName}</TableCell>
                      <TableCell className="text-sm">{l.operator}</TableCell>
                      <TableCell className="text-xs text-slate-500">{l.operatedAt}</TableCell>
                      <TableCell><LogResultBadge result={l.result} /></TableCell>
                      <TableCell className="text-xs max-w-[160px] truncate">{l.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DetailPanel title="日志详情 (JSON)" subtitle={selected?.logId} empty={!selected}>
              {selected && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldCheck className={`h-4 w-4 ${selected.signatureValid?"text-emerald-600":"text-red-500"}`} />
                      <span>数字签名：{selected.signatureValid ? "校验通过" : "校验失败"}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleVerifySignature}>
                      <ShieldCheck className="h-3 w-3 mr-1" />校验
                    </Button>
                  </div>
                  {selected.errorCode && <p className="text-xs text-red-600">错误码: {selected.errorCode}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">JSON 数据</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyJson}>
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? "已复制" : "复制"}
                    </Button>
                  </div>
                  <pre className="text-[11px] bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-64">{JSON.stringify(selected.detail, null, 2)}</pre>
                  {selected.traceChain && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1"><Link2 className="h-3 w-3"/>API Trace Chain</p>
                      {selected.traceChain.map((t, i) => (
                        <div key={i} className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                          <span>{t.service}</span><span className="text-slate-500">{t.latency}</span><Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DetailPanel>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}