"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"
import { Loader2 } from "lucide-react"

type SiteOption = { code: string; name: string }

type DeviceOption = { siteCode: string; ip: string; name: string }

type CageMoveRow = {
  id: string
  cage_id: string | null
  magazine_rfid: string
  source_site_code: string
  source_device_ip: string
  source_device_port: string | null
  target_site_code: string
  target_device_ip: string
  target_device_port: string | null
  registrar_name: string
  operator_account_id: string
  remark: string | null
  status: string
  created_at: string
}

const REGISTERED_TOAST =
  "盘笼移位已登记到总控，检索将按目标站点归属，等待站点库同步盘笼位置"

function formatEndpoint(ip: string, port: string | null | undefined): string {
  const p = port?.trim()
  return p ? `${ip}:${p}` : ip
}

export function CageMoveView() {
  const [sites, setSites] = useState<SiteOption[]>([])
  const [devices, setDevices] = useState<DeviceOption[]>([])
  const [operatorLabel, setOperatorLabel] = useState("未登录")
  const [items, setItems] = useState<CageMoveRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [magazineRfid, setMagazineRfid] = useState("")
  const [cageId, setCageId] = useState("")
  const [sourceSiteCode, setSourceSiteCode] = useState("")
  const [targetSiteCode, setTargetSiteCode] = useState("")
  const [sourceDeviceIp, setSourceDeviceIp] = useState("")
  const [targetDeviceIp, setTargetDeviceIp] = useState("")
  const [sourceDevicePort, setSourceDevicePort] = useState("")
  const [targetDevicePort, setTargetDevicePort] = useState("")
  const [registrarName, setRegistrarName] = useState("")
  const [remark, setRemark] = useState("")

  const sourceIps = useMemo(
    () => devices.filter((d) => d.siteCode === sourceSiteCode && d.ip),
    [devices, sourceSiteCode]
  )
  const targetIps = useMemo(
    () => devices.filter((d) => d.siteCode === targetSiteCode && d.ip),
    [devices, targetSiteCode]
  )

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/racks/cage-moves?limit=50", { cache: "no-store" })
    const json = await res.json().catch(() => null)
    if (!res.ok || json?.code !== 0) {
      setItems([])
      setTotal(0)
      return
    }
    setItems(json.data?.items ?? [])
    setTotal(Number(json.data?.total ?? 0))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      setLoading(true)
      try {
        const [sitesRes, racksRes, meRes] = await Promise.all([
          fetch("/api/sites", { cache: "no-store" }),
          fetch("/api/racks", { cache: "no-store" }),
          fetch("/api/auth/me", { cache: "no-store" }),
        ])
        if (cancelled) return
        const sitesJson = sitesRes.ok ? await sitesRes.json() : null
        const rows = Array.isArray(sitesJson?.data) ? sitesJson.data : []
        setSites(
          rows.map((s: { code?: string; id?: string; name?: string }) => ({
            code: s.code ?? s.id ?? "",
            name: s.name ?? s.code ?? s.id ?? "",
          })).filter((s: SiteOption) => s.code)
        )
        const racksJson = racksRes.ok ? await racksRes.json() : null
        const racks = Array.isArray(racksJson?.data) ? racksJson.data : []
        setDevices(
          racks
            .map((r: { siteCode?: string; ip?: string; rackName?: string }) => ({
              siteCode: r.siteCode ?? "",
              ip: (r.ip ?? "").trim(),
              name: r.rackName ?? r.ip ?? "",
            }))
            .filter((d: DeviceOption) => d.siteCode && d.ip)
        )
        if (meRes.ok) {
          const meJson = await meRes.json()
          const user = meJson?.data?.user
          setOperatorLabel(user?.displayName || user?.username || user?.id || "当前账号")
        } else {
          setOperatorLabel("未登录")
        }
        await loadHistory()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [loadHistory])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/racks/cage-moves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magazineRfid,
          cageId: cageId.trim() || undefined,
          sourceSiteCode,
          sourceDeviceIp,
          sourceDevicePort: sourceDevicePort.trim() || null,
          targetSiteCode,
          targetDeviceIp,
          targetDevicePort: targetDevicePort.trim() || null,
          registrarName,
          remark: remark.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.code !== 0) {
        toast({
          title: "登记未写入",
          description: json?.error ?? `HTTP ${res.status}`,
          variant: "destructive",
        })
        return
      }
      const message = typeof json?.message === "string" && json.message.trim()
        ? json.message
        : REGISTERED_TOAST
      toast({
        title: "盘笼移位已登记（总控）",
        description: message,
      })
      setMagazineRfid("")
      setCageId("")
      setRemark("")
      await loadHistory()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="racks-cage-move-content">
      <p className="text-xs text-amber-700 dark:text-amber-300">
        本页只把 RFID 当前位置登记到总控，检索按目标站点归属。不向站点下发移位，也不改文件索引文档。
      </p>

      <form
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3"
        data-testid="cage-move-form"
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">盘笼 RFID</Label>
            <Input
              className="h-8 text-xs"
              value={magazineRfid}
              onChange={(e) => setMagazineRfid(e.target.value)}
              required
              data-testid="cage-move-rfid"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">盘笼 ID（源站备注，可选）</Label>
            <Input
              className="h-8 text-xs"
              value={cageId}
              onChange={(e) => setCageId(e.target.value)}
              data-testid="cage-move-cage-id"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">操作人</Label>
            <Input className="h-8 text-xs bg-slate-50 dark:bg-slate-900" value={operatorLabel} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">原站点</Label>
            <Select
              value={sourceSiteCode || undefined}
              onValueChange={(v) => {
                setSourceSiteCode(v)
                setSourceDeviceIp("")
              }}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-site">
                <SelectValue placeholder="选择原站点" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={`src-${s.code}`} value={s.code} className="text-xs">
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">原设备 IP</Label>
            <Input
              className="h-8 text-xs"
              list="cage-move-source-ips"
              value={sourceDeviceIp}
              onChange={(e) => setSourceDeviceIp(e.target.value)}
              required
              data-testid="cage-move-source-ip"
            />
            <datalist id="cage-move-source-ips">
              {sourceIps.map((d) => (
                <option key={`src-ip-${d.ip}`} value={d.ip}>
                  {d.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">原设备端口（可选）</Label>
            <Input
              className="h-8 text-xs"
              value={sourceDevicePort}
              onChange={(e) => setSourceDevicePort(e.target.value)}
              data-testid="cage-move-source-port"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">目标站点</Label>
            <Select
              value={targetSiteCode || undefined}
              onValueChange={(v) => {
                setTargetSiteCode(v)
                setTargetDeviceIp("")
              }}
            >
              <SelectTrigger className="h-8 text-xs" data-testid="cage-move-target-site">
                <SelectValue placeholder="选择目标站点" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={`tgt-${s.code}`} value={s.code} className="text-xs">
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">目标设备 IP</Label>
            <Input
              className="h-8 text-xs"
              list="cage-move-target-ips"
              value={targetDeviceIp}
              onChange={(e) => setTargetDeviceIp(e.target.value)}
              required
              data-testid="cage-move-target-ip"
            />
            <datalist id="cage-move-target-ips">
              {targetIps.map((d) => (
                <option key={`tgt-ip-${d.ip}`} value={d.ip}>
                  {d.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">目标设备端口（可选）</Label>
            <Input
              className="h-8 text-xs"
              value={targetDevicePort}
              onChange={(e) => setTargetDevicePort(e.target.value)}
              data-testid="cage-move-target-port"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">登记人</Label>
            <Input
              className="h-8 text-xs"
              value={registrarName}
              onChange={(e) => setRegistrarName(e.target.value)}
              required
              data-testid="cage-move-registrar"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">说明（可选）</Label>
            <Textarea
              className="min-h-16 text-xs"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              data-testid="cage-move-remark"
            />
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            data-testid="cage-move-submit"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            登记移位
          </Button>
        </div>
      </form>

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
              <TableHead className="text-xs">RFID</TableHead>
              <TableHead className="text-xs">盘笼 ID</TableHead>
              <TableHead className="text-xs">原位置</TableHead>
              <TableHead className="text-xs">目标位置</TableHead>
              <TableHead className="text-xs">登记人</TableHead>
              <TableHead className="text-xs">状态</TableHead>
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
                  <TableCell className="text-xs">{row.cage_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {row.source_site_code} / {formatEndpoint(row.source_device_ip, row.source_device_port)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.target_site_code} / {formatEndpoint(row.target_device_ip, row.target_device_port)}
                  </TableCell>
                  <TableCell className="text-xs">{row.registrar_name}</TableCell>
                  <TableCell className="text-xs">{row.status === "registered" ? "已登记" : row.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
