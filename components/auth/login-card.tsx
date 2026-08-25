"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Building2, Loader2, Lock, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useSite } from "@/lib/site/site-context"

type SiteOption = { code: string; label: string }

const SITE_STORAGE_KEY = "unified.selectedSiteCode"

function formatSiteOption(opt: SiteOption): string {
  return opt.label === opt.code ? opt.code : `${opt.label}（${opt.code}）`
}

export function LoginCard() {
  const { syncSiteCode } = useSite()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [site, setSite] = useState("")
  const [availableSites, setAvailableSites] = useState<SiteOption[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  /** 账号失焦并完成一次查询后才为 true，避免输入过程中闪提示 */
  const [sitesQueried, setSitesQueried] = useState(false)
  const [accountError, setAccountError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const sitesRequestId = useRef(0)
  const lastQueriedUsername = useRef("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sso = params.get("sso")
    if (sso === "not_configured") {
      setError("企业身份源尚未配置。ADFS Client ID/Secret 申请通过后再试，本地账号仍可登录。")
    } else if (sso === "error") {
      const reason = params.get("reason") || "unknown"
      setError(`企业 AD 登录未完成（${reason}），未建立总控会话。`)
    }
  }, [])

  // 列表到位后若当前未选或选中项不在列表中，自动落到第一项并显示
  useEffect(() => {
    if (availableSites.length === 0) return
    if (!site || !availableSites.some((s) => s.code === site)) {
      setSite(availableSites[0].code)
    }
  }, [availableSites, site])

  const loadAvailableSites = async (rawUsername: string) => {
    const username = rawUsername.trim()
    const reqId = ++sitesRequestId.current
    if (!username) {
      setAvailableSites([])
      setSite("")
      setSitesQueried(false)
      setSitesLoading(false)
      lastQueriedUsername.current = ""
      return [] as SiteOption[]
    }

    setSitesLoading(true)
    try {
      const res = await fetch(
        `/api/auth/available-sites?username=${encodeURIComponent(username)}`,
        { cache: "no-store" },
      )
      const json = await res.json().catch(() => null)
      if (sitesRequestId.current !== reqId) return [] as SiteOption[]
      const sites = Array.isArray(json?.data?.sites) ? (json.data.sites as SiteOption[]) : []
      const defaultCode = sites[0]?.code ?? ""
      setAvailableSites(sites)
      setSitesQueried(true)
      lastQueriedUsername.current = username
      setSite(defaultCode)
      return sites
    } catch {
      if (sitesRequestId.current !== reqId) return [] as SiteOption[]
      setAvailableSites([])
      setSitesQueried(true)
      lastQueriedUsername.current = username
      setSite("")
      return [] as SiteOption[]
    } finally {
      if (sitesRequestId.current === reqId) setSitesLoading(false)
    }
  }

  const effectiveSite =
    site && availableSites.some((s) => s.code === site)
      ? site
      : (availableSites[0]?.code ?? "")
  const selectedSiteOpt = availableSites.find((s) => s.code === effectiveSite)
  const siteSelectKey = availableSites.length
    ? `sites-${availableSites.map((s) => s.code).join("|")}-${effectiveSite}`
    : "sites-empty"

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAccountError("")
    setPasswordError("")
    setError("")

    const username = account.trim()
    if (!username) {
      setAccountError("请输入账号")
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

    // 未失焦就点登录时，先补一次站点查询；有列表则默认第一个
    let sites = availableSites
    let selected = effectiveSite || site
    if (lastQueriedUsername.current !== username) {
      sites = await loadAvailableSites(username)
      selected = sites.length > 0 ? sites[0].code : ""
      if (selected) setSite(selected)
    } else if (!selected && sites.length > 0) {
      selected = sites[0].code
      setSite(selected)
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          password,
          ...(selected ? { siteCode: selected } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 423 || payload?.code === "AUTH_LOCKED") {
          setIsLocked(true)
          setError("账户已被临时锁定，请稍后再试")
        } else {
          setPasswordError("用户名或密码错误")
        }
        return
      }
      setIsLocked(false)
      if (selected) {
        try {
          localStorage.setItem(SITE_STORAGE_KEY, selected)
        } catch {
          /* ignore */
        }
        syncSiteCode(selected)
        window.location.assign(`/?siteCode=${encodeURIComponent(selected)}`)
      } else {
        window.location.assign("/")
      }
      return
    } catch {
      setError("认证服务暂不可用")
    } finally {
      setLoading(false)
    }
  }

  const sitePlaceholder = (() => {
    if (!account.trim()) return "请先输入账号"
    if (sitesLoading) return "正在加载可用站点…"
    if (!sitesQueried) return "输入账号后自动加载"
    if (availableSites.length === 0) return "暂无可用站点"
    return "选择站点"
  })()

  return (
    <div
      data-testid="login-card"
      className={cn(
        "relative w-full max-w-md rounded-2xl border p-8 shadow-2xl",
        "border-white/15 shadow-black/40 dark:border-white/15",
        "bg-white/70 backdrop-blur-2xl backdrop-saturate-180",
        "dark:bg-white/[0.12]",
        "shadow-slate-900/10 dark:shadow-black/40",
        "animate-in fade-in slide-in-from-bottom-3 duration-300",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-900/15 to-transparent dark:via-white/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/[0.04]" />
      </div>

      <div className="relative z-10 mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] tracking-wide text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          企业认证
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">统一身份登录</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">平台认证基座 · 单点登录与会话统一</p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-5" noValidate>
        <div className="space-y-2">
          <Label
            htmlFor="account"
            className="text-xs tracking-wide text-slate-600 dark:text-slate-400"
          >
            账号
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="account"
              type="text"
              placeholder="请输入账号"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                setSite("")
                setAvailableSites([])
                setSitesQueried(false)
                lastQueriedUsername.current = ""
                setAccountError("")
                setPasswordError("")
                setError("")
              }}
              onBlur={() => {
                if (account.trim() === "") {
                  setAccountError("请输入账号")
                  setAvailableSites([])
                  setSitesQueried(false)
                  lastQueriedUsername.current = ""
                  return
                }
                void loadAvailableSites(account)
              }}
              aria-invalid={!!accountError}
              aria-describedby={accountError ? "account-error" : undefined}
              className={cn(
                "h-11 border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400",
                "dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500",
                "focus-visible:border-blue-500 focus-visible:ring-blue-500/40",
                accountError && "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/40",
              )}
              autoComplete="username"
            />
          </div>
          {accountError && (
            <p id="account-error" className="text-xs text-red-600 dark:text-red-400">
              {accountError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs tracking-wide text-slate-600 dark:text-slate-400"
          >
            密码
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError("")
                setError("")
              }}
              onBlur={() => password === "" && setPasswordError("请输入密码")}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={cn(
                "h-11 border-slate-300 bg-white pl-10 text-slate-900 placeholder:text-slate-400",
                "dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500",
                "focus-visible:border-blue-500 focus-visible:ring-blue-500/40",
                passwordError && "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-red-500/40",
              )}
              autoComplete="current-password"
            />
          </div>
          {passwordError && (
            <p id="password-error" className="text-xs text-red-600 dark:text-red-400">
              {passwordError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs tracking-wide text-slate-600 dark:text-slate-400">
            站点
          </Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Select
              key={siteSelectKey}
              value={effectiveSite || undefined}
              onValueChange={setSite}
              disabled={sitesLoading || availableSites.length === 0}
            >
              <SelectTrigger
                className={cn(
                  "h-11 w-full border-slate-300 bg-white pl-10 text-slate-900",
                  "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
                  "focus:ring-blue-500/40",
                )}
                aria-label="选择站点"
              >
                <SelectValue placeholder={sitePlaceholder}>
                  {selectedSiteOpt ? formatSiteOption(selectedSiteOpt) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableSites.map((opt) => (
                  <SelectItem key={opt.code} value={opt.code}>
                    {formatSiteOption(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 duration-200 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {isLocked && (
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400"
          >
            连续登录失败次数过多，账户已临时锁定，请30秒后再试
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || isLocked || sitesLoading}
          data-testid="login-submit"
          className="h-11 w-full bg-blue-600 font-medium text-white hover:bg-blue-500 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在认证...
            </>
          ) : (
            "登录"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="login-adfs-start"
          className="h-11 w-full"
          onClick={() => {
            window.location.assign("/api/auth/sso/start")
          }}
        >
          企业 AD 登录
        </Button>
      </form>

      <p className="relative z-10 mt-6 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-500">
        当前认证：本地账号体系
        <br />
        企业 AD 登录：未配置 Client 时会回到本页提示，不会假装登录成功
        <br />
        站点单点登录：ticket 免登；用户名优先用映射表
      </p>

      <div
        className="relative z-10 mt-6 flex flex-wrap justify-center gap-4 border-t border-slate-200 pt-6 dark:border-white/10"
        data-testid="login-federation-status"
      >
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          JWT 会话
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          登录审计
        </div>
      </div>
    </div>
  )
}
