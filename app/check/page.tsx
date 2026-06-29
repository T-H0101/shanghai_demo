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
            <TabsTrigger value="data" className="text-xs">
              数据接收
            </TabsTrigger>
            <TabsTrigger value="warning" className="text-xs">
              告警媒体
            </TabsTrigger>
            <TabsTrigger value="sysconfig" className="text-xs">
              系统配置
            </TabsTrigger>
            <TabsTrigger value="iso" className="text-xs">
              ISO 与文件
            </TabsTrigger>
            <TabsTrigger value="importexport" className="text-xs">
              导入导出
            </TabsTrigger>
            <TabsTrigger value="monitor" className="text-xs">
              监控运维
            </TabsTrigger>
            <TabsTrigger value="taskdetail" className="text-xs">
              任务详情
            </TabsTrigger>
            <TabsTrigger value="slot" className="text-xs">
              槽位管理
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-xs">
              备份辅助
            </TabsTrigger>
            <TabsTrigger value="download" className="text-xs">
              下载等待
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
          <TabsContent value="data" className="mt-4">
            <CheckResourceTab
              endpoint="/api/data/receive?limit=100"
              title="数据接收"
              sourceTables={[
                "unified_data_receive_lists",
                "unified_data_receive_logs",
                "unified_data_receive_tasks",
              ]}
            />
          </TabsContent>
          <TabsContent value="warning" className="mt-4">
            <CheckResourceTab
              endpoint="/api/early-warning?limit=100"
              title="告警媒体"
              sourceTables={[
                "unified_early_warnings",
                "unified_early_warning_feedbacks",
                "unified_disc_prints",
                "unified_disc_inspects",
                "unified_disc_types",
                "unified_evidence_details",
                "unified_evidence_record_drps",
                "unified_verify_details",
                "unified_verify_record_drps",
                "unified_download_records",
                "unified_upload_records",
              ]}
            />
          </TabsContent>
          <TabsContent value="sysconfig" className="mt-4">
            <CheckResourceTab
              endpoint="/api/system-config?limit=100"
              title="系统配置"
              sourceTables={[
                "unified_sys_configs",
                "unified_sys_envs",
                "unified_meta_datas",
                "unified_lib_groups",
              ]}
            />
          </TabsContent>
          <TabsContent value="iso" className="mt-4">
            <CheckResourceTab
              endpoint="/api/iso?limit=100"
              title="ISO 与文件"
              sourceTables={[
                "unified_iso_locations",
                "unified_iso_task_syncs",
                "unified_back_windows",
              ]}
            />
          </TabsContent>
          <TabsContent value="importexport" className="mt-4">
            <CheckResourceTab
              endpoint="/api/import-export?limit=100"
              title="导入导出"
              sourceTables={[
                "unified_csv_details",
                "unified_import_folder_datas",
                "unified_import_folder_logs",
                "unified_import_folder_titles",
                "unified_upload_details",
                "unified_download_details",
                "unified_export_infos",
              ]}
            />
          </TabsContent>
          <TabsContent value="monitor" className="mt-4">
            <CheckResourceTab
              endpoint="/api/monitor?limit=100"
              title="监控运维"
              sourceTables={[
                "unified_monitor_paths",
                "unified_platform_monitors",
                "unified_site_monitors",
                "unified_project_monitor_files",
                "unified_task_folders",
              ]}
            />
          </TabsContent>
          <TabsContent value="taskdetail" className="mt-4">
            <CheckResourceTab
              endpoint="/api/task-detail?limit=100"
              title="任务详情"
              sourceTables={[
                "unified_task_items",
                "unified_task_prints",
                "unified_task_certif_statuses",
              ]}
            />
          </TabsContent>
          <TabsContent value="slot" className="mt-4">
            <CheckResourceTab
              endpoint="/api/slot-files?limit=100"
              title="槽位管理"
              sourceTables={[
                "unified_slot_file_1000000",
                "unified_slot_file_12",
                "unified_slot_file_13",
                "unified_slot_file_15",
                "unified_slot_file_30",
                "unified_slot_file_31",
                "unified_slot_folder_1000000",
                "unified_slot_folder_12",
                "unified_slot_folder_13",
                "unified_slot_folder_15",
                "unified_slot_folder_30",
                "unified_slot_folder_31",
              ]}
            />
          </TabsContent>
          <TabsContent value="backup" className="mt-4">
            <CheckResourceTab
              endpoint="/api/final-batch-a?limit=100"
              title="备份辅助"
              sourceTables={[
                "unified_backup_dbs",
                "unified_disk_checks",
                "unified_diskfile_checks",
                "unified_hd_powers",
              ]}
            />
          </TabsContent>
          <TabsContent value="download" className="mt-4">
            <CheckResourceTab
              endpoint="/api/final-batch-b?limit=100"
              title="下载等待"
              sourceTables={[
                "unified_receipt_file_details",
                "unified_slots_parts",
                "unified_wait_download_files",
                "unified_wait_download_file_tasks",
              ]}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
