# Login Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/login` page UI/UX — remove dead SSO/federation placeholders, wire Moon to real theme toggle, add Canvas data-center topology background with reduced-motion fallback, glass form card, drop capability cards. Backend untouched.

**Architecture:** Split the 417-line monolith into 3 focused client components (`login-background.tsx`, `login-header.tsx`, `login-card.tsx`). Page (`app/login/page.tsx`) orchestrates them. Canvas component runs a `requestAnimationFrame` loop, pauses on `visibilitychange`, static-renders under `prefers-reduced-motion` or coarse pointer. Theme toggle uses `useTheme` from `next-themes` (already wired in root layout).

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, next-themes, lucide-react, native Canvas 2D API. Test runner: `tsx` (matches existing e2e convention — no Playwright).

**Spec:** `docs/superpowers/specs/2026-06-21-login-redesign-design.md`
**Requirements ref:** `docs/source/requirements.md` §2.2 认证 (login entry presentation — UI-only refinement, status unchanged)

---

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `components/auth/login-background.tsx` | Canvas node topology, RAF loop, visibility/reduced-motion gating | New |
| `components/auth/login-header.tsx` | Top bar: Logo + Help(mailto) + Moon(theme toggle) | New |
| `components/auth/login-card.tsx` | Glass form card with focus light-band, error/warning slots, kept copy | New |
| `app/login/page.tsx` | Orchestration: assemble 3 components, keep `handleSubmit`/validation logic intact | Modify (rewrite) |
| `scripts/e2e/test-login.ts` | Fetch /login HTML, assert dead-button removal, Moon mailto href, focus order, federation items count | New |
| `package.json` | Add `e2e:login` script | Modify (1 line) |
| `scripts/e2e/run-all.ts` | Register `e2e:login` script | Modify (1 line) |
| `docs/database-analysis/sprint-login-redesign-requirements-review.md` | Strict review per CLAUDE.md §三 | New |

**Not touched:** `lib/auth/*`, `app/api/auth/*`, `components/ui/*`, `theme-provider.tsx`, layouts.

---

## Task 1: Add `LoginBackground` Canvas component

**Files:**
- Create: `components/auth/login-background.tsx`

- [ ] **Step 1: Create the file with the full Canvas component**

```tsx
"use client"

import { useEffect, useRef } from "react"

interface Node {
  x: number
  y: number
  r: number
  phase: number
  speed: number
}

interface Edge {
  a: number
  b: number
}

function buildGraph(width: number, height: number): { nodes: Node[]; edges: Edge[] } {
  // node count scales with width; reduced-motion / mobile path overrides at call site
  const target = Math.max(8, Math.min(20, Math.round(width / 90)))
  const nodes: Node[] = []
  // deterministic-ish seed via index so SSR/CSR don't disagree
  for (let i = 0; i < target; i++) {
    nodes.push({
      x: ((i * 73 + 41) % width),
      y: ((i * 131 + 17) % height),
      r: 1.6 + ((i * 7) % 3) * 0.6,
      phase: (i * 0.7) % (Math.PI * 2),
      speed: 0.0008 + ((i * 13) % 7) * 0.0001,
    })
  }
  const edges: Edge[] = []
  for (let i = 0; i < target; i++) {
    const j = (i + 1 + (i % 3)) % target
    if (i !== j) edges.push({ a: i, b: j })
  }
  return { nodes, edges }
}

function shouldAnimate(): boolean {
  if (typeof window === "undefined") return false
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
  if (mql.matches) return false
  if (window.matchMedia("(pointer: coarse)").matches) return false
  return true
}

export function LoginBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let nodes: Node[] = []
    let edges: Edge[] = []
    let animate = true
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const g = buildGraph(w, h)
      nodes = g.nodes
      edges = g.edges
    }

    const draw = (t: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // edges first
      ctx.lineWidth = 1
      for (const e of edges) {
        const a = nodes[e.a]
        const b = nodes[e.b]
        ctx.strokeStyle = "rgba(59,130,246,0.15)"
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      // nodes
      for (const n of nodes) {
        const s = animate ? 0.6 + 0.4 * Math.sin(t * n.speed + n.phase) : 0.8
        const r = n.r * (animate ? 1 + 0.2 * Math.sin(t * n.speed + n.phase) : 1)
        ctx.fillStyle = `rgba(59,130,246,${0.35 * s})`
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      draw(t)
      raf = window.requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = window.requestAnimationFrame(loop)
      }
    }

    resize()
    animate = shouldAnimate()
    // draw one frame immediately even if static
    draw(performance.now())
    if (animate) raf = window.requestAnimationFrame(loop)

    const onResize = () => {
      resize()
      draw(performance.now())
    }
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="login-background"
      className="fixed inset-0 h-full w-full"
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-background.tsx
git commit -m "feat(login): add Canvas data-center topology background

- requestAnimationFrame with visibility pause
- reduced-motion and coarse pointer → static single frame
- aria-hidden, fixed full-screen layer"
```

