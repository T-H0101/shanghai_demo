"use client"

/**
 * 页内「区域 → 站点」分组树（顶栏范围内）
 * - 第一项「全部」= 不限制站点，仅用顶栏已拉取的数据
 * - 点选不改写顶栏 URL / siteCode
 * - counts 可选：站点码 → 数量；区域 = 子站之和
 */

import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { ChevronDown, ChevronRight, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  sumRegionCount,
  type ScopeTreeModel,
  type ScopeTreeSelection,
} from "@/lib/site/scope-tree"

export type ScopeSiteTreeProps = {
  tree: ScopeTreeModel
  selected: ScopeTreeSelection
  onSelect: (next: ScopeTreeSelection) => void
  /** 站点码 → 数量；不传则不显示角标 */
  counts?: Record<string, number>
  showCounts?: boolean
  title?: string
  loading?: boolean
  className?: string
  /** 「全部」角标：顶栏范围内总数；不传则对 counts 求和 */
  allCount?: number
}

export function ScopeSiteTree({
  tree,
  selected,
  onSelect,
  counts,
  showCounts = Boolean(counts),
  title = "区域 / 站点",
  loading = false,
  className,
  allCount,
}: ScopeSiteTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 顶栏收窄后默认展开可见区域
  useEffect(() => {
    setExpanded(new Set(tree.regions.map((r) => r.code)))
  }, [tree.regions])

  const totalAll = useMemo(() => {
    if (typeof allCount === "number") return allCount
    if (!counts) return 0
    return Object.values(counts).reduce((a, b) => a + b, 0)
  }, [allCount, counts])

  const toggleExpand = (code: string, e: MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const isAll = selected.kind === "all"

  return (
    <Card
      className={cn(
        "flex min-h-0 flex-col gap-0 overflow-hidden py-0 xl:h-full",
        className,
      )}
      data-testid="scope-site-tree"
    >
      <CardHeader className="shrink-0 border-b border-slate-100 px-4 !py-3 dark:border-slate-700">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {loading ? (
          <p className="px-3 py-2 text-xs text-slate-400">加载中…</p>
        ) : (
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onSelect({ kind: "all" })}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                isAll
                  ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
              data-testid="scope-tree-all"
            >
              <Globe
                className={cn(
                  "h-4 w-4 shrink-0",
                  isAll ? "text-blue-600" : "text-slate-400",
                )}
              />
              <span className="flex-1">全部</span>
              {showCounts && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isAll ? "text-blue-600" : "text-slate-400",
                  )}
                >
                  {totalAll}
                </span>
              )}
            </button>

            {tree.regions.map((region) => {
              const isOpen = expanded.has(region.code)
              const regionSelected =
                selected.kind === "region" && selected.code === region.code
              const regionCount = sumRegionCount(
                region.sites.map((s) => s.code),
                counts,
              )
              return (
                <div key={region.code}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-0.5 rounded-lg text-sm",
                      regionSelected
                        ? "bg-blue-50 dark:bg-blue-900/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                  >
                    <button
                      type="button"
                      className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-slate-400"
                      aria-label={isOpen ? "收起" : "展开"}
                      onClick={(e) => toggleExpand(region.code, e)}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1 py-2 pr-3 text-left",
                        regionSelected
                          ? "font-medium text-blue-700 dark:text-blue-300"
                          : "text-slate-600 dark:text-slate-300",
                      )}
                      onClick={() =>
                        onSelect({ kind: "region", code: region.code })
                      }
                      data-testid={`scope-tree-region-${region.code}`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-1">
                        <span className="truncate">{region.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          ·区域
                        </span>
                      </span>
                      {showCounts && (
                        <span
                          className={cn(
                            "ml-auto shrink-0 text-xs tabular-nums",
                            regionSelected ? "text-blue-600" : "text-slate-400",
                          )}
                        >
                          {regionCount}
                        </span>
                      )}
                    </button>
                  </div>
                  {isOpen &&
                    region.sites.map((s) => {
                      const siteSelected =
                        selected.kind === "site" && selected.code === s.code
                      const n = counts?.[s.code] ?? 0
                      return (
                        <button
                          key={s.code}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 py-2 pl-10 pr-3 text-left text-sm transition-colors",
                            siteSelected
                              ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                          )}
                          onClick={() =>
                            onSelect({ kind: "site", code: s.code })
                          }
                          data-testid={`scope-tree-site-${s.code}`}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-1">
                            <span className="truncate">{s.label}</span>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              ·站点
                            </span>
                          </span>
                          {showCounts && (
                            <span
                              className={cn(
                                "shrink-0 text-xs tabular-nums",
                                siteSelected
                                  ? "text-blue-600"
                                  : "text-slate-400",
                              )}
                            >
                              {n}
                            </span>
                          )}
                        </button>
                      )
                    })}
                </div>
              )
            })}

            {tree.unassigned.map((s) => {
              const siteSelected =
                selected.kind === "site" && selected.code === s.code
              const n = counts?.[s.code] ?? 0
              return (
                <button
                  key={s.code}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-1 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    siteSelected
                      ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                  onClick={() => onSelect({ kind: "site", code: s.code })}
                  data-testid={`scope-tree-site-${s.code}`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="truncate">{s.label}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      ·站点
                    </span>
                  </span>
                  {showCounts && (
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular-nums",
                        siteSelected ? "text-blue-600" : "text-slate-400",
                      )}
                    >
                      {n}
                    </span>
                  )}
                </button>
              )
            })}

            {!loading &&
              tree.regions.length === 0 &&
              tree.unassigned.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400">
                  当前顶栏范围内暂无站点
                </p>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
