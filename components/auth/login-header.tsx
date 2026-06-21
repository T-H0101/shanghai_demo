"use client"

import { Disc } from "lucide-react"

export function LoginHeader() {
  return (
    <header
      className="relative z-10 flex items-center gap-2.5 px-6 py-4 lg:px-12"
      data-testid="login-header"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/90 shadow-md shadow-blue-900/40 backdrop-blur-sm">
        <Disc className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <span className="text-sm font-semibold tracking-wide text-slate-100">
        光盘库管控平台
      </span>
    </header>
  )
}