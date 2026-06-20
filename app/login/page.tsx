"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Disc,
  Globe,
  HelpCircle,
  Lock,
  Moon,
  Network,
  Search,
  Shield,
  User,
  Building2,
  Loader2,
} from "lucide-react"
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
import { isAuthenticated } from "@/lib/auth/session"
import { cn } from "@/lib/utils"

const capabilities = [
  {
    icon: Network,
    title: "多站点统一管控",
    desc: "跨数据中心站点状态、同步与容量一览",
  },
  {
    icon: Search,
    title: "全局检索与任务",
    desc: "跨站点文件索引检索与备份/恢复任务调度",
  },
  {
    icon: Shield,
    title: "审计与合规",
    desc: "操作流水、安全日志与合规报表集中留存",
  },
]

const federationStatus = [
  { label: "JWT 会话", ok: true },
  { label: "登录审计", ok: true },
  { label: "ADFS/LDAP 预留", ok: false },
]

const defaultSites = ["SH01"]

export default function LoginPage() {
  const router = useRouter()
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [site, setSite] = useState("")
  const [accountError, setAccountError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)

  // 清除账号错误
  const clearAccountError = () => setAccountError("")
  const clearPasswordError = () => setPasswordError("")

  const availableSites = account.trim() ? defaultSites : []

  // 当可选站点变化时，如果当前站点不在列表中则清空
  useEffect(() => {
    if (availableSites.length > 0 && !availableSites.includes(site)) {
      setSite(availableSites[0])
    }
  }, [availableSites, site])

  useEffect(() => {
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (!cancelled && authenticated) router.replace("/")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 清除之前的错误
    setAccountError("")
    setPasswordError("")
    setError("")

    // 空账号校验
    if (!account.trim()) {
      setAccountError("请输入域账号")
      return
    }

    // 空密码校验
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
        body: JSON.stringify({
          username: account,
          password,
          siteCode: site,
        }),
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

  const hasEnteredAccount = account.trim().length > 0

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* 顶栏工具（演示 UI，无真实功能） */}
      <header className="flex items-center justify-end gap-2 px-6 py-4">
        <button
          type="button"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="语言"
        >
          <Globe className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="帮助"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="主题"
        >
          <Moon className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 px-6 pb-10 lg:px-12 max-w-7xl mx-auto w-full">
        {/* 左侧：系统介绍 */}
        <div className="flex flex-col justify-center py-8 lg:py-0 lg:pr-12 relative">
          <div
            className="absolute inset-0 opacity-30 pointer-events-none rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 30% 20%, rgba(37, 99, 235, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(15, 118, 110, 0.2) 0%, transparent 50%)",
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/50">
                <Disc className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-blue-400 font-medium">
                  Enterprise Operations
                </p>
                <p className="text-sm text-slate-400">数据中心级光盘库管控</p>
              </div>
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-3">
              统一光盘库管理平台
            </h1>
            <p className="text-slate-400 text-sm lg:text-base mb-10 max-w-md">
              Unified Optical Disc Library Management Platform — 集团级多站点统一视图、统一检索与统一运维入口（演示环境）。
            </p>

            <div className="space-y-4">
              {capabilities.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-4 p-4 rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm hover:border-blue-800/50 transition-colors"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-500/30">
                    <item.icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-100">{item.title}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：登录卡片 */}
        <div className="flex items-center justify-center lg:pl-8">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-black/40">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white">统一身份登录</h2>
              <p className="text-sm text-slate-500 mt-1">
                平台认证基座
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="account" className="text-slate-300 text-xs uppercase tracking-wide">
                  Domain Account
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                    className={cn("pl-10 h-11 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:ring-blue-600", accountError ? "border-red-500" : "border-slate-700")}
                    autoComplete="username"
                  />
                </div>
                {accountError && (
                  <p className="text-xs text-red-400">{accountError}</p>
                )}
              </div>

              {/* 可访问站点提示 - 输入账号后显示 */}
              {hasEnteredAccount && (
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs uppercase tracking-wide">
                    Available Sites
                  </Label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    {availableSites.length > 0 ? (
                      availableSites.map((s) => (
                        <Badge
                          key={s}
                          variant="outline"
                          className="bg-blue-950/30 border-blue-700/50 text-blue-300 hover:bg-blue-900/40"
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
                <Label htmlFor="password" className="text-slate-300 text-xs uppercase tracking-wide">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
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
                    className={cn("pl-10 h-11 bg-slate-950 text-white placeholder:text-slate-600 focus-visible:ring-blue-600", passwordError ? "border-red-500" : "border-slate-700")}
                    autoComplete="current-password"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-red-400">{passwordError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 text-xs uppercase tracking-wide">
                  Site / Data Center
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                  <Select
                    value={site}
                    onValueChange={setSite}
                    disabled={!hasEnteredAccount || availableSites.length === 0}
                  >
                    <SelectTrigger className="pl-10 h-11 bg-slate-950 border-slate-700 text-white">
                    <SelectValue placeholder={hasEnteredAccount ? "选择站点" : "先输入账号"} />
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
                <p className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {isLocked && (
                <p className="text-sm text-amber-400 bg-amber-950/50 border border-amber-900/50 rounded-lg px-3 py-2">
                  连续登录失败次数过多，账户已临时锁定，请30秒后再试
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || !site || isLocked}
                className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-medium"
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    正在认证...
                  </>
                ) : (
                  "登录统一管控平台"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed">
              当前认证：本地 JWT
              <br />
              企业 ADFS/LDAP：待接入，缺少 provider metadata 与测试账号
              <br />
              站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认
              <br />
              <span className="text-slate-400">
                本地开发账号：admin / admin — 登录行为写入 auth_login_audit, 连续失败触发锁定
              </span>
            </p>

            <div className="mt-6 pt-6 border-t border-slate-800 flex flex-wrap gap-4 justify-center">
              {federationStatus.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-xs text-slate-500">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      s.ok ? "bg-emerald-500" : "bg-slate-600"
                    )}
                  />
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
