"use client"

import { useCallback, useState, useEffect, type MutableRefObject } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatBeijingTime } from "@/components/shared/time-format"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Loader2, Trash2 } from "lucide-react"

export type CageMoveHistoryRow = {
  id: string
  magazine_rfid: string
  source_region_code?: string
  source_region_name?: string
  source_site_code: string | null
  source_site_name?: string | null
  source_site_ip?: string | null
  source_device_name?: string | null
  source_device_ip: string | null
  source_device_port: string | null
  target_region_code?: string
  target_region_name?: string
  target_site_code: string | null
  target_site_name?: string | null
  target_site_ip?: string | null
  target_device_name?: string | null
  target_device_ip: string | null
  target_device_port: string | null
  registrar_name: string
  status: string
  created_at: string
  is_latest_registered?: boolean
}

const CANCEL_TOAST = "已撤销这次移位登记。在目标区域检索将不再包含该盘笼"
const RFID_FILTER_ALL = "__all__"

function formatEndpoint(ip: string, port: string | null | undefined): string {
  const p = port?.trim()
  return p ? `${ip}:${p}` : ip
}

function SourceLocationCell({
  regionName,
  regionCode,
  siteName,
  siteCode,
  siteIp,
  deviceName,
  deviceIp,
  devicePort,
}: {
  regionName?: string
  regionCode?: string
  siteName?: string | null
  siteCode?: string | null
  siteIp?: string | null
  deviceName?: string | null
  deviceIp?: string | null
  devicePort?: string | null
}) {
  const hasDevice = Boolean(deviceIp?.trim())
  if (hasDevice && siteCode) {
    return (
      <LocationCell
        siteName={siteName ?? undefined}
        siteCode={siteCode}
        siteIp={siteIp}
        deviceName={deviceName ?? undefined}
        deviceIp={deviceIp!}
        devicePort={devicePort ?? null}
      />
    )
  }
  const code = regionCode?.trim() || "—"
  const name = regionName?.trim() || code
  return (
    <div className="text-sm leading-5">
      <div>{name} ({code})</div>
      <div className="text-slate-500 dark:text-slate-400">区域来源（再迁，无站/设备）</div>
    </div>
  )
}

function TargetRegionCell({
  regionName,
  regionCode,
  siteName,
  siteCode,
  deviceName,
  deviceIp,
  devicePort,
}: {
  regionName?: string
  regionCode?: string
  siteName?: string | null
  siteCode?: string | null
  deviceName?: string | null
  deviceIp?: string | null
  devicePort?: string | null
}) {
  const code = regionCode?.trim() || "—"
  const name = regionName?.trim() || code
  const hasDevice = Boolean(deviceIp?.trim())
  if (hasDevice && siteCode) {
    return (
      <LocationCell
        siteName={siteName ?? undefined}
        siteCode={siteCode}
        siteIp={null}
        deviceName={deviceName ?? undefined}
        deviceIp={deviceIp!}
        devicePort={devicePort ?? null}
      />
    )
  }
  return (
    <div className="text-sm leading-5">
      <div>{name} ({code})</div>
      <div className="text-slate-500 dark:text-slate-400">区域目标（未指定站/设备）</div>
    </div>
  )
}

function LocationCell({
  siteName,
  siteCode,
  siteIp,
  deviceName,
  deviceIp,
  devicePort,
}: {
  siteName?: string
  siteCode: string
  siteIp?: string | null
  deviceName?: string
  deviceIp: string
  devicePort: string | null
}) {
  const nameLine = `${siteName?.trim() || siteCode} / ${deviceName?.trim() || "—"}`
  const ipLine = `${siteIp?.trim() || siteCode} / ${formatEndpoint(deviceIp, devicePort)}`
  return (
    <div className="text-sm leading-5">
      <div>{nameLine}</div>
      <div className="font-mono text-slate-500 dark:text-slate-400">{ipLine}</div>
    </div>
  )
}

type Props = {
  /** 登记成功后递增，触发刷新 */
  refreshToken?: number
  className?: string
  refreshRef?: MutableRefObject<(() => Promise<void>) | null>
  onLoadingChange?: (loading: boolean) => void
}

