"use client"

import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ChangeType = "feature" | "fix" | "improve"

interface VersionChange {
  type: ChangeType
  text: string
}

interface VersionRelease {
  version: string
  date: string
  summary: string
  changes: VersionChange[]
}

interface VersionChangelog {
  current: string
  summary: string
  releases: VersionRelease[]
}

const TYPE_LABEL: Record<ChangeType, string> = {
  feature: "功能",
  fix: "修复",
  improve: "优化",
}

const TYPE_CLASS: Record<ChangeType, string> = {
  feature:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  fix: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  improve:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
}

interface VersionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersionDrawer({ open, onOpenChange }: VersionDrawerProps) {
  const [data, setData] = useState<VersionChangelog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/system/version", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (cancelled) return
        setData(json.data as VersionChangelog)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <SheetTitle>系统版本</SheetTitle>
          <SheetDescription>
            {data ? `当前版本 v${data.current}` : "查看版本与更新说明"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {loading && (
            <p className="text-sm text-slate-500" data-testid="version-drawer-loading">
              加载中…
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" data-testid="version-drawer-error">
              版本信息暂不可用：{error}
            </p>
          )}
          {!loading && !error && data && (
            <div className="space-y-6" data-testid="version-drawer-content">
              
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  版本记录
                </p>
                {data.releases.map((release) => (
                  <article
                    key={release.version}
                    className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700"
                    data-testid={`version-release-${release.version}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        v{release.version}
                      </h3>
                      <time className="text-xs text-slate-400">{release.date}</time>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {release.summary}
                    </p>
                    {release.changes.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {release.changes.map((change, idx) => (
                          <li key={`${release.version}-${idx}`} className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                TYPE_CLASS[change.type] ?? TYPE_CLASS.improve,
                              )}
                            >
                              {TYPE_LABEL[change.type] ?? change.type}
                            </span>
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {change.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
