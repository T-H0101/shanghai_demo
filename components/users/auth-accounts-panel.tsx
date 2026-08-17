"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, KeyRound, LockOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
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
import { formatBeijingTime } from "@/components/shared/time-format"

export interface AuthAccount {
  id: string
  username: string
  display_name: string | null
  role: string
  department: string | null
  accessible_sites: string[] | null
  status: string
  failed_attempts: number
  locked_until: string | null
  last_login_at: string | null
  created_at: string
}

const ROLES = [
  { value: "group_admin", label: "集团管理员" },
  { value: "site_admin", label: "站点管理员" },
  { value: "auditor", label: "审计员" },
  { value: "operator", label: "操作员" },
  { value: "viewer", label: "只读" },
] as const

function parseSites(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function sitesToText(sites: string[] | null | undefined): string {
  if (!sites || sites.length === 0) return ""
  return sites.join(", ")
}

/** 客户端生成初始密码（与 reset-password API 字符集一致） */
function generateInitialPassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

/**
 * 复制到剪贴板。
 * 内网 HTTP（非 localhost）下 Clipboard API 常不可用，需回退。
 */
async function copyText(text: string): Promise<void> {
  if (typeof window === "undefined" || !text) {
    throw new Error("无法复制")
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through
    }
  }

  // 回退 1：在用户点击手势里拦截 copy 事件写入（Dialog 内更稳）
  let copiedViaEvent = false
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/plain", text)
    e.preventDefault()
    copiedViaEvent = true
  }
  document.addEventListener("copy", onCopy)
  try {
    if (document.execCommand("copy") && copiedViaEvent) return
  } finally {
    document.removeEventListener("copy", onCopy)
  }

  // 回退 2：隐藏 textarea + select
  const ta = document.createElement("textarea")
  ta.value = text
  ta.setAttribute("readonly", "")
  ta.style.position = "fixed"
  ta.style.left = "-9999px"
  ta.style.top = "0"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, text.length)
  try {
    const ok = document.execCommand("copy")
    if (!ok) throw new Error("execCommand copy failed")
  } finally {
    document.body.removeChild(ta)
  }
}

async function copyPasswordWithFeedback(text: string): Promise<void> {
  try {
    await copyText(text)
    toast({ title: "已复制到剪贴板" })
  } catch {
    toast({
      title: "复制失败",
      description: "请手动选中密码后 Ctrl+C 复制（当前环境可能禁止脚本访问剪贴板）",
      variant: "destructive",
    })
  }
}

type FormMode = "create" | "edit" | null