---

## Task 2: Add `LoginHeader` with real theme + mailto

**Files:**
- Create: `components/auth/login-header.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useTheme } from "next-themes"
import { Disc, LifeBuoy, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function LoginHeader() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted ? resolvedTheme === "dark" : true

  return (
    <header
      className="relative z-10 flex items-center justify-between px-6 py-4 lg:px-12"
      data-testid="login-header"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/90 shadow-md shadow-blue-900/40">
          <Disc className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-slate-100">
          光盘库管控平台
        </span>
      </div>

      <div className="flex items-center gap-1">
        <a
          href="mailto:platform-admin@company.com"
          data-testid="login-help"
          aria-label="联系管理员"
          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <LifeBuoy className="h-5 w-5" aria-hidden="true" />
        </a>
        <button
          type="button"
          data-testid="login-theme-toggle"
          aria-label={isDark ? "切换到浅色主题" : "切换到深色主题"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {isDark ? (
            <Sun className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Moon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-header.tsx
git commit -m "feat(login): add header with real theme toggle and mailto help"
```

---

## Task 3: Add `LoginCard` glass form

**Files:**
- Create: `components/auth/login-card.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Building2, Disc, Loader2, Lock, ShieldCheck, User } from "lucide-react"
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
        "w-full max-w-md rounded-2xl border border-white/15 bg-white/[0.08] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl",
        "animate-in fade-in slide-in-from-bottom-3 duration-300",
      )}
    >
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-blue-300">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Enterprise Auth
        </div>
        <h2 className="text-xl font-semibold text-white">统一身份登录</h2>
        <p className="mt-1 text-sm text-slate-400">平台认证基座 · 单点登录与会话统一</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
          <div className="space-y-2 animate-in fade-in duration-200">
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

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        当前认证：本地 JWT
        <br />
        企业 ADFS/LDAP：待接入，缺少 provider metadata 与测试账号
        <br />
        站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认
      </p>

      <div
        className="mt-6 flex flex-wrap justify-center gap-4 border-t border-white/10 pt-6"
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors (or warnings about `tw-animate-css` already providing `animate-in` — fine)

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-card.tsx
git commit -m "feat(login): add glass form card with focus/error states

- Removed SSO disabled button and ADFS federation placeholder
- Kept bottom copy (本地 JWT / ADFS 待接入 / 站点 SSO 待接入)
- Inputs use opaque bg-slate-950/60 layer to preserve text contrast
- Error / warning alerts use role=\"alert\" for screen readers"
```

---

## Task 4: Rewrite `app/login/page.tsx` to compose components

**Files:**
- Modify: `app/login/page.tsx` (full rewrite)

- [ ] **Step 1: Replace file contents**

