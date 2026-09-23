"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
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
import { formatApiErrorMessage, httpStatusMessage } from "@/lib/api/http-error"
import {
  isOpticalDeviceTypeLabel,
  pickDevicePort,
} from "@/lib/devices/device-display"
import { ArrowLeftRight, Loader2 } from "lucide-react"

type SiteOption = { code: string; name: string; regionCode?: string | null }

type RegionOption = {
  code: string
  name: string
  sites: Array<{ code: string; name: string }>
}

type DeviceOption = {
  id: string
  siteCode: string
  name: string
  ip: string
  port: string | null
  deviceType?: string
}

type CageCandidate = {
  rfid: string
  label: string
  magazineId: string | null
  relocated: boolean
  siteCode: string | null
  siteName: string | null
  deviceId: string | null
  deviceName: string | null
  deviceIp: string | null
  devicePort: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites: SiteOption[]
  onRegistered?: () => void
}

const REGISTERED_TOAST =
  "盘笼移位已登记到总控，目标为站点区域，等待线下移笼"

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
      .filter((d: DeviceOption | null): d is DeviceOption => d != null),
  )
}

export function CageMoveDialog({ open, onOpenChange, sites: _sites, onRegistered }: Props) {
  const [operatorLabel, setOperatorLabel] = useState("当前账号")
  const [submitting, setSubmitting] = useState(false)
  const [loadingMags, setLoadingMags] = useState(false)
  const [loadingRegions, setLoadingRegions] = useState(false)
  const [loadingPreviewDevices, setLoadingPreviewDevices] = useState(false)
  const [cages, setCages] = useState<CageCandidate[]>([])
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [previewDevices, setPreviewDevices] = useState<DeviceOption[]>([])

  const [sourceRegionCode, setSourceRegionCode] = useState("")
  const [sourceRfid, setSourceRfid] = useState("")
  const [targetRegionCode, setTargetRegionCode] = useState("")
  const [registrarName, setRegistrarName] = useState("")
  const [remark, setRemark] = useState("")

  const selectedCage = cages.find((c) => c.rfid === sourceRfid)
  const targetRegion = regions.find((r) => r.code === targetRegionCode)

  /** 全部启用区域均可作原区域（页权限=全站） */
  const sourceRegionOptions = useMemo(() => regions, [regions])

  const targetRegionOptions = useMemo(
    () => regions.filter((r) => r.code !== sourceRegionCode),
    [regions, sourceRegionCode],
  )

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
    if (!open) return
    let cancelled = false
    setLoadingRegions(true)
    fetch("/api/sites/regions", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const rows = (json?.data?.regions ?? []) as Array<{
          code: string
          name?: string
          status?: string
          sites?: Array<{ code: string; name: string }>
        }>
        setRegions(
          rows
            .filter((r) => r.status === "active")
            .map((r) => ({
              code: r.code,
              name: r.name?.trim() || r.code,
              sites: Array.isArray(r.sites) ? r.sites : [],
            })),
        )
      })
      .catch(() => {
        if (!cancelled) setRegions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingRegions(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !targetRegionCode) {
      setPreviewDevices([])
      return
    }
    const region = regions.find((r) => r.code === targetRegionCode)
    const siteCodes = region?.sites?.map((s) => s.code).filter(Boolean) ?? []
    if (!siteCodes.length) {
      setPreviewDevices([])
      return
    }
    let cancelled = false
    setLoadingPreviewDevices(true)
    Promise.all(siteCodes.map((code) => fetchDevicesForSite(code)))
      .then((lists) => {
        if (cancelled) return
        setPreviewDevices(lists.flat())
      })
      .catch(() => {
        if (!cancelled) setPreviewDevices([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPreviewDevices(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, targetRegionCode, regions])

  useEffect(() => {
    if (!open || !sourceRegionCode) {
      setCages([])
      return
    }
    let cancelled = false
    setLoadingMags(true)
    fetch(
      `/api/racks/magazines/by-region?regionCode=${encodeURIComponent(sourceRegionCode)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const items = Array.isArray(json?.data?.items) ? json.data.items : []
        setCages(
          items.map((m: CageCandidate) => ({
            rfid: m.rfid,
            label: m.label || m.rfid,
            magazineId: m.magazineId ?? null,
            relocated: Boolean(m.relocated),
            siteCode: m.siteCode ?? null,
            siteName: m.siteName ?? null,
            deviceId: m.deviceId ?? null,
            deviceName: m.deviceName ?? null,
            deviceIp: m.deviceIp ?? null,
            devicePort: m.devicePort ?? null,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setCages([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMags(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, sourceRegionCode])

  function resetForm() {
    setSourceRegionCode("")
    setSourceRfid("")
    setTargetRegionCode("")
    setRegistrarName("")
    setRemark("")
    setCages([])
    setPreviewDevices([])
  }

  const isSameRegion =
    Boolean(sourceRegionCode && targetRegionCode && sourceRegionCode === targetRegionCode)

  const firstMigrateReady =
    selectedCage &&
    !selectedCage.relocated &&
    Boolean(selectedCage.siteCode?.trim()) &&
    Boolean(selectedCage.deviceIp?.trim())

  const remigrateReady = Boolean(selectedCage?.relocated)

  const submitBlocked =
    !selectedCage ||
    !targetRegionCode ||
    !sourceRegionCode ||
    isSameRegion ||
    (!firstMigrateReady && !remigrateReady)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedCage || !sourceRegionCode) {
      toast({
        title: "请完善选择",
        description: "请选择原区域与盘笼",
        variant: "destructive",
      })
      return
    }
    if (!selectedCage.relocated) {
      if (!selectedCage.siteCode?.trim() || !selectedCage.deviceIp?.trim()) {
        toast({
          title: "缺少设备信息",
          description: "首次迁移需能解析到所属站点与设备 IP，请检查同步数据",
          variant: "destructive",
        })
        return
      }
    }
    if (!targetRegionCode) {
      toast({
        title: "请选择目标区域",
        description: "目标位置须为站点区域",
        variant: "destructive",
      })
      return
    }
    if (isSameRegion) {
      toast({
        title: "不允许相同区域的移位",
        description: "源区域与目标区域须不同",
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
          magazineRfid: selectedCage.rfid,
          cageId: selectedCage.magazineId ?? undefined,
          sourceRegionCode,
          relocated: selectedCage.relocated,
          sourceSiteCode: selectedCage.relocated ? null : selectedCage.siteCode,
          sourceDeviceIp: selectedCage.relocated ? null : selectedCage.deviceIp,
          sourceDevicePort: selectedCage.relocated ? null : selectedCage.devicePort,
          targetRegionCode,
          registrarName,
          remark: remark.trim() || null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.code !== 0) {
        toast({
          title: "登记未写入",
          description: formatApiErrorMessage(json?.error ?? httpStatusMessage(res.status)),
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
                <Label className="text-xs">区域</Label>
                <Select
                  value={sourceRegionCode || undefined}
                  onValueChange={(v) => {
                    setSourceRegionCode(v)
                    setSourceRfid("")
                    setCages([])
                    if (targetRegionCode === v) setTargetRegionCode("")
                  }}
                  disabled={loadingRegions}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-region">
                    <SelectValue placeholder={loadingRegions ? "加载区域…" : "选择原区域"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceRegionOptions.map((r) => (
                      <SelectItem key={`src-reg-${r.code}`} value={r.code} className="text-xs">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingRegions && sourceRegionOptions.length === 0 ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    暂无启用区域，请先在站点管理中维护站点区域
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">盘笼（RFID）</Label>
                <Select
                  key={`src-mag-${sourceRegionCode}`}
                  value={sourceRfid || undefined}
                  onValueChange={setSourceRfid}
                  disabled={!sourceRegionCode || loadingMags}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-source-cage">
                    <SelectValue
                      placeholder={
                        loadingMags
                          ? "加载盘笼…"
                          : sourceRegionCode
                            ? cages.length
                              ? "选择盘笼"
                              : "该区域无可登记盘笼"
                            : "先选区域"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cages.map((m) => (
                      <SelectItem key={`mag-${m.rfid}`} value={m.rfid} className="text-xs">
                        {m.relocated ? `${m.rfid}（迁移）` : m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCage ? (
                <div
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-2.5 py-2 text-[11px] text-slate-600 dark:text-slate-300"
                  data-testid="cage-move-source-detail"
                >
                  {selectedCage.relocated ? (
                    <p>当前为盘笼移位迁入本区域（站点未定），再迁仅登记目标区域。</p>
                  ) : (
                    <div className="space-y-0.5">
                      <p>
                        所属站点：
                        {selectedCage.siteName?.trim() || selectedCage.siteCode || "—"}
                        {selectedCage.siteCode ? (
                          <span className="text-slate-400"> ({selectedCage.siteCode})</span>
                        ) : null}
                      </p>
                      <p>
                        所属设备：
                        {selectedCage.deviceName?.trim() || "—"}
                        {selectedCage.deviceIp ? (
                          <span className="font-mono text-slate-500">
                            {" "}
                            · {selectedCage.deviceIp}
                            {selectedCage.devicePort ? `:${selectedCage.devicePort}` : ""}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">（缺设备 IP，无法首次登记）</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">目标位置</p>
              <div className="space-y-1">
                <Label className="text-xs">站点区域</Label>
                <Select
                  value={targetRegionCode || undefined}
                  onValueChange={setTargetRegionCode}
                  disabled={loadingRegions}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="cage-move-target-region">
                    <SelectValue placeholder={loadingRegions ? "加载区域…" : "选择目标区域"} />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRegionOptions.map((r) => (
                      <SelectItem key={`tgt-reg-${r.code}`} value={r.code} className="text-xs">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label className="text-xs">区域下站点与设备</Label>
                  <span className="text-[10px] text-slate-400 shrink-0">仅展示，不指定设备</span>
                </div>
                <div
                  className="h-40 overflow-y-auto rounded-lg bg-slate-100/70 dark:bg-slate-900/50 p-2 space-y-2"
                  data-testid="cage-move-region-preview"
                >
                  {!targetRegionCode ? (
                    <p className="text-xs text-slate-400 px-1 py-6 text-center">选择目标区域后展示</p>
                  ) : loadingPreviewDevices ? (
                    <p className="text-xs text-slate-400 px-1 py-6 text-center">加载设备…</p>
                  ) : (targetRegion?.sites ?? []).length === 0 ? (
                    <p className="text-xs text-slate-500 px-1 py-6 text-center">该区域暂无挂靠业务站</p>
                  ) : (
                    (targetRegion?.sites ?? []).map((s) => {
                      const devs = previewDevices.filter((d) => d.siteCode === s.code)
                      return (
                        <div
                          key={s.code}
                          className="rounded-md border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-800/90 px-2.5 py-2 shadow-sm"
                        >
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                            {s.name}
                            <span className="ml-1 font-normal text-slate-400">({s.code})</span>
                          </p>
                          {devs.length ? (
                            <ul className="mt-1.5 space-y-1">
                              {devs.map((d) => (
                                <li
                                  key={d.id}
                                  className="text-[11px] font-mono text-slate-600 dark:text-slate-300 pl-2 border-l-2 border-slate-200 dark:border-slate-600"
                                >
                                  {d.name} · {d.ip}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-400">暂无光盘库设备</p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
              <p
                className={`text-[11px] pt-1 ${
                  isSameRegion
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-slate-400"
                }`}
                data-testid="cage-move-same-region-hint"
              >
                {isSameRegion
                  ? "不允许相同区域的移位：当前源区域与目标区域相同。"
                  : "目标仅登记到站点区域；物理移笼由线下完成。"}
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
              disabled={submitting || submitBlocked}
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
        : null,
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
