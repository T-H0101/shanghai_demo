"use client"

import { useEffect, useState, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import {
  isOpticalDeviceTypeLabel,
  pickDevicePort,
} from "@/lib/devices/device-display"
import { ArrowLeftRight, Loader2 } from "lucide-react"

type SiteOption = { code: string; name: string }

type DeviceOption = {
  id: string
  siteCode: string
  name: string
  ip: string
  port: string | null
  deviceType?: string
}

type MagOption = {
  magazineId: string | null
  rfid: string
  label: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites: SiteOption[]
  onRegistered?: () => void
}

const REGISTERED_TOAST =
  "盘笼移位已登记到总控，检索将按目标站点归属，等待站点库同步盘笼位置"

const OPTICAL_CODES = new Set([
  "gen2_library",
  "gen1_legacy",
  "gen1_new",
  "gen3_library",
  "gen4_library",
])

function isOpticalDevice(d: DeviceOption): boolean {
  if (isOpticalDeviceTypeLabel(d.deviceType)) return true
  return OPTICAL_CODES.has((d.deviceType ?? "").toLowerCase())
}

function pickDevices(rows: DeviceOption[]): DeviceOption[] {
  const withIp = rows.filter((d) => d.ip)
  const optical = withIp.filter(isOpticalDevice)
  return optical.length > 0 ? optical : withIp
}

async function fetchDevicesForSite(siteCode: string): Promise<DeviceOption[]> {
  const res = await fetch(`/api/racks?siteCode=${encodeURIComponent(siteCode)}`, {
    cache: "no-store",
  })
  const json = await res.json().catch(() => null)
  const rows = Array.isArray(json?.data) ? json.data : []
  return pickDevices(
    rows
      .map((r: {
        id?: string
        siteCode?: string
        rackName?: string
        ip?: string
        port?: string
        deviceType?: string
        rawData?: unknown
      }) => mapRackToCageMoveDevice({
        id: r.id ?? "",
        siteCode: r.siteCode ?? siteCode,
        rackName: r.rackName ?? r.ip ?? "",
        ip: r.ip,
        port: r.port,
        deviceType: r.deviceType,
        rawData: r.rawData,
      }))
      .filter((d: DeviceOption | null): d is DeviceOption => d != null)
  )
}

export function CageMoveDialog({ open, onOpenChange, sites, onRegistered }: Props) {
  const [operatorLabel, setOperatorLabel] = useState("当前账号")
  const [submitting, setSubmitting] = useState(false)
  const [loadingMags, setLoadingMags] = useState(false)
  const [loadingSourceDevices, setLoadingSourceDevices] = useState(false)
  const [loadingTargetDevices, setLoadingTargetDevices] = useState(false)
  const [mags, setMags] = useState<MagOption[]>([])
  const [sourceDevices, setSourceDevices] = useState<DeviceOption[]>([])
  const [targetDevices, setTargetDevices] = useState<DeviceOption[]>([])

  const [sourceSiteCode, setSourceSiteCode] = useState("")
  const [sourceDeviceId, setSourceDeviceId] = useState("")
  const [sourceRfid, setSourceRfid] = useState("")
  const [targetSiteCode, setTargetSiteCode] = useState("")
  const [targetDeviceId, setTargetDeviceId] = useState("")
  const [registrarName, setRegistrarName] = useState("")
  const [remark, setRemark] = useState("")

  const sourceDevice = sourceDevices.find((d) => d.id === sourceDeviceId)
  const targetDevice = targetDevices.find((d) => d.id === targetDeviceId)
  const selectedMag = mags.find((m) => m.rfid === sourceRfid)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const user = json?.data?.user
        setOperatorLabel(user?.displayName || user?.username || user?.id || "当前账号")
      })
      .catch(() => {
        if (!cancelled) setOperatorLabel("当前账号")
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !sourceSiteCode) {
      setSourceDevices([])
      return
    }
    let cancelled = false
    setLoadingSourceDevices(true)
    fetchDevicesForSite(sourceSiteCode)
      .then((rows) => {
        if (!cancelled) setSourceDevices(rows)
      })
      .catch(() => {
        if (!cancelled) setSourceDevices([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSourceDevices(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceSiteCode])

  useEffect(() => {
    if (!open || !targetSiteCode) {
      setTargetDevices([])
      return
    }
    let cancelled = false
    setLoadingTargetDevices(true)
    fetchDevicesForSite(targetSiteCode)
      .then((rows) => {
        if (!cancelled) setTargetDevices(rows)
      })
      .catch(() => {
        if (!cancelled) setTargetDevices([])
      })
      .finally(() => {
        if (!cancelled) setLoadingTargetDevices(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, targetSiteCode])

  useEffect(() => {
    if (!open || !sourceSiteCode || !sourceDeviceId) {
      setMags([])
      return
    }
    let cancelled = false
    setLoadingMags(true)
    fetch(
      `/api/racks/magazines?siteCode=${encodeURIComponent(sourceSiteCode)}&deviceId=${encodeURIComponent(sourceDeviceId)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const items = Array.isArray(json?.data?.items) ? json.data.items : []
        setMags(
          items.map((m: MagOption) => ({
            magazineId: m.magazineId ?? null,
            rfid: m.rfid,
            label: m.label || m.rfid,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setMags([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMags(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceSiteCode, sourceDeviceId])

  function resetForm() {
    setSourceSiteCode("")
    setSourceDeviceId("")
    setSourceRfid("")
    setTargetSiteCode("")
    setTargetDeviceId("")
    setRegistrarName("")
    setRemark("")
    setMags([])
    setSourceDevices([])
    setTargetDevices([])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!sourceDevice || !targetDevice || !selectedMag) {
      toast({
        title: "请完善选择",
        description: "原侧需站点、光盘库、盘笼；目标侧需站点、光盘库",
        variant: "destructive",
      })
      return
    }
    if (isSamePosition) {
      toast({
        title: "不允许相同位置的移位",
        description: "从同一站点同一光盘库移到自身无意义，请选择不同站点作为目标。",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/racks/cage-moves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magazineRfid: selectedMag.rfid,
          cageId: selectedMag.magazineId ?? undefined,
          sourceSiteCode,
          sourceDeviceIp: sourceDevice.ip,
          sourceDevicePort: sourceDevice.port,
          targetSiteCode,
          targetDeviceIp: targetDevice.ip,
          targetDevicePort: targetDevice.port,
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
      const message =
        typeof json?.message === "string" && json.message.trim()
          ? json.message
          : REGISTERED_TOAST
      toast({
        title: "盘笼移位已登记（总控）",
        description: message,
      })
      resetForm()
      onOpenChange(false)
      onRegistered?.()
    } finally {
      setSubmitting(false)
    }
  }

  const sourceDevicePlaceholder = !sourceSiteCode
    ? "先选站点"
    : loadingSourceDevices
      ? "加载光盘库…"
      : sourceDevices.length
        ? "选择光盘库"
        : "该站点无带 IP 的光盘库"

  const targetDevicePlaceholder = !targetSiteCode
    ? "先选站点"
    : loadingTargetDevices
      ? "加载光盘库…"
      : targetDevices.length
        ? "选择光盘库"
        : "该站点无带 IP 的光盘库"

  const isSamePosition =
    Boolean(sourceSiteCode && targetSiteCode && sourceSiteCode === targetSiteCode) ||
    Boolean(
      sourceDevice?.ip &&
        targetDevice?.ip &&
        sourceDevice.ip === targetDevice.ip
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-3xl" data-testid="cage-move-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            盘笼移位登记
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} data-testid="cage-move-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">原位置</p>
              <div className="space-y-1">
                <Label className="text-xs">站点</Label>
                <Select
                  value={sourceSiteCode || undefined}
                  onValueChange={(v) => {
                    setSourceSiteCode(v)
                    setSourceDeviceId("")
                    setSourceRfid("")
                    setMags([])
                  }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-site">
                    <SelectValue placeholder="选择原站点" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={`src-site-${s.code}`} value={s.code} className="text-xs">
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">设备（光盘库）</Label>
                <Select
                  key={`src-dev-${sourceSiteCode}`}
                  value={sourceDeviceId || undefined}
                  onValueChange={(v) => {
                    setSourceDeviceId(v)
                    setSourceRfid("")
                    setMags([])
                  }}
                  disabled={!sourceSiteCode || loadingSourceDevices}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-device">
                    <SelectValue placeholder={sourceDevicePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceDevices.map((d) => (
                      <SelectItem key={`src-dev-${d.id}`} value={d.id} className="text-xs">
                        {d.name} · {d.ip}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">盘笼（RFID）</Label>
                <Select
                  key={`src-mag-${sourceSiteCode}-${sourceDeviceId}`}
                  value={sourceRfid || undefined}
                  onValueChange={setSourceRfid}
                  disabled={!sourceDeviceId || loadingMags}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-cage">
                    <SelectValue
                      placeholder={
                        loadingMags
                          ? "加载盘笼…"
                          : sourceDeviceId
                            ? mags.length
                              ? "选择盘笼"
                              : "该库无带 RFID 盘笼"
                            : "先选光盘库"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {mags.map((m) => (
                      <SelectItem key={`mag-${m.rfid}`} value={m.rfid} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">目标位置</p>
              <div className="space-y-1">
                <Label className="text-xs">站点</Label>
                <Select
                  value={targetSiteCode || undefined}
                  onValueChange={(v) => {
                    setTargetSiteCode(v)
                    setTargetDeviceId("")
                  }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-target-site">
                    <SelectValue placeholder="选择目标站点" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={`tgt-site-${s.code}`} value={s.code} className="text-xs">
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">设备（光盘库）</Label>
                <Select
                  key={`tgt-dev-${targetSiteCode}`}
                  value={targetDeviceId || undefined}
                  onValueChange={setTargetDeviceId}
                  disabled={!targetSiteCode || loadingTargetDevices}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-target-device">
                    <SelectValue placeholder={targetDevicePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetDevices.map((d) => (
                      <SelectItem key={`tgt-dev-${d.id}`} value={d.id} className="text-xs">
                        {d.name} · {d.ip}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p
                className={`text-[11px] pt-1 ${
                  isSamePosition
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-slate-400"
                }`}
                data-testid="cage-move-same-position-hint"
              >
                {isSamePosition
                  ? "不允许相同位置的移位：当前原侧与目标侧为同一站点或同一光盘库，登记无意义。"
                  : "不允许相同位置的移位。原站点与目标站点须不同。"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="space-y-1">
              <Label className="text-xs">操作人</Label>
              <Input className="h-8 text-xs bg-slate-50 dark:bg-slate-900" value={operatorLabel} readOnly />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="submit"
              disabled={submitting || isSamePosition}
              data-testid="cage-move-submit"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              登记移位
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function mapRackToCageMoveDevice(r: {
  id: string
  siteCode: string
  rackName: string
  ip?: string
  port?: string
  deviceType?: string
  rawData?: unknown
}): DeviceOption | null {
  const ip = (r.ip ?? "").trim()
  if (!r.id || !ip) return null
  const port =
    (r.port ?? "").trim() ||
    pickDevicePort(
      r.rawData && typeof r.rawData === "object"
        ? (r.rawData as Record<string, unknown>)
        : null
    )
  return {
    id: r.id,
    siteCode: r.siteCode,
    name: r.rackName,
    ip,
    port,
    deviceType: r.deviceType,
  }
}
