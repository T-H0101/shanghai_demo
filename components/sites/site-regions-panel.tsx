"use client"

/**
 * 站点区域维护：增删改 + 挂靠业务站点（总控主数据）
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, MapPinned, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export type RegionRow = {
  code: string
  name: string
  description: string
  status: "active" | "inactive"
  siteCount: number
  sites: Array<{ code: string; name: string }>
}

type SiteOption = { code: string; name: string }

type Props = {
  /** 已注册业务站点，供挂靠多选 */
  availableSites: SiteOption[]
  className?: string
  /** 区域或挂靠变更后回调（用于刷新站点列表「所属区域」） */
  onChanged?: () => void
}

export function SiteRegionsPanel({ availableSites, className, onChanged }: Props) {
  const [regions, setRegions] = useState<RegionRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)

  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editSites, setEditSites] = useState<string[]>([])
  const [siteFilter, setSiteFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/sites/regions", {
        cache: "no-store",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      const list = (json.data?.regions ?? []) as RegionRow[]
      setRegions(list)
      setSelected((prev) => {
        if (prev && list.some((r) => r.code === prev)) return prev
        return list[0]?.code ?? null
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setRegions([])
      toast({ title: "加载站点区域失败", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const current = regions.find((r) => r.code === selected) ?? null

  useEffect(() => {
    if (!current) {
      setEditName("")
      setEditDesc("")
      setEditSites([])
      return
    }
    setEditName(current.name)
    setEditDesc(current.description ?? "")
    setEditSites(current.sites.map((s) => s.code))
  }, [current?.code, current?.name, current?.description, current?.sites])

  const dirty = useMemo(() => {
    if (!current) return false
    const sitesChanged =
      [...editSites].sort().join("|") !==
      current.sites
        .map((s) => s.code)
        .sort()
        .join("|")
    return (
      editName.trim() !== current.name ||
      (editDesc.trim() || "") !== (current.description || "") ||
      sitesChanged
    )
  }, [current, editName, editDesc, editSites])

  const filteredSites = useMemo(() => {
    const q = siteFilter.trim().toLowerCase()
    if (!q) return availableSites
    return availableSites.filter(
      (s) =>
        s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    )
  }, [availableSites, siteFilter])

  /** 其它区域已占用的站点（本区域除外） */
  const occupiedElsewhere = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of regions) {
      if (r.code === selected) continue
      for (const s of r.sites) map.set(s.code, r.name)
    }
    return map
  }, [regions, selected])

  const toggleSite = (code: string, checked: boolean) => {
    setEditSites((prev) => {
      if (checked) return prev.includes(code) ? prev : [...prev, code]
      return prev.filter((c) => c !== code)
    })
  }

  const createRegion = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/sites/regions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          name: newName.trim(),
          description: newDesc.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "站点区域已创建", description: json.data?.code })
      setCreateOpen(false)
      setNewCode("")
      setNewName("")
      setNewDesc("")
      await load()
      if (json.data?.code) setSelected(json.data.code)
      onChanged?.()
    } catch (e) {
      toast({
        title: "创建失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const saveRegion = async () => {
    if (!current || !dirty) return
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/regions/${encodeURIComponent(current.code)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          siteCodes: editSites,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "站点区域已保存" })
      await load()
      onChanged?.()
    } catch (e) {
      toast({
        title: "保存失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const deleteRegion = async () => {
    if (!current) return
    if (
      !window.confirm(
        `确认删除站点区域「${current.name}」(${current.code})？已挂靠站点将变为未归属。`,
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/sites/regions/${encodeURIComponent(current.code)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "站点区域已删除" })
      setSelected(null)
      await load()
      onChanged?.()
    } catch (e) {
      toast({
        title: "删除失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn("grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3", className)}>
      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden lg:col-span-1">
        <CardHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-slate-100 py-3 dark:border-slate-700">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MapPinned className="h-4 w-4 text-slate-500" />
            站点区域
            <span className="text-xs font-normal text-slate-400">{regions.length}</span>
          </CardTitle>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCreateOpen(true)}
            data-testid="site-region-create-open"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            新建
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="space-y-2 p-3 text-sm text-red-600">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="h-7" onClick={() => void load()}>
                重试
              </Button>
            </div>
          ) : regions.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              暂无站点区域。请先新建，例如编码 SH、名称「上海」。
            </p>
          ) : (
            <ul className="space-y-1">
              {regions.map((r) => (
                <li key={r.code}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                      selected === r.code
                        ? "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                    )}
                    onClick={() => setSelected(r.code)}
                    data-testid={`site-region-item-${r.code}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{r.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{r.code}</span>
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                      {r.siteCount} 站
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col gap-0 overflow-hidden lg:col-span-2">
        <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 border-b border-slate-100 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">
              {current ? current.name : "选择区域"}
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {current
                ? `编码 ${current.code} · 将业务站点（如上海1）挂到本区域`
                : "从左侧选择或新建站点区域"}
            </p>
          </div>
          {current && (
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-red-600"
                disabled={saving}
                onClick={() => void deleteRegion()}
                data-testid="site-region-delete"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                删除
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                disabled={!dirty || saving || !editName.trim()}
                onClick={() => void saveRegion()}
                data-testid="site-region-save"
              >
                {saving ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                保存
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!current ? (
            <p className="py-10 text-center text-sm text-slate-400">请选择左侧区域</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="region-name">区域名称</Label>
                  <Input
                    id="region-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    data-testid="site-region-name"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>区域编码</Label>
                  <Input value={current.code} disabled className="font-mono" />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="region-desc">说明</Label>
                  <Input
                    id="region-desc"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="可选"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    挂靠业务站点
                  </h4>
                  <Input
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                    placeholder="筛选站点…"
                    className="h-8 max-w-xs text-sm"
                  />
                </div>
                {availableSites.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                    暂无已注册业务站点
                  </p>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                    {filteredSites.map((s) => {
                      const checked = editSites.includes(s.code)
                      const other = occupiedElsewhere.get(s.code)
                      return (
                        <li
                          key={s.code}
                          className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        >
                          <Checkbox
                            id={`region-site-${s.code}`}
                            checked={checked}
                            onCheckedChange={(v) => toggleSite(s.code, v === true)}
                          />
                          <label
                            htmlFor={`region-site-${s.code}`}
                            className="min-w-0 flex-1 cursor-pointer text-sm"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                              {s.name}
                            </span>
                            <span className="ml-2 font-mono text-[11px] text-slate-400">
                              {s.code}
                            </span>
                            {other && !checked && (
                              <span className="ml-2 text-[11px] text-amber-600">
                                当前属「{other}」，勾选后将改挂本区域
                              </span>
                            )}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  已选 {editSites.length} 个站点
                  {dirty ? " · 有未保存更改" : ""}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建站点区域</DialogTitle>
            <DialogDescription>
              区域为总控主数据，用于归类业务站点（如上海1、上海2 同属上海）。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-region-code">区域编码</Label>
              <Input
                id="new-region-code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="如 SH"
                className="font-mono"
                data-testid="site-region-create-code"
              />
              <p className="text-[11px] text-slate-400">大写字母开头，仅字母数字下划线</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-region-name">区域名称</Label>
              <Input
                id="new-region-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如 上海"
                data-testid="site-region-create-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-region-desc">说明</Label>
              <Input
                id="new-region-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void createRegion()}
              disabled={creating || !newCode.trim() || !newName.trim()}
              data-testid="site-region-create-submit"
            >
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pencil className="mr-1 h-4 w-4" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
