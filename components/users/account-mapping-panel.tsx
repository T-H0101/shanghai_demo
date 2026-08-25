"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { formatSiteLabel, SiteSelect, useRegisteredSites } from "@/components/users/site-field"

interface MappingRow {
  id: string
  account_username?: string | null
  employee_id: string | null
  email: string | null
  auth_account_id: string | null
  site_code: string
  site_local_username: string
  note: string | null
}

interface AccountOption {
  username: string
  display_name: string | null
}

const emptyForm = {
  username: "",
  siteCode: "",
  siteLocalUsername: "",
  note: "",
}

export function AccountMappingPanel() {
  const [items, setItems] = useState<MappingRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const { sites } = useRegisteredSites()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mappingRes, accountRes] = await Promise.all([
        fetch("/api/auth/account-mappings?limit=200", { cache: "no-store" }),
        fetch("/api/auth/accounts?limit=200", { cache: "no-store" }),
      ])
      const mappingJson = await mappingRes.json().catch(() => null)
      const accountJson = await accountRes.json().catch(() => null)
      setItems(Array.isArray(mappingJson?.data?.items) ? mappingJson.data.items : [])
      setAccounts(Array.isArray(accountJson?.data?.items) ? accountJson.data.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (row: MappingRow) => {
    setEditingId(row.id)
    setForm({
      username: row.account_username ?? "",
      siteCode: row.site_code,
      siteLocalUsername: row.site_local_username,
      note: row.note ?? "",
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.username.trim()) {
      toast({ title: "请选择用户名", variant: "destructive" })
      return
    }
    if (!form.siteCode.trim() || !form.siteLocalUsername.trim()) {
      toast({ title: "请选择站点并填写站点用户名", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const payload = {
        username: form.username.trim(),
        siteCode: form.siteCode.trim(),
        siteLocalUsername: form.siteLocalUsername.trim(),
        note: form.note.trim(),
      }
      const res = await fetch(
        editingId ? `/api/auth/account-mappings/${editingId}` : "/api/auth/account-mappings",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        toast({
          title: "映射未保存",
          description: json?.message ?? `HTTP ${res.status}`,
          variant: "destructive",
        })
        return
      }
      toast({ title: editingId ? "映射已更新" : "映射已保存" })
      setOpen(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/auth/account-mappings/${id}`, { method: "DELETE" })
      if (!res.ok) {
        toast({ title: "删除失败", variant: "destructive" })
        return
      }
      toast({ title: "映射已删除" })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const usernameOptions =
    form.username && !accounts.some((account) => account.username === form.username)
      ? [{ username: form.username, display_name: null }, ...accounts]
      : accounts

  return (
    <>
      <Card className="mt-4 gap-0" data-testid="account-mapping-panel">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>站点账号映射</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {loading ? "加载中" : `${items.length} 条`}
              </Badge>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void load()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                刷新
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={openCreate}
                data-testid="account-mapping-create"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增映射
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">暂无映射。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>用户名</TableHead>
                  <TableHead>员工号</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>站点</TableHead>
                  <TableHead>站点用户名</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => {
                  const site = sites.find((item) => item.code === row.site_code)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.account_username || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.employee_id || "—"}</TableCell>
                      <TableCell className="text-xs">{row.email || "—"}</TableCell>
                      <TableCell className="text-xs">{formatSiteLabel(row.site_code, site?.label)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.site_local_username}</TableCell>
                      <TableCell className="text-xs text-slate-500">{row.note || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => void remove(row.id)}
                            disabled={busy}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑映射" : "新增映射"}</DialogTitle>
            <DialogDescription>选择本平台账号，并指定进入站点时使用的用户名。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>用户名</Label>
              <Select
                value={form.username || undefined}
                onValueChange={(username) => setForm((f) => ({ ...f, username }))}
              >
                <SelectTrigger className="w-full" data-testid="mapping-username">
                  <SelectValue placeholder="请选择用户名" />
                </SelectTrigger>
                <SelectContent>
                  {usernameOptions.map((account) => (
                    <SelectItem key={account.username} value={account.username}>
                      {account.display_name
                        ? `${account.display_name}（${account.username}）`
                        : account.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>站点</Label>
              <SiteSelect
                value={form.siteCode}
                onChange={(siteCode) => setForm((f) => ({ ...f, siteCode }))}
                testId="mapping-site-code"
              />
            </div>
            <div className="space-y-1">
              <Label>站点用户名</Label>
              <Input
                value={form.siteLocalUsername}
                onChange={(e) => setForm((f) => ({ ...f, siteLocalUsername: e.target.value }))}
                data-testid="mapping-site-username"
              />
            </div>
            <div className="space-y-1">
              <Label>备注</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void save()} disabled={busy} data-testid="mapping-save">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
