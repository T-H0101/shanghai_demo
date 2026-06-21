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