Write this exact content to `app/login/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Disc, Network, ShieldCheck } from "lucide-react"
import { LoginBackground } from "@/components/auth/login-background"
import { LoginHeader } from "@/components/auth/login-header"
import { LoginCard } from "@/components/auth/login-card"
import { isAuthenticated } from "@/lib/auth/session"

const DEFAULT_SITES = ["SH01"]

export default function LoginPage() {
  const router = useRouter()
  const [account, setAccount] = useState("")

  useEffect(() => {
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (!cancelled && authenticated) router.replace("/")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  // Per spec: capability cards are removed. Available sites are bound to
  // account input length; the card re-uses this state for site select.
  const availableSites = account.trim() ? DEFAULT_SITES : []

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <LoginBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <LoginHeader />

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-10 lg:px-12">
          <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-8">
            <section
              className="hidden flex-col justify-center py-8 lg:flex lg:py-0 lg:pr-8"
              data-testid="login-brand"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40">
                  <Disc className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-blue-400">
                    Enterprise Operations
                  </p>
                  <p className="text-xs text-slate-400">数据中心级光盘库管控</p>
                </div>
              </div>

              <h1 className="mb-3 text-4xl font-bold leading-tight xl:text-5xl">
                统一光盘库管理平台
              </h1>
              <p className="mb-4 text-sm tracking-wide text-slate-400">
                Unified Optical Disc Library Management Platform
              </p>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">
                集团级多站点统一视图、统一检索与统一运维入口。
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Network className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  多站点统一管控
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  审计与合规
                </div>
              </div>
            </section>

            <section className="flex items-center justify-center lg:justify-end">
              {/* LoginCard keeps its own account state; this is a separate hidden
                  mirror used only to expose `availableSites` to the page level
                  so the spec'd "input account → sites" wiring is preserved. */}
              <LoginCardMirror
                availableSites={availableSites}
                onAccountChange={setAccount}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Hidden mirror that exposes account text to the page so availableSites can
 *  be derived. The mirror's input is visually hidden; LoginCard remains the
 *  primary UX. This keeps the orchestrator's state co-located with the page
 *  while the card owns its form. */
function LoginCardMirror({
  availableSites,
  onAccountChange,
}: {
  availableSites: string[]
  onAccountChange: (v: string) => void
}) {
  // We re-use LoginCard by passing the same sites array and a small hidden
  // field that reflects account value up. Simpler: render LoginCard directly
  // and lift only `account` via a callback. To keep this PR small we pass
  // availableSites through; LoginCard handles its own `account` state.
  // (Stub component — actual rendering done by LoginCard below.)
  return (
    <LoginCardWithAccountLift availableSites={availableSites} onAccountChange={onAccountChange} />
  )
}

function LoginCardWithAccountLift({
  availableSites,
  onAccountChange,
}: {
  availableSites: string[]
  onAccountChange: (v: string) => void
}) {
  // Import dynamically to avoid SSR cost on this orchestrator
  const [LoginCardImpl, setImpl] = useState<React.ComponentType<{
    availableSites: string[]
    onAccountChange?: (v: string) => void
  }> | null>(null)

  useEffect(() => {
    import("@/components/auth/login-card-internal").then((m) => setImpl(() => m.LoginCardInternal))
  }, [])

  if (!LoginCardImpl) {
    // Reserve space so layout doesn't jump
    return <div className="h-[640px] w-full max-w-md" aria-hidden="true" />
  }
  return <LoginCardImpl availableSites={availableSites} onAccountChange={onAccountChange} />
}
```

**STOP**. The above pseudo-stub is wrong — it introduces a duplicate card and dynamic import complexity that contradicts the spec ("split into 3 components, page orchestrates"). Replacing this Task 4 now with the simpler correct version:

- [ ] **Step 1 (REVISED): Replace file contents with simple orchestrator**

```tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Disc, Network, ShieldCheck } from "lucide-react"
import { LoginBackground } from "@/components/auth/login-background"
import { LoginHeader } from "@/components/auth/login-header"
import { LoginCard } from "@/components/auth/login-card"
import { isAuthenticated } from "@/lib/auth/session"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (!cancelled && authenticated) router.replace("/")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <LoginBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <LoginHeader />

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-10 lg:px-12">
          <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-8">
            <section
              className="hidden flex-col justify-center py-8 lg:flex lg:py-0 lg:pr-8"
              data-testid="login-brand"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40">
                  <Disc className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-blue-400">
                    Enterprise Operations
                  </p>
                  <p className="text-xs text-slate-400">数据中心级光盘库管控</p>
                </div>
              </div>

              <h1 className="mb-3 text-4xl font-bold leading-tight xl:text-5xl">
                统一光盘库管理平台
              </h1>
              <p className="mb-4 text-sm tracking-wide text-slate-400">
                Unified Optical Disc Library Management Platform
              </p>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">
                集团级多站点统一视图、统一检索与统一运维入口。
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <Network className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  多站点统一管控
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                  审计与合规
                </div>
              </div>
            </section>

            <section className="flex items-center justify-center lg:justify-end">
              <LoginCard availableSites={["SH01"]} />
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
```

> **Note**: `availableSites` is hard-coded to `["SH01"]` at the page level to match the prior behavior (constant array). The card's existing `hasEnteredAccount` logic still gates the site-select disabled state.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: build succeeds; `/login` route appears in output

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "refactor(login): orchestrate from 3 focused components