export function AuthAccountsPanel() {
  const [accounts, setAccounts] = useState<AuthAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editing, setEditing] = useState<AuthAccount | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthAccount | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState("viewer")
  const [department, setDepartment] = useState("")
  const [accessibleSitesText, setAccessibleSitesText] = useState("*")
  const [status, setStatus] = useState("active")

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/accounts?limit=200", { cache: "no-store" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
      }
      const json = await res.json()
      setAccounts(json.data?.items ?? [])
    } catch (e) {
      toast({
        title: "加载 Auth 账号失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const openCreate = () => {
    setEditing(null)
    setUsername("")
    setPassword(generateInitialPassword())
    setDisplayName("")
    setRole("viewer")
    setDepartment("")
    setAccessibleSitesText("*")
    setStatus("active")
    setFormMode("create")
  }

  const openEdit = (acc: AuthAccount) => {
    setEditing(acc)
    setUsername(acc.username)
    setPassword("")
    setDisplayName(acc.display_name ?? "")
    setRole(acc.role)
    setDepartment(acc.department ?? "")
    setAccessibleSitesText(sitesToText(acc.accessible_sites) || (acc.role === "group_admin" ? "*" : ""))
    setStatus(acc.status === "locked" ? "active" : acc.status)
    setFormMode("edit")
  }

  const submitForm = async () => {
    try {
      if (formMode === "create") {
        if (!username.trim()) throw new Error("请填写用户名")
        if (password.length < 8) throw new Error("密码至少 8 位")
        const res = await fetch("/api/auth/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password,
            displayName: displayName.trim() || undefined,
            role,
            department: department.trim() || undefined,
            accessibleSites: parseSites(accessibleSitesText),
            status,
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
        const createdPassword = password
        toast({ title: "账号已创建", description: `用户 ${username.trim().toLowerCase()} 已写入 auth_accounts` })
        setFormMode(null)
        setGeneratedPassword(createdPassword)
        await loadAccounts()
        return
      } else if (formMode === "edit" && editing) {
        const res = await fetch(`/api/auth/accounts/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName.trim() || null,
            role,
            department: department.trim() || null,
            accessibleSites: parseSites(accessibleSitesText),
            status,
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
        toast({ title: "账号已更新", description: `用户 ${editing.username}` })
      }
      setFormMode(null)
      await loadAccounts()
    } catch (e) {
      toast({
        title: formMode === "create" ? "创建失败" : "更新失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/auth/accounts/${deleteTarget.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
      toast({ title: "账号已删除", description: deleteTarget.username })
      setDeleteTarget(null)
      await loadAccounts()
    } catch (e) {
      toast({
        title: "删除失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleUnlock = async (acc: AuthAccount) => {
    setBusyId(acc.id)
    try {
      const res = await fetch(`/api/auth/accounts/${acc.id}/unlock`, { method: "POST" })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
      toast({ title: "解锁成功", description: `账号 ${acc.username} 已解锁` })
      await loadAccounts()
    } catch (e) {
      toast({
        title: "解锁失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleResetPassword = async (acc: AuthAccount) => {
    setBusyId(acc.id)
    try {
      const res = await fetch(`/api/auth/accounts/${acc.id}/reset-password`, { method: "POST" })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `HTTP ${res.status}`)
      setGeneratedPassword(body?.newPassword ?? null)
      toast({ title: "密码已重置", description: `账号 ${acc.username}，请立即保存新密码` })
      await loadAccounts()
    } catch (e) {
      toast({
        title: "重置失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Auth 账号列表</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {loading ? "加载中" : `${accounts.length} 个账号`}
              </Badge>
              <Button size="sm" className="h-8 text-xs" onClick={openCreate} data-testid="auth-account-create">
                <Plus className="mr-1 h-3.5 w-3.5" />
                新增账号
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-0">
          {/* 说明文案暂不展示
          <p className="mb-3 text-xs text-slate-500">
            管理总控登录账号（auth_accounts）。SSO 跳转站点时使用此处用户名，需与站点 tbl_user.name 一致。
          </p>
          */}
          {accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              暂无 Auth 账号。请点击「新增账号」创建。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>用户名</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>可访问站点</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>失败次数</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc, idx) => {
                  const isLocked =
                    acc.status === "locked" ||
                    (acc.locked_until != null && new Date(acc.locked_until).getTime() > Date.now())
                  return (
                    <TableRow key={`auth-${acc.id}-${idx}`}>
                      <TableCell className="font-mono text-sm">{acc.username}</TableCell>
                      <TableCell className="text-sm">{acc.display_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ROLES.find((r) => r.value === acc.role)?.label ?? acc.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{acc.department ?? "—"}</TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs text-slate-500">
                        {sitesToText(acc.accessible_sites) || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${
                            acc.status === "active"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : isLocked
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                : acc.status === "disabled"
                                  ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {isLocked
                            ? "已锁定"
                            : acc.status === "active"
                              ? "正常"
                              : acc.status === "disabled"
                                ? "已禁用"
                                : acc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{acc.failed_attempts}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {acc.last_login_at ? formatBeijingTime(acc.last_login_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={busyId === acc.id}
                            onClick={() => openEdit(acc)}
                            data-testid={`auth-edit-${acc.username}`}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={busyId === acc.id}
                            onClick={() => void handleResetPassword(acc)}
                          >
                            <KeyRound className="mr-1 h-3 w-3" />
                            重置密码
                          </Button>
                          {isLocked && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={busyId === acc.id}
                              onClick={() => void handleUnlock(acc)}
                              data-testid={`unlock-${acc.username}`}
                            >
                              <LockOpen className="mr-1 h-3 w-3" />
                              解锁
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-red-600"
                            disabled={busyId === acc.id}
                            onClick={() => setDeleteTarget(acc)}
                            data-testid={`auth-delete-${acc.username}`}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            删除
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

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "新增 Auth 账号" : "编辑 Auth 账号"}</DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "创建可登录总控的账号。用户名建议与站点业务用户同名，便于 SSO。"
                : "修改账号属性与状态。用户名不可更改。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="auth-username">用户名</Label>
              <Input
                id="auth-username"
                value={username}
                disabled={formMode === "edit"}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="如 sysadmin / auditor"
                autoComplete="off"
              />
            </div>
            {formMode === "create" && (
              <div className="grid gap-1.5">
                <Label htmlFor="auth-password">初始密码（自动生成，请复制后交予用户）</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="auth-password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="font-mono text-sm"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="复制密码"
                    aria-label="复制密码"
                    onClick={() => {
                      if (!password) return
                      void copyPasswordWithFeedback(password)
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="重新生成"
                    aria-label="重新生成密码"
                    onClick={() => setPassword(generateInitialPassword())}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="auth-display">显示名</Label>
              <Input
                id="auth-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>角色</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="auth-dept">部门</Label>
              <Input
                id="auth-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="auth-sites">可访问站点（逗号分隔，* 表示全部）</Label>
              <Input
                id="auth-sites"
                value={accessibleSitesText}
                onChange={(e) => setAccessibleSitesText(e.target.value)}
                placeholder="* 或 SH01,BJ02"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>状态</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="disabled">禁用</SelectItem>
                  <SelectItem value="pending_activation">待激活</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormMode(null)}>
              取消
            </Button>
            <Button onClick={() => void submitForm()} data-testid="auth-account-submit">
              {formMode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除账号</DialogTitle>
            <DialogDescription>
              将删除总控登录账号{" "}
              <span className="font-mono font-medium">{deleteTarget?.username}</span>
              。此操作不可恢复；若该用户名下仍有未完成任务将拒绝删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === deleteTarget?.id}
              onClick={() => void handleDelete()}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generatedPassword !== null} onOpenChange={(open) => !open && setGeneratedPassword(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>初始密码（仅显示一次）</DialogTitle>
            <DialogDescription>请立即复制并交予用户修改。关闭后无法再次查看。</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 rounded border bg-slate-50 p-3 font-mono text-sm break-all dark:bg-slate-900">
              {generatedPassword}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="复制密码"
              aria-label="复制密码"
              onClick={() => {
                if (!generatedPassword) return
                void copyPasswordWithFeedback(generatedPassword)
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setGeneratedPassword(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
