"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  LayoutGrid,
  Database,
  Activity,
  AlertTriangle,
} from "lucide-react"

const statsData = [
  {
    icon: LayoutGrid,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    badge: { label: "ACTIVE", color: "bg-emerald-500" },
    title: "全局站点总数",
    value: "24",
    unit: "个可用站点",
    details: [
      { label: "正常", value: "22", color: "text-blue-600" },
      { label: "负载高", value: "1", color: "text-amber-600" },
      { label: "离线", value: "1", color: "text-red-600" },
    ],
  },
  {
    icon: Database,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    badge: { label: "CAPACITY", color: "bg-blue-500" },
    title: "光盘库容量分析",
    value: "1.2",
    unit: "PB 已 0 PB (60%)",
    subtitle: "预计可储: 18万张",
    progress: 60,
    footer: "月环比增长: +4.2%",
    trend: "↑ 趋势上涨",
  },
  {
    icon: Activity,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    title: "活跃流水任务",
    value: "156",
    unit: "并发处理中",
    qps: "QPS: 840 (峰值 1.2k)",
  },
  {
    icon: AlertTriangle,
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    title: "异常事件响应 (24h)",
    value: "3",
    unit: "未处理告警",
    alerts: [
      { level: 1, color: "bg-red-500" },
      { level: 2, color: "bg-amber-500" },
    ],
    action: "立即查看",
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Card 1 - Sites */}
      <Card className="p-5 gap-0">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${statsData[0].iconBg}`}>
            <LayoutGrid className={`h-6 w-6 ${statsData[0].iconColor}`} />
          </div>
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
            ACTIVE
          </Badge>
        </div>
        <p className="text-sm text-slate-500 mb-1">{statsData[0].title}</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-slate-900">{statsData[0].value}</span>
          <span className="text-sm text-slate-500">{statsData[0].unit}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-blue-600">● 22 正常</span>
          <span className="text-amber-600">● 1 负载高</span>
          <span className="text-red-600">● 1 离线</span>
        </div>
      </Card>

      {/* Card 2 - Capacity */}
      <Card className="p-5 gap-0">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-orange-50">
            <Database className="h-6 w-6 text-orange-600" />
          </div>
          <div className="text-right">
            <Badge className="bg-blue-500 text-white hover:bg-blue-500">
              CAPACITY
            </Badge>
            <p className="text-xs text-slate-400 mt-1">预计可储: 18万张</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-1">光盘库容量分析</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-slate-900">1.2</span>
          <span className="text-sm text-slate-500">PB 已 0 PB (60%)</span>
        </div>
        <Progress value={60} className="h-2 mb-2" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">月环比增长: +4.2%</span>
          <span className="text-emerald-600">↑ 趋势上涨</span>
        </div>
      </Card>

      {/* Card 3 - Active Tasks */}
      <Card className="p-5 gap-0">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-purple-50">
            <Activity className="h-6 w-6 text-purple-600" />
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-1">活跃流水任务</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-slate-900">156</span>
          <span className="text-sm text-slate-500">并发处理中</span>
        </div>
        <div className="text-xs text-slate-500">
          <span>↗ QPS: 840 (峰值 1.2k)</span>
        </div>
      </Card>

      {/* Card 4 - Alerts */}
      <Card className="p-5 gap-0">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-lg bg-red-50">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-1">异常事件响应 (24h)</p>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-red-600">3</span>
          <span className="text-sm text-slate-500">未处理告警</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-5 w-5 rounded bg-red-500 text-white text-xs flex items-center justify-center">1</span>
            <span className="h-5 w-5 rounded bg-amber-500 text-white text-xs flex items-center justify-center">2</span>
          </div>
          <button className="text-xs text-orange-600 hover:underline">立即查看</button>
        </div>
      </Card>
    </div>
  )
}
