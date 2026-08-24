"use client"

import { useCallback, useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBeijingTime } from "@/components/shared/time-format"
import { toast } from "@/hooks/use-toast"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"

export type CageMoveHistoryRow = {
  id: string
  magazine_rfid: string
  source_site_code: string
  source_site_name?: string
  source_site_ip?: string | null
  source_device_name?: string
  source_device_ip: string
  source_device_port: string | null
  target_site_code: string
  target_site_name?: string
  target_site_ip?: string | null
  target_device_name?: string
  target_device_ip: string
  target_device_port: string | null
  registrar_name: string
  status: string
  created_at: string
}

const CANCEL_TOAST = "已撤销这次移位登记。在目标站点检索将不再包含该盘笼"

function formatEndpoint(ip: string, port: string | null | undefined): string {
  const p = port?.trim()
  return p ? `${ip}:${p}` : ip
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
    <div className="text-xs leading-5">
      <div>{nameLine}</div>
      <div className="font-mono text-slate-500 dark:text-slate-400">{ipLine}</div>
    </div>
  )
}

type Props = {
  /** 登记成功后递增，触发刷新 */
  refreshToken?: number
}

export function CageMoveHistoryView({ refreshToken = 0 }: Props) {
  const [items, setItems] = useState<CageMoveHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<CageMoveHistoryRow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/racks/cage-moves?limit=50", { cache: "no-store" })
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
    }
  }, [])

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
      await loadHistory()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="racks-cage-move-content">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          登记历史（总控）。登记请用页面顶部「盘笼移位」；本列表不代表站点已执行移位。
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => void loadHistory()}
          disabled={loading}
          data-testid="cage-move-history-refresh"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          刷新
        </Button>
      </div>

      <div
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
        data-testid="cage-move-history"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">登记历史</h4>
          <span className="text-xs text-slate-400">{loading ? "加载中" : `共 ${total} 条`}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">登记时间</TableHead>
              <TableHead className="text-xs">盘笼RFID</TableHead>
              <TableHead className="text-xs">原位置</TableHead>
              <TableHead className="text-xs">目标位置</TableHead>
              <TableHead className="text-xs">登记人</TableHead>
              <TableHead className="text-xs">状态</TableHead>
              <TableHead className="text-xs text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-xs text-slate-400 text-center">
                  {loading ? "加载登记记录…" : "暂无登记"}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatBeijingTime(row.created_at)}
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.magazine_rfid}</TableCell>
                  <TableCell>
                    <LocationCell
                      siteName={row.source_site_name}
                      siteCode={row.source_site_code}
                      siteIp={row.source_site_ip}
                      deviceName={row.source_device_name}
                      deviceIp={row.source_device_ip}
                      devicePort={row.source_device_port}
                    />
                  </TableCell>
                  <TableCell>
                    <LocationCell
                      siteName={row.target_site_name}
                      siteCode={row.target_site_code}
                      siteIp={row.target_site_ip}
                      deviceName={row.target_device_name}
                      deviceIp={row.target_device_ip}
                      devicePort={row.target_device_port}
                    />
                  </TableCell>
                  <TableCell className="text-xs">{row.registrar_name}</TableCell>
                  <TableCell className="text-xs">
                    {row.status === "registered" ? "已登记" : row.status}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-red-600"
                      onClick={() => setPending(row)}
                      data-testid="cage-move-cancel"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      撤销登记
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  )
}