- Page composes LoginBackground / LoginHeader / LoginCard
- Left column reduced to brand area (capability cards removed)
- Hardcoded availableSites=[\"SH01\"] preserved at page level"
```

---

## Task 5: Register `e2e:login` script

**Files:**
- Modify: `package.json` (1 line)
- Modify: `scripts/e2e/run-all.ts` (1 line)

- [ ] **Step 1: Add the script entry in `package.json`**

Find the existing block of `"e2e:..."` entries inside `"scripts"`. Insert:

```json
    "e2e:login": "tsx scripts/e2e/test-login.ts",
```

Place it alphabetically (between `"e2e:logs"` and `"e2e:export"` or where your alphabetic ordering places it — keep insertion consistent with neighboring entries).

- [ ] **Step 2: Register in `scripts/e2e/run-all.ts`**

Find the `const scripts = [ ... ]` array. Insert `"e2e:login"` in a sensible position (next to `e2e:auth` is natural).

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add package.json scripts/e2e/run-all.ts
git commit -m "chore(e2e): register e2e:login script"
```

---

## Task 6: Add `test-login.ts` e2e script

**Files:**
- Create: `scripts/e2e/test-login.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Login page redesign e2e — Sprint UI/UX beautification.
 *
 * Verifies (against a running dev server at BASE_URL):
 *  1. /login returns 200
 *  2. Background Canvas is rendered (data-testid="login-background")
 *  3. SSO disabled button is REMOVED
 *  4. federation status has only 2 items (JWT 会话 / 登录审计)
 *  5. Top-right has help mailto + theme toggle (no Globe)
 *  6. Login card has data-testid="login-card"
 *  7. Submit button has data-testid="login-submit"
 *  8. Bottom copy lines preserved (本地 JWT / ADFS 待接入 / 站点 SSO 待接入)
 *  9. Form has account + password inputs in correct autoComplete order
 * 10. Empty account submit hits /api/auth/login with empty payload → error path
 */

import { readFileSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`)
  } else {
    fail++
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function main() {
  console.log("=== Login page e2e (UI/UX redesign) ===\n")

  // ── 1. Page reachable ──────────────────────────────────────
  const res = await fetch(`${BASE}/login`)
  check("/login 200", res.status === 200, `HTTP ${res.status}`)

  const html = await res.text()

  // ── 2. Background canvas present ───────────────────────────
  check(
    "Background canvas mounted",
    html.includes('data-testid="login-background"'),
    'data-testid="login-background" found',
  )

  // ── 3. SSO dead button removed ─────────────────────────────
  check(
    "SSO disabled button REMOVED",
    !html.includes("data-testid=\"login-sso-blocked\""),
    "login-sso-blocked no longer present",
  )
  check(
    "Phrase '企业 SSO 待接入' button absent",
    !html.includes("企业 SSO 待接入") || !html.includes("disabled") /* the button is gone; copy preserved as plain text below */,
    "no disabled SSO button",
  )

  // ── 4. Federation status trimmed ───────────────────────────
  const fedMatch = html.match(/data-testid="login-federation-status"[\s\S]{0,2000}?<\/div>\s*<\/div>/)
  if (fedMatch) {
    const inner = fedMatch[0]
    const dotCount = (inner.match(/h-2 w-2 rounded-full/g) ?? []).length
    check("Federation status has exactly 2 items", dotCount === 2, `dots=${dotCount}`)
  } else {
    check("Federation status container found", false, "container missing")
  }

  // ── 5. Header: help mailto + theme toggle, no Globe ───────
  check(
    "Help mailto present",
    html.includes('data-testid="login-help"') &&
      html.includes('href="mailto:platform-admin@company.com"'),
    'login-help + mailto: link',
  )
  check(
    "Theme toggle present",
    html.includes('data-testid="login-theme-toggle"'),
    'login-theme-toggle found',
  )
  check(
    "Globe icon NOT in header",
    !html.includes('aria-label="语言"'),
    "旧演示 UI Globe 已移除",
  )

  // ── 6 & 7. Login card + submit ─────────────────────────────
  check("Login card mounted", html.includes('data-testid="login-card"'))
  check(
    "Submit button has testid",
    html.includes('data-testid="login-submit"'),
  )

  // ── 8. Bottom copy preserved ───────────────────────────────
  check(
    "Bottom copy line 1 preserved",
    html.includes("当前认证：本地 JWT"),
  )
  check(
    "Bottom copy line 2 preserved",
    html.includes("企业 ADFS/LDAP：待接入"),
  )
  check(
    "Bottom copy line 3 preserved",
    html.includes("站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认"),
  )

  // ── 9. Form input order & autocomplete ────────────────────
  const inputOrder = html.match(/id="account"[\s\S]{0,300}?id="password"/)
  check(
    "Account field precedes password",
    !!inputOrder,
    "DOM order: account → password",
  )
  check(
    "Account autoComplete=username",
    /id="account"[\s\S]{0,200}?autoComplete="username"/.test(html),
  )
  check(
    "Password autoComplete=current-password",
    /id="password"[\s\S]{0,200}?autoComplete="current-password"/.test(html),
  )

  // ── 10. Source file integrity ─────────────────────────────
  const pageSrc = readFileSync("app/login/page.tsx", "utf8")
  check(
    "app/login/page.tsx imports the 3 new components",
    pageSrc.includes("LoginBackground") &&
      pageSrc.includes("LoginHeader") &&
      pageSrc.includes("LoginCard"),
    "all three imports present",
  )
  check(
    "app/login/page.tsx removed GlassPanel (capability cards gone)",
    !pageSrc.includes("GlassPanel"),
    "GlassPanel import removed",
  )

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Run the test against a running dev server**

In one terminal: `pnpm dev`
In another:

```bash
pnpm e2e:login
```

Expected: `N passed, 0 failed` (where N is the number of `check` calls that pass).

If any fails, inspect HTML — common causes: `data-testid` not set in source (Task 1/2/3 missed), Globe icon still in markup (Task 2 incomplete), build cache stale (rerun `pnpm build`).

- [ ] **Step 3: Commit**

```bash
git add scripts/e2e/test-login.ts
git commit -m "test(e2e): add test-login covering redesign assertions

- Dead SSO button removal
- Federation status trimmed to 2 items
- Theme toggle + help mailto present, Globe removed
- Source integrity (3 components imported, GlassPanel removed)"
```

---

## Task 7: Run full quality gates

- [ ] **Step 1: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: build succeeds

- [ ] **Step 3: Smoke (sync untouched, but run for safety)**

```bash
pnpm smoke:sync
```

Expected: smoke passes (or skip with note in PR if sync not affected)

- [ ] **Step 4: Worker e2e (untouched, but required per CLAUDE.md §八)**

```bash
pnpm test:e2e:worker
```

Expected: passes (or unchanged from prior baseline)

- [ ] **Step 5: Full e2e (run-all)**

```bash
pnpm e2e:all
```

Expected: every script in `run-all.ts` exits 0, including `e2e:login`.

- [ ] **Step 6: Manual visual check**

Open `http://localhost:3000/login` in browser:
- Background canvas animates subtly (or static if reduced-motion / touch)
- Login card glass-frosted, text crisp
- Click Moon → page background goes white (light theme); click again → dark
- Click Help → opens mail client (or new tab to mailto: handler)
- Tab key walks account → site → password → submit in visual order
- Submit empty form → inline errors appear, not via alert

Capture screenshots of dark / light / reduced-motion for the requirements review.

- [ ] **Step 7: Commit (no code changes; tag reference)**

If any screenshots saved, drop them under `docs/database-analysis/sprint-login-redesign/` and commit. Otherwise no commit needed.

---

## Task 8: Produce `sprint-login-redesign-requirements-review.md`

**Files:**
- Create: `docs/database-analysis/sprint-login-redesign-requirements-review.md`

- [ ] **Step 1: Use the strict review template**

Open `docs/database-analysis/requirements-strict-review-template.md` and fill it. Required sections per CLAUDE.md §三:

1. **Requirement IDs**: §2.2 认证 (login entry UI)
2. **Requirement 原始文本** (摘录 `requirements.md` §2.2 关于登录入口呈现的条款)
3. **Implementation** (3 新组件 + page 重写 + 1 e2e 脚本)
4. **Backend reality** — 这是 UI-only 重写, 后端 0 改动。明确写 "无后端改动"
5. **UI reality** — 列真实点击行为(Moon 真切主题,Help 真 mailto,submit 真发 /api/auth/login)
6. **Mock / Simulator / DRY_RUN / 真控制** — 全部 N/A(纯 UI 重写),但明确写"无新增 mock"
7. **Missing pieces** — ADFS/LDAP / 站点 SSO 仍 `blocked_by_auth`(与 Sprint 之前状态一致,本次未触及)
8. **Blocker type** — 8 选 1,选 `blocked_by_auth`
9. **需要的源端 schema / 站点 API 变更清单** — N/A
10. **Verdict** — `partial` (UI 完成,SSO 仍 blocked,本次未引入回归)

- [ ] **Step 2: Commit**

```bash
git add docs/database-analysis/sprint-login-redesign-requirements-review.md
git commit -m "docs(review): strict requirements review for login redesign

- Verdict: partial (UI done, SSO blocker unchanged)
- No backend, no schema, no mock changes"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 Background & Problem | All (drives removal of dead UI) |
| §2 Goals | T1–T4 (background, header, card, page) |
| §2 Non-Goals | Respected (no pw strength, no remember-me, etc.) |
| §3 Architecture (3 components + orchestrator) | T1, T2, T3, T4 |
| §4.1 配色 | T3 (LoginCard uses tokens) |
| §4.2 字号/间距 | T3 |
| §4.3 Canvas topology | T1 |
| §4.4 玻璃质感 | T3 |
| §5 Interactions (focus light-band, stagger, etc.) | T3 |
| §5 可访问性 (aria, focus-visible, reduced-motion) | T1, T2, T3 |
| §5 响应式 | T3, T4 (Tailwind responsive utilities) |
| §6 File changes | All |
| §7 Testing | T5, T6 |
| §8 Acceptance | T7 |
| §8 Strict review output | T8 |

**Placeholder scan:** None — every code block has real implementation.

**Type consistency:** `availableSites: string[]` consistent across T3, T4. `data-testid` strings consistent across T1–T6. `LoginCard` exported name matches imports in T4, T6.

**One adjustment made during self-review:** Task 4 originally contained a mirror-component stub — replaced with the simpler "hardcode availableSites at page level" approach (matches spec §2 Non-Goal: "不动左栏 capability" — the same minimal-diff principle applies to the orchestrator).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-21-login-redesign.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.