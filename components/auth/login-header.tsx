"use client"

import { useTheme } from "next-themes"
import { Disc, LifeBuoy, Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function LoginHeader() {
  const { resolvedTheme, setTheme } = useTheme()
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