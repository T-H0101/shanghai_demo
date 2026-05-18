"use client"
import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { defaultSettings } from "@/lib/mock/settings"
import type { SystemSettings } from "@/lib/types/settings"
import { Save, RotateCcw, Download, Server, Mail } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export default function Page() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings)
  const svcStatus = { healthy: "正常", degraded: "降级", down: "宕机" }
  const svcColor = { healthy: "bg-emerald-500", degraded: "bg-amber-500", down: "bg-red-500" }

  const handleSave = () => {
    toast({ title: "保存成功", description: "系统设置已保存，将在下一同步周期生效" })
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    toast({ title: "已重置", description: "所有设置已恢复为默认值" })
  }

  const handleExport = () => {
    toast({ title: "导出中...", description: "正在生成配置文件..." })
    setTimeout(() => {
      toast({ title: "导出成功", description: "配置文件已导出为 config.json" })
    }, 1000)
  }

  const handleTestAlert = () => {
    toast({ title: "测试邮件发送中...", description: "正在向收件人发送测试邮件..." })
    setTimeout(() => {
      toast({ title: "发送成功", description: `测试邮件已发送至 ${settings.alert.emailRecipients}` })
    }, 1500)
  }

  return (
    <AppShell>
      <PageHeader title="系统设置" description="同步、告警、安全与任务策略配置" badge="SETTINGS"
        actions={<>
          <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-1"/>重置</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1"/>导出</Button>
          <Button size="sm" className="bg-blue-600" onClick={handleSave}><Save className="h-4 w-4 mr-1"/>保存</Button>
        </>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="gap-0">
          <CardHeader><CardTitle className="text-base">同步设置</CardTitle><CardDescription>实时与定时同步策略</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><Label>实时同步</Label><Switch checked={settings.sync.realtimeSync} onCheckedChange={(v) => setSettings({...settings, sync: {...settings.sync, realtimeSync: v}})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">定时同步周期(分钟)</Label><Input type="number" value={settings.sync.scheduledIntervalMinutes} onChange={(e) => setSettings({...settings, sync: {...settings.sync, scheduledIntervalMinutes: parseInt(e.target.value) || 0}})} className="h-9 mt-1" /></div>
              <div><Label className="text-xs">全量同步时间</Label><Input value={settings.sync.fullSyncTime} onChange={(e) => setSettings({...settings, sync: {...settings.sync, fullSyncTime: e.target.value}})} className="h-9 mt-1" /></div>
              <div><Label className="text-xs">重试次数</Label><Input type="number" value={settings.sync.retryCount} onChange={(e) => setSettings({...settings, sync: {...settings.sync, retryCount: parseInt(e.target.value) || 0}})} className="h-9 mt-1" /></div>
              <div><Label className="text-xs">重试间隔(秒)</Label><Input type="number" value={settings.sync.retryIntervalSeconds} onChange={(e) => setSettings({...settings, sync: {...settings.sync, retryIntervalSeconds: parseInt(e.target.value) || 0}})} className="h-9 mt-1" /></div>
            </div>
            <div><Label className="text-xs">一致性校验时间</Label><Input value={settings.sync.consistencyCheckTime} onChange={(e) => setSettings({...settings, sync: {...settings.sync, consistencyCheckTime: e.target.value}})} className="h-9 mt-1" /></div>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader><CardTitle className="text-base">告警设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">站点离线阈值(分钟)</Label><Input type="number" value={settings.alert.siteOfflineThresholdMinutes} onChange={(e) => setSettings({...settings, alert: {...settings.alert, siteOfflineThresholdMinutes: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
              <div><Label className="text-xs">硬件异常阈值</Label><Input type="number" value={settings.alert.hardwareAnomalyThreshold} onChange={(e) => setSettings({...settings, alert: {...settings.alert, hardwareAnomalyThreshold: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
              <div><Label className="text-xs">任务超时(分钟)</Label><Input type="number" value={settings.alert.taskTimeoutMinutes} onChange={(e) => setSettings({...settings, alert: {...settings.alert, taskTimeoutMinutes: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
              <div><Label className="text-xs">容量预警(%)</Label><Input type="number" value={settings.alert.capacityWarningPercent} onChange={(e) => setSettings({...settings, alert: {...settings.alert, capacityWarningPercent: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
            </div>
            <div className="flex items-center justify-between"><Label>邮件提醒</Label><Switch checked={settings.alert.emailNotification} onCheckedChange={(v) => setSettings({...settings, alert: {...settings.alert, emailNotification: v}})} /></div>
            <div><Label className="text-xs">收件人</Label><Input value={settings.alert.emailRecipients} onChange={(e) => setSettings({...settings, alert: {...settings.alert, emailRecipients: e.target.value}})} className="h-9 mt-1"/></div>
            <Button variant="outline" size="sm" onClick={handleTestAlert} className="mt-2"><Mail className="h-4 w-4 mr-1"/>发送测试邮件</Button>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader><CardTitle className="text-base">安全设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">JWT 过期(小时)</Label><Input type="number" value={settings.security.jwtExpiryHours} onChange={(e) => setSettings({...settings, security: {...settings.security, jwtExpiryHours: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
              <div><Label className="text-xs">登录失败锁定阈值</Label><Input type="number" value={settings.security.loginFailLockThreshold} onChange={(e) => setSettings({...settings, security: {...settings.security, loginFailLockThreshold: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
            </div>
            <div><Label className="text-xs">IP 锁定策略</Label>
              <Select value={settings.security.ipLockPolicy} onValueChange={(v) => setSettings({...settings, security: {...settings.security, ipLockPolicy: v as "strict" | "moderate" | "off"}})}>
                <SelectTrigger className="h-9 mt-1"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="strict">严格</SelectItem><SelectItem value="moderate">适中</SelectItem><SelectItem value="off">关闭</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between"><Label>敏感数据加密</Label><Switch checked={settings.security.sensitiveDataEncryption} onCheckedChange={(v) => setSettings({...settings, security: {...settings.security, sensitiveDataEncryption: v}})} /></div>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader><CardTitle className="text-base">任务设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><Label>恢复任务优先</Label><Switch checked={settings.task.restorePriority} onCheckedChange={(v) => setSettings({...settings, task: {...settings.task, restorePriority: v}})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">备份并发数</Label><Input type="number" value={settings.task.backupConcurrency} onChange={(e) => setSettings({...settings, task: {...settings.task, backupConcurrency: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
              <div><Label className="text-xs">巡检抽样比例(%)</Label><Input type="number" value={settings.task.inspectSamplePercent} onChange={(e) => setSettings({...settings, task: {...settings.task, inspectSamplePercent: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
            </div>
            <div><Label className="text-xs">日志保留周期(天)</Label><Input type="number" value={settings.task.logRetentionDays} onChange={(e) => setSettings({...settings, task: {...settings.task, logRetentionDays: parseInt(e.target.value) || 0}})} className="h-9 mt-1"/></div>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="h-5 w-5"/>服务监控</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {settings.services.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge className={`${svcColor[s.status]} text-white text-xs`}>{svcStatus[s.status]}</Badge>
                </div>
                <p className="text-xs text-slate-500 mb-3">v{s.version} · 可用性 {s.uptime} · API {s.apiLatencyMs}ms</p>
                <div className="space-y-2 text-xs">
                  <div><span className="text-slate-500 w-12 inline-block">CPU</span><Progress value={s.cpu} className="h-1.5 inline-flex flex-1 w-[calc(100%-3rem)] ml-2"/></div>
                  <div><span className="text-slate-500 w-12 inline-block">内存</span><Progress value={s.memory} className="h-1.5 flex-1 ml-2"/></div>
                  <div><span className="text-slate-500 w-12 inline-block">磁盘</span><Progress value={s.disk} className="h-1.5 flex-1 ml-2"/></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppShell>
  )
}