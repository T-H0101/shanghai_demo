"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, Lock, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface LoginCardProps {
  availableSites: string[]
}

export function LoginCard({ availableSites }: LoginCardProps) {
  const router = useRouter()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [site, setSite] = useState("")
  const [accountError, setAccountError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  const hasEnteredAccount = account.trim().length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAccountError("")
    setPasswordError("")
    setError("")

    if (!account.trim()) {
      setAccountError("请输入域账号")
      return
    }
    if (!password) {
      setPasswordError("请输入密码")
      return
    }
    if (isLocked) {
      setError("账户已被临时锁定，请稍后再试")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: account, password, siteCode: site }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 423 || payload?.code === "AUTH_LOCKED") {
          setIsLocked(true)
          setError("账户已被临时锁定，请稍后再试")
        } else if (payload?.code === "AUTH_SITE_DENIED") {
          setError("您没有访问该站点的权限，请联系管理员")
        } else {
          setPasswordError("用户名或密码错误")
        }
        return
      }
      setIsLocked(false)
      router.replace("/")
    } catch {
      setError("认证服务暂不可用")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      data-testid="login-card"
      className={cn(
        "relative w-full max-w-md rounded-2xl border border-white/15 p-8 shadow-2xl shadow-black/40",
        "bg-white/[0.12] backdrop-blur-2xl backdrop-saturate-180",
        "animate-in fade-in slide-in-from-bottom-3 duration-300",
      )}
    >
      {/* inner highlight: top 1px bright line + soft gradient overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
      </div>

      <div className="relative z-10 mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-blue-300">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Enterprise Auth
        </div>
        <h2 className="text-xl font-semibold text-white">统一身份登录</h2>
        <p className="mt-1 text-sm text-slate-400">平台认证基座 · 单点登录与会话统一</p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-5" noValidate>
        <div className="space-y-2">
          <Label
            htmlFor="account"
            className="text-xs uppercase tracking-wider text-slate-400"
          >
            Domain Account
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="account"
              type="text"
              placeholder="username@domain.corp"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                setSite("")
                setAccountError("")
                setPasswordError("")
              }}
              onBlur={() => account.trim() === "" && setAccountError("请输入域账号")}
              aria-invalid={!!accountError}
              aria-describedby={accountError ? "account-error" : undefined}
              className={cn(
                "h-11 border-slate-700 bg-slate-950/60 pl-10 text-white placeholder:text-slate-600",
                "focus-visible:border-blue-500 focus-visible:ring-blue-500/40",
                accountError && "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/40",
              )}
              autoComplete="username"
            />
          </div>
          {accountError && (
            <p id="account-error" className="text-xs text-red-400">
              {accountError}
            </p>
          )}
        </div>

        {hasEnteredAccount && (
          <div className="animate-in space-y-2 fade-in duration-200">
            <Label className="text-xs uppercase tracking-wider text-slate-400">
              Available Sites
            </Label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-3">
              {availableSites.length > 0 ? (
                availableSites.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="border-blue-700/50 bg-blue-950/30 text-blue-300"
                  >
                    {s}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-slate-500">请输入账号后选择站点</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs uppercase tracking-wider text-slate-400"
          >
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError("")
              }}
              onBlur={() => password === "" && setPasswordError("请输入密码")}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={cn(
                "h-11 border-slate-700 bg-slate-950/60 pl-10 text-white placeholder:text-slate-600",
                "focus-visible:border-blue-500 focus-visible:ring-blue-500/40",
                passwordError && "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/40",
              )}
              autoComplete="current-password"
            />
          </div>
          {passwordError && (
            <p id="password-error" className="text-xs text-red-400">
              {passwordError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-slate-400">
            Site / Data Center
          </Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Select
              value={site}
              onValueChange={setSite}
              disabled={!hasEnteredAccount || availableSites.length === 0}
            >
              <SelectTrigger
                className={cn(
                  "h-11 border-slate-700 bg-slate-950/60 pl-10 text-white",
                  "focus:ring-blue-500/40",
                )}
              >
                <SelectValue
                  placeholder={hasEnteredAccount ? "选择站点" : "先输入账号"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableSites.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-400 duration-200"
          >
            {error}
          </p>
        )}
        {isLocked && (
          <p
            role="alert"
            className="rounded-lg border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-400"
          >
            连续登录失败次数过多，账户已临时锁定，请30秒后再试
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !site || isLocked}
          data-testid="login-submit"
          className="h-11 w-full bg-blue-600 font-medium text-white hover:bg-blue-500 active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-400"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在认证...
            </>
          ) : (
            "登录统一管控平台"
          )}
        </Button>
      </form>

      <p className="relative z-10 mt-6 text-center text-xs leading-relaxed text-slate-500">
        当前认证：本地 JWT
        <br />
        企业 ADFS/LDAP：待接入，缺少 provider metadata 与测试账号
        <br />
        站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认
      </p>

      <div
        className="relative z-10 mt-6 flex flex-wrap justify-center gap-4 border-t border-white/10 pt-6"
        data-testid="login-federation-status"
      >
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          JWT 会话
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          登录审计
        </div>
      </div>
    </div>
  )
}