export function CageMoveHistoryView({
  refreshToken = 0,
  className,
  refreshRef,
  onLoadingChange,
}: Props) {
  const [items, setItems] = useState<CageMoveHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<CageMoveHistoryRow | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [rfidOptions, setRfidOptions] = useState<string[]>([])
  const [rfidFilter, setRfidFilter] = useState(RFID_FILTER_ALL)

  const loadRfidOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/racks/cage-moves?rfidsOnly=1", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.code === 0 && Array.isArray(json.data?.rfids)) {
        setRfidOptions(json.data.rfids as string[])
      }
    } catch {
      /* ignore */
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    onLoadingChange?.(true)
    try {
      const qs = new URLSearchParams({ limit: "50" })
      if (rfidFilter && rfidFilter !== RFID_FILTER_ALL) {
        qs.set("magazineRfid", rfidFilter)
      }
      const res = await fetch(`/api/racks/cage-moves?${qs.toString()}`, { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.code !== 0) {
        setItems([])
        setTotal(0)
        return
      }
      setItems(json.data?.items ?? [])
      setTotal(Number(json.data?.total ?? 0))
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [onLoadingChange, rfidFilter])

  useEffect(() => {
    if (refreshRef) refreshRef.current = loadHistory
    return () => {
      if (refreshRef) refreshRef.current = null
    }
  }, [loadHistory, refreshRef])

  useEffect(() => {
    void loadRfidOptions()
  }, [loadRfidOptions, refreshToken])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory, refreshToken])

  async function confirmCancel() {
    if (!pending) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/racks/cage-moves/${encodeURIComponent(pending.id)}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.code !== 0) {
        toast({
          title: "登记未撤销",
          description: json?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        })
        return
      }
      const message =
        typeof json?.message === "string" && json.message.trim()
          ? json.message
          : CANCEL_TOAST
      toast({
        title: "移位登记已撤销",
        description: message,
      })
      setPending(null)
      await loadRfidOptions()
      await loadHistory()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <Card
      className={cn(
        "flex min-h-0 flex-col gap-0 overflow-hidden py-0",
        "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
        className,
      )}
      data-testid="racks-cage-move-content"
    >
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-slate-100 px-5 !py-3 dark:border-slate-700">
        <CardTitle className="flex min-h-9 items-center gap-2 text-base font-medium">
          登记记录
          <span className="text-sm font-normal text-muted-foreground">
            {loading ? "加载中" : `共 ${total} 条`}
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-slate-500 whitespace-nowrap">盘笼筛选</Label>
          <Select value={rfidFilter} onValueChange={setRfidFilter}>
            <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="cage-move-rfid-filter">
              <SelectValue placeholder="全部盘笼" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RFID_FILTER_ALL} className="text-xs">
                全部盘笼
              </SelectItem>
              {rfidOptions.map((rfid) => (
                <SelectItem key={rfid} value={rfid} className="text-xs font-mono">
                  {rfid}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-auto p-0" data-testid="cage-move-history">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
            <TableRow>
              <TableHead className="text-sm text-slate-500">登记时间</TableHead>
              <TableHead className="text-sm text-slate-500">盘笼RFID</TableHead>
              <TableHead className="text-sm text-slate-500">原位置</TableHead>
              <TableHead className="text-sm text-slate-500">目标位置</TableHead>
              <TableHead className="text-sm text-slate-500">登记人</TableHead>
              <TableHead className="text-sm text-slate-500">状态</TableHead>
              <TableHead className="text-sm text-slate-500 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-400">
                  {loading ? "加载登记记录…" : "暂无登记"}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const canCancel =
                  row.status === "registered" && Boolean(row.is_latest_registered)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatBeijingTime(row.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{row.magazine_rfid}</TableCell>
                    <TableCell>
                      <SourceLocationCell
                        regionName={row.source_region_name}
                        regionCode={row.source_region_code}
                        siteName={row.source_site_name}
                        siteCode={row.source_site_code}
                        siteIp={row.source_site_ip}
                        deviceName={row.source_device_name}
                        deviceIp={row.source_device_ip}
                        devicePort={row.source_device_port}
                      />
                    </TableCell>
                    <TableCell>
                      <TargetRegionCell
                        regionName={row.target_region_name}
                        regionCode={row.target_region_code}
                        siteName={row.target_site_name}
                        siteCode={row.target_site_code}
                        deviceName={row.target_device_name}
                        deviceIp={row.target_device_ip}
                        devicePort={row.target_device_port}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{row.registrar_name}</TableCell>
                    <TableCell className="text-sm">
                      {row.status === "registered"
                        ? "已登记"
                        : row.status === "cancelled"
                          ? "已撤销"
                          : row.status}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-sm text-red-600 disabled:text-slate-400"
                        disabled={!canCancel}
                        title={
                          canCancel
                            ? "撤销本条登记"
                            : "仅可撤销该盘笼最近一次移位登记"
                        }
                        onClick={() => setPending(row)}
                        data-testid="cage-move-cancel"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        撤销登记
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={pending != null} onOpenChange={(v) => { if (!v && !cancelling) setPending(null) }}>
        <DialogContent className="sm:max-w-md" data-testid="cage-move-cancel-dialog">
          <DialogHeader>
            <DialogTitle>撤销本条移位登记</DialogTitle>
            <DialogDescription>
              确认撤销盘笼
              {pending ? (
                <>
                  {" "}
                  <span className="font-mono font-medium">{pending.magazine_rfid}</span>
                </>
              ) : null}{" "}
              的这次移位登记。撤销后，检索将按登记前的站点归属显示。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setPending(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void confirmCancel()}
              data-testid="cage-move-cancel-confirm"
            >
              {cancelling && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              确认撤销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
