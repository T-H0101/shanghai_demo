"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Disc, Network, ShieldCheck } from "lucide-react"
import { LoginBackground } from "@/components/auth/login-background"
import { LoginHeader } from "@/components/auth/login-header"
import { LoginCard } from "@/components/auth/login-card"
import { GlassPanel } from "@/components/platform/glass-panel"
import { isAuthenticated } from "@/lib/auth/session"

export default function LoginPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (!cancelled && authenticated) router.replace("/")
    })
    return () => {
      cancelled = true
    }
  }, [router])

  const isDark = !mounted || resolvedTheme !== "light"

  return (
    <div
      className="relative min-h-screen overflow-hidden text-slate-900 dark:text-white"
      style={{
        // 暗色: 深空 + mesh mesh (保留 login-redesign 视觉)
        // 浅色: 浅蓝紫柔光 (跟 enterprise-productization 调性一致)
        backgroundColor: isDark ? "#020617" : "#f8fafc",
        backgroundImage: isDark
          ? [
              // 主品牌色: 深蓝(左上) — 主色不变
              "radial-gradient(ellipse 60% 50% at 15% 25%, rgba(30, 58, 138, 0.32) 0%, transparent 55%)",
              // 蓝紫(右上)
              "radial-gradient(ellipse 50% 45% at 85% 20%, rgba(91, 33, 182, 0.22) 0%, transparent 55%)",
              // 青绿(中下偏右) — 跟流星色系呼应
              "radial-gradient(ellipse 55% 45% at 65% 80%, rgba(14, 116, 144, 0.22) 0%, transparent 55%)",
              // 蓝紫(中下偏左) — 多色交织
              "radial-gradient(ellipse 45% 40% at 25% 75%, rgba(67, 56, 202, 0.18) 0%, transparent 55%)",
              // vignette: 边缘暗化, 收焦点
              "radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.45) 100%)",
            ].join(", ")
          : [
              "radial-gradient(ellipse 60% 50% at 15% 25%, rgba(99, 102, 241, 0.18) 0%, transparent 55%)",
              "radial-gradient(ellipse 50% 45% at 85% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 55%)",
              "radial-gradient(ellipse 55% 45% at 65% 80%, rgba(59, 130, 246, 0.12) 0%, transparent 55%)",
              "radial-gradient(ellipse 45% 40% at 25% 75%, rgba(124, 58, 237, 0.1) 0%, transparent 55%)",
              "radial-gradient(ellipse at center, transparent 35%, rgba(255, 255, 255, 0.6) 100%)",
            ].join(", "),
      }}
    >
      {isDark && <LoginBackground />}

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
                  <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">
                    Enterprise Operations
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">数据中心级光盘库管控</p>
                </div>
              </div>

              <h1 className="mb-3 text-4xl font-bold leading-tight xl:text-5xl">
                统一光盘库管理平台
              </h1>
              <p className="mb-4 text-sm tracking-wide text-slate-600 dark:text-slate-400">
                Unified Optical Disc Library Management Platform
              </p>
              <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                集团级多站点统一视图、统一检索与统一运维入口。
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                <GlassPanel
                  testId="login-capability-sites"
                  intensity="soft"
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2">
                  <Network className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  多站点统一管控
                  </div>
                </GlassPanel>
                <GlassPanel
                  testId="login-capability-audit"
                  intensity="soft"
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  审计与合规
                  </div>
                </GlassPanel>
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
