"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"

interface CheckItem {
  source_site_id: string
  source_record_id: string
  source_table: string
  synced_at: string
  raw_data: Record<string, unknown>
}

function CheckResourceTab({
  endpoint,
  title,
  sourceTables,
}: {
  endpoint: string
  title: string
  sourceTables: string[]
}) {
  const [items, setItems] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(endpoint, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setItems((json.data?.items ?? []) as CheckItem[])
      setTotal(Number(json.data?.total ?? 0))
    } catch (e) {
      toast({
        title: "加载失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {title} ({total})
          </span>
          <Button size="sm" onClick={load} disabled={loading}>
            刷新
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            暂无数据。从 /sync 触发同步后会显示。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>站点</TableHead>
                <TableHead>源记录 ID</TableHead>
                <TableHead>源表</TableHead>
                <TableHead>同步时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow
                  key={`${it.source_site_id}-${it.source_record_id}`}
                >
                  <TableCell>{it.source_site_id}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {it.source_record_id}
                  </TableCell>
                  <TableCell className="text-xs">{it.source_table}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(it.synced_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          数据来源:{sourceTables.join(" / ")}
        </p>
      </CardContent>
    </Card>
  )
}

export default function CheckPage() {
  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="盘笼检查"
          description="检查、巡检、模板、扇区、日志的统一视图"
        />
        <Tabs defaultValue="overview">
          <TabsList className="h-9">
            <TabsTrigger value="overview" className="text-xs">
              概览
            </TabsTrigger>
            <TabsTrigger value="inspections" className="text-xs">
              检查分类
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">
              检查任务
            </TabsTrigger>
            <TabsTrigger value="patrols" className="text-xs">
              巡检策略
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">
              日志
            </TabsTrigger>
            <TabsTrigger value="volume" className="text-xs">
              存储卷
            </TabsTrigger>
            <TabsTrigger value="ops" className="text-xs">
              调度运维
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>盘笼检查总览</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  检查巡检族包含 15 张业务表:检查分类 / 子分类 / 项 / 扇区 /
                  模板 / 任务 / 任务项 / 任务文件 / 检查文件 / 检查日志 /
                  巡检策略 / 巡检任务 / 巡检任务项 / 巡检日志。
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  数据来源:站点源库 tbl_check_* 系列,经 dispatcher 路径 upsert 到中心库 unified_check_*。
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="inspections" className="mt-4">
            <CheckResourceTab
              endpoint="/api/check/inspections?limit=100"
              title="检查分类"
              sourceTables={[
                "unified_check_categories",
                "unified_check_sub_categories",
                "unified_check_items",
                "unified_check_sectors",
                "unified_check_templates",
              ]}
            />
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <CheckResourceTab
              endpoint="/api/check/inspections?limit=100"
              title="检查任务"
              sourceTables={[
                "unified_check_tasks",
                "unified_check_task_items",
                "unified_check_task_files",
                "unified_check_file",
                "unified_check_files",
              ]}
            />
          </TabsContent>
          <TabsContent value="patrols" className="mt-4">
            <CheckResourceTab
              endpoint="/api/check/patrols?limit=100"
              title="巡检策略"
              sourceTables={[
                "unified_check_patrol_strategies",
                "unified_check_patrol_tasks",
                "unified_check_patrol_task_items",
              ]}
            />
          </TabsContent>
          <TabsContent value="logs" className="mt-4">
            <CheckResourceTab
              endpoint="/api/check/inspections?limit=100"
              title="检查日志"
              sourceTables={["unified_check_logs", "unified_check_patrol_logs"]}
            />
          </TabsContent>
          <TabsContent value="volume" className="mt-4">
            <CheckResourceTab
              endpoint="/api/volume/storage?limit=100"
              title="存储卷"
              sourceTables={[
                "unified_volume_groups",
                "unified_volume_dataclasses",
                "unified_volume_depas",
                "unified_volume_users",
                "unified_volume_workspaces",
              ]}
            />
          </TabsContent>
          <TabsContent value="ops" className="mt-4">
            <CheckResourceTab
              endpoint="/api/schedule/ops?limit=100"
              title="调度运维"
              sourceTables={[
                "unified_schedule_jobs",
                "unified_register_managements",
                "unified_interface_tasks",
                "unified_hot_backup_records",
                "unified_hot_restore_records",
                "unified_device_devices",
                "unified_drivers",
                "unified_drivers_burns",
                "unified_raid_groups",
                "unified_hd_managers",
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
