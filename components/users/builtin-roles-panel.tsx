"use client"

/**
 * 角色权限：左右分栏固定高度内部滚动；支持新建/编辑/删除自定义角色
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from "react"
import { Lock, Pencil, Plus, Save, Shield, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { menusForPermissions } from "@/lib/auth/menu-permissions"

type CatalogGroup = {
  id: string
  label: string
  items: { code: string; label: string }[]
}

type RoleRow = {
  code: string
  name: string
  description: string
  builtin: boolean
  editable: boolean
  deletable: boolean
  permissions: string[]
  menus: { href: string; label: string }[]
}

type Props = {
  className?: string
  refreshRef?: MutableRefObject<(() => Promise<void>) | null>
  onLoadingChange?: (loading: boolean) => void
  active?: boolean
}

export function BuiltinRolesPanel({
  className,
  refreshRef,
  onLoadingChange,
  active = true,
}: Props) {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [catalog, setCatalog] = useState<CatalogGroup[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editTarget, setEditTarget] = useState<RoleRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/roles", { cache: "no-store", credentials: "include" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`)
      }
      const list = (json.data?.roles ?? []) as RoleRow[]
      setRoles(list)
      setCatalog((json.data?.catalog ?? []) as CatalogGroup[])
      setSelected((prev) => {
        if (prev && list.some((r) => r.code === prev)) return prev
        return list[0]?.code ?? null
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setRoles([])
      toast({ title: "加载角色失败", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [onLoadingChange])

  useEffect(() => {
    if (!active || !refreshRef) return
    refreshRef.current = load
  }, [refreshRef, load, active])

  useEffect(() => {
    if (active) void load()
  }, [active, load])

  const current = roles.find((r) => r.code === selected) ?? null

  useEffect(() => {
    if (current) setDraft([...current.permissions])
    else setDraft([])
  }, [current?.code, current?.permissions.join("|")])

  const dirty = useMemo(() => {
    if (!current) return false
    return [...current.permissions].sort().join("|") !== [...draft].sort().join("|")
  }, [current, draft])

  const previewMenus = useMemo(
    () => menusForPermissions(draft).map((m) => ({ href: m.href, label: m.label })),
    [draft],
  )

  const toggle = (code: string, checked: boolean) => {
    setDraft((prev) => {
      if (checked) return prev.includes(code) ? prev : [...prev, code]
      return prev.filter((p) => p !== code)
    })
  }

  const save = async () => {
    if (!current || !current.editable) return
    setSaving(true)
    try {
      const res = await fetch(`/api/auth/roles/${encodeURIComponent(current.code)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: draft }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({
        title: "角色权限已更新",
        description: "相关用户重新登录后生效",
      })
      await load()
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

  const openCreate = () => {
    setNewCode("")
    setNewName("")
    setNewDesc("")
    setCreateOpen(true)
  }

  const openEdit = (role: RoleRow, e?: MouseEvent) => {
    e?.stopPropagation()
    setEditTarget(role)
    setEditName(role.name)
    setEditDesc(role.description ?? "")
    setEditOpen(true)
  }

  const openDelete = (role: RoleRow, e?: MouseEvent) => {
    e?.stopPropagation()
    setDeleteTarget(role)
    setDeleteOpen(true)
  }

  const createRole = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/auth/roles", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.trim().toLowerCase(),
          name: newName.trim(),
          description: newDesc.trim(),
          permissions: [],
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({
        title: "角色已创建",
        description: "请在右侧勾选功能权限后保存",
      })
      setCreateOpen(false)
      await load()
      if (json.data?.code) setSelected(json.data.code)
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

  const saveMeta = async () => {
    if (!editTarget) return
    setEditingMeta(true)
    try {
      const res = await fetch(`/api/auth/roles/${encodeURIComponent(editTarget.code)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "角色信息已更新" })
      setEditOpen(false)
      await load()
    } catch (e) {
      toast({
        title: "更新失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setEditingMeta(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/auth/roles/${encodeURIComponent(deleteTarget.code)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`)
      }
      toast({ title: "角色已删除", description: deleteTarget.name })
      setDeleteOpen(false)
      if (selected === deleteTarget.code) setSelected(null)
      await load()
    } catch (e) {
      toast({
        title: "删除失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)} data-testid="builtin-roles-panel">
      {error && (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[280px_1fr]">
        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
          <CardHeader className="shrink-0 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
            <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                角色
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={openCreate}
                data-testid="role-create-open"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                新建
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading && roles.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">加载中…</p>
            ) : roles.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">暂无角色数据</p>
            ) : (
              <ul className="space-y-1">
                {roles.map((role) => {
                  const isActive = role.code === selected
                  return (
                    <li key={role.code}>
                      <div
                        className={cn(
                          "flex items-start gap-1 rounded-lg px-2 py-1.5 transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 flex flex-col items-start gap-0.5 px-1 py-0.5 text-left text-sm"
                          onClick={() => setSelected(role.code)}
                          data-testid={`builtin-role-${role.code}`}
                        >
                          <span className="font-medium">{role.name}</span>
                          <span className="font-mono text-xs text-slate-400">{role.code}</span>
                        </button>
                        {!role.builtin && (
                          <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500"
                              title="编辑名称与说明"
                              data-testid={`role-edit-${role.code}`}
                              onClick={(e) => openEdit(role, e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              title="删除角色"
                              data-testid={`role-delete-${role.code}`}
                              onClick={(e) => openDelete(role, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
          <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-2 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">
                {current?.name ?? "选择角色"}
              </CardTitle>
              {current && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {current.description || "—"}
                </p>
              )}
            </div>
            {current && (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {current.builtin && (
                  <Badge variant="outline" className="text-xs font-normal">
                    内置
                  </Badge>
                )}
                {current.builtin && (
                  <Badge variant="outline" className="gap-1 text-xs font-normal text-slate-500">
                    <Lock className="h-3 w-3" />
                    不可删除
                  </Badge>
                )}
                {!current.editable && (
                  <Badge variant="outline" className="text-xs font-normal text-amber-700">
                    权限锁定
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {!current ? (
              <p className="py-10 text-center text-sm text-slate-400">请选择左侧角色</p>
            ) : (
              <>
                <section className="shrink-0 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    可访问菜单
                  </h4>
                  {previewMenus.length === 0 ? (
                    <p className="text-sm text-slate-400">未勾选查看类权限时，侧栏无业务菜单</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {previewMenus.map((m) => (
                        <Badge
                          key={m.href}
                          className="bg-emerald-50 font-normal text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                        >
                          {m.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </section>

                <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      功能权限
                    </h4>
                    {current.editable && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!dirty || saving}
                          onClick={() => current && setDraft([...current.permissions])}
                        >
                          还原
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!dirty || saving}
                          onClick={() => void save()}
                          data-testid="role-permissions-save"
                        >
                          <Save className="mr-1 h-3.5 w-3.5" />
                          保存
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
                    {catalog.map((group) => (
                      <div key={group.id}>
                        <h5 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          {group.label}
                        </h5>
                        <ul className="space-y-2 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                          {group.items.map((item) => {
                            const checked = draft.includes(item.code)
                            return (
                              <li key={item.code} className="flex items-start gap-2">
                                <Checkbox
                                  id={`${current.code}-${item.code}`}
                                  checked={checked}
                                  disabled={!current.editable || saving}
                                  onCheckedChange={(v) => toggle(item.code, v === true)}
                                />
                                <label
                                  htmlFor={`${current.code}-${item.code}`}
                                  className="min-w-0 flex-1 cursor-pointer text-sm leading-tight"
                                >
                                  <span className="text-slate-800 dark:text-slate-100">
                                    {item.label}
                                  </span>
                                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                                    {item.code}
                                  </span>
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <p className="shrink-0 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 dark:border-slate-800">
                    当前草稿 {draft.length} 项权限
                    {dirty ? " · 有未保存更改" : ""}
                  </p>
                </section>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建角色</DialogTitle>
            <DialogDescription>
              先填写编码、名称与说明；创建后在右侧勾选功能权限。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="role-code">角色编码</Label>
              <Input
                id="role-code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="如 warning_duty"
                className="font-mono text-sm"
                data-testid="role-create-code"
              />
              <p className="text-[11px] text-slate-400">小写字母开头，仅字母数字下划线</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role-name">角色名称</Label>
              <Input
                id="role-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如 预警值班"
                data-testid="role-create-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="role-desc">说明</Label>
              <Input
                id="role-desc"
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
              onClick={() => void createRole()}
              disabled={creating || !newCode.trim() || !newName.trim()}
              data-testid="role-create-submit"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑角色</DialogTitle>
            <DialogDescription>
              修改名称与说明。编码不可更改：
              <span className="ml-1 font-mono">{editTarget?.code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-role-name">角色名称</Label>
              <Input
                id="edit-role-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="role-edit-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-role-desc">说明</Label>
              <Input
                id="edit-role-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                data-testid="role-edit-desc"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => void saveMeta()}
              disabled={editingMeta || !editName.trim()}
              data-testid="role-edit-submit"
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除角色</DialogTitle>
            <DialogDescription>
              确认删除角色{" "}
              <span className="font-medium">{deleteTarget?.name}</span>
              <span className="ml-1 font-mono text-xs">({deleteTarget?.code})</span>
              ？若仍有账号使用该角色将无法删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              data-testid="role-delete-submit"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
