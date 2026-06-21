"use client"

/**
 * Sprint UI-2026-06 + r2 — 全局命令面板 (⌘K / Ctrl+K)
 *
 * r2 修复:
 *  - Bug A: 箭头键顺序错乱 → 字符串 id 替代数字 index (具体见 activeItemId 状态)
 *  - Bug B: hover 卡顿 → CommandItemRow React.memo + useCallback + will-change
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  MapPin,
  Search as SearchIcon,
  ClipboardList,
  HardDrive,
  Database,
  RefreshCw,
  Users,
  FileText,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Server,
  Zap,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ALL_SITES, useSite, useSiteSites } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  label: string
  hint?: string
  icon: typeof LayoutDashboard
  group: "page" | "site" | "action"
  keywords?: string[]
  perform: () => void
}

interface CommandItemRowProps {
  item: CommandItem
  isActive: boolean
  isCurrentSite: boolean
  onSelect: (item: CommandItem) => void
  onHover: (id: string) => void
}

const CommandItemRow = memo(function CommandItemRow({
  item,
  isActive,
  isCurrentSite,
  onSelect,
  onHover,
}: CommandItemRowProps) {
  const Icon = item.icon
  const ref = useRef<HTMLButtonElement>(null)

  // 当本项被激活(↑↓/hover)时, 如果不在视口内则滚动到可见。
  // 'nearest' 表示只在不可见时才滚, 不会在已可见时强制重定位。
  // 不带 behavior 让滚动即时, 避免长列表里 smooth 累积导致"飘"。
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isActive])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(item.id)}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-left cursor-pointer",
        "transition-colors duration-100 will-change-[background-color]",
        isActive
          ? "bg-blue-600 text-white"
          : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/80",
      )}
      data-testid={`command-item-${item.id}`}
      data-active={isActive ? "true" : "false"}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-white" : "text-slate-500",
        )}
      />
      <span className="flex-1">{item.label}</span>
      {item.hint && (
        <span
          className={cn(
            "text-xs",
            isActive ? "text-blue-100" : "text-slate-400",
          )}
        >
          {item.hint}
        </span>
      )}
      {isCurrentSite && item.group === "site" && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      )}
    </button>
  )
})

export function CommandPalette() {
  const router = useRouter()
  const { siteCode, isAllSites, setSiteCode } = useSite()
  const { sites: siteOptions } = useSiteSites()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  // 监听全局快捷键 ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setActiveItemId(null)
    }
  }, [open])

  const items: CommandItem[] = useMemo(() => {
    const pages: CommandItem[] = [
      { id: "p-dashboard", label: "控制台", icon: LayoutDashboard, group: "page", keywords: ["home", "overview", "控制台", "首页"], perform: () => router.push("/") },
      { id: "p-sites", label: "站点管理", icon: MapPin, group: "page", keywords: ["site", "站点"], perform: () => router.push("/sites") },
      { id: "p-search", label: "统一检索", icon: SearchIcon, group: "page", keywords: ["search", "检索", "全文"], perform: () => router.push("/search") },
      { id: "p-sync", label: "同步中心", icon: RefreshCw, group: "page", keywords: ["sync", "同步", "调度", "一致性"], perform: () => router.push("/sync") },
      { id: "p-tasks", label: "任务管理", icon: ClipboardList, group: "page", keywords: ["task", "任务", "工单"], perform: () => router.push("/tasks") },
      { id: "p-tasks-failed", label: "任务管理 · 失败任务", hint: "查看失败任务", icon: AlertTriangle, group: "action", keywords: ["failed", "失败", "task"], perform: () => router.push("/tasks?phase=failed") },
      { id: "p-tasks-running", label: "任务管理 · 进行中", hint: "查看运行中任务", icon: Activity, group: "action", keywords: ["running", "运行"], perform: () => router.push("/tasks?phaseGroup=running") },
      { id: "p-racks", label: "盘架管理", icon: HardDrive, group: "page", keywords: ["rack", "盘架", "设备"], perform: () => router.push("/racks") },
      { id: "p-volumes", label: "存储卷", icon: Database, group: "page", keywords: ["volume", "卷", "存储"], perform: () => router.push("/volumes") },
      { id: "p-users", label: "用户与权限", icon: Users, group: "page", keywords: ["user", "用户", "权限"], perform: () => router.push("/users") },
      { id: "p-logs", label: "审计日志", icon: FileText, group: "page", keywords: ["log", "审计", "日志"], perform: () => router.push("/logs") },
      { id: "p-settings", label: "系统设置", icon: Settings, group: "page", keywords: ["setting", "设置", "config"], perform: () => router.push("/settings") },
    ]

    const siteList: Array<{ code: string; label: string }> = [
      { code: ALL_SITES, label: "全部站点" },
      ...siteOptions.filter((s) => s.code !== ALL_SITES),
    ]
    const sites: CommandItem[] = siteList.map((s) => ({
      id: `site-${s.code}`,
      label: s.label,
      hint: s.code === ALL_SITES ? "汇总全部站点" : `切换到 ${s.code}`,
      icon: Server,
      group: "site",
      keywords: ["site", "站点", s.code.toLowerCase(), s.label],
      perform: () => {
        setSiteCode(s.code === ALL_SITES ? null : s.code)
        router.push(s.code === ALL_SITES ? "/" : `/?siteCode=${s.code}`)
      },
    }))

    return [...pages, ...sites]
  }, [router, setSiteCode, siteOptions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = `${it.label} ${it.hint ?? ""} ${(it.keywords ?? []).join(" ")}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  // 重置 active — query/open 变化时默认第一项
  useEffect(() => {
    setActiveItemId(filtered[0]?.id ?? null)
  }, [query, open])

  const handleSelect = useCallback((item: CommandItem) => {
    setOpen(false)
    item.perform()
  }, [])

  const handleHover = useCallback((id: string) => {
    setActiveItemId(id)
  }, [])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveItemId((cur) => {
        const idx = cur ? filtered.findIndex((x) => x.id === cur) : -1
        return filtered[(idx + 1 + filtered.length) % filtered.length]?.id ?? null
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveItemId((cur) => {
        const idx = cur ? filtered.findIndex((x) => x.id === cur) : filtered.length
        return filtered[(idx - 1 + filtered.length) % filtered.length]?.id ?? null
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = filtered.find((x) => x.id === activeItemId)
      if (item) handleSelect(item)
    }
  }

  // 按 group 分组渲染
  const grouped: Record<string, CommandItem[]> = { page: [], action: [], site: [] }
  for (const it of filtered) {
    grouped[it.group] = grouped[it.group] ?? []
    grouped[it.group].push(it)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 gap-0 max-w-2xl overflow-hidden"
        data-testid="command-palette"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">命令面板</DialogTitle>
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Zap className="h-4 w-4 text-blue-600" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索页面、站点、操作…"
            className="border-0 shadow-none focus-visible:ring-0 px-0 text-base"
            data-testid="command-palette-input"
            aria-label="命令面板搜索"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2" data-testid="command-palette-list">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              未找到匹配项
            </div>
          ) : (
            (["page", "action", "site"] as const).map((g) => {
              const list = grouped[g]
              if (!list || list.length === 0) return null
              const groupLabel =
                g === "page" ? "页面" : g === "action" ? "快捷操作" : "切换站点"
              const groupHasActive = list.some((it) => it.id === activeItemId)
              return (
                <div key={g} className="px-2 pb-1">
                  <div
                    data-testid={`command-group-${g}`}
                    data-has-active={groupHasActive ? "true" : "false"}
                    className={cn(
                      "relative px-2 py-1 text-[10px] uppercase tracking-wider font-medium transition-colors duration-100",
                      groupHasActive ? "text-blue-600 dark:text-blue-300" : "text-slate-400",
                    )}
                  >
                    {/* 视觉锚点: 当组内有 active 项时, 显示蓝色短竖条 */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full transition-opacity duration-100",
                        groupHasActive ? "bg-blue-600 opacity-100" : "opacity-0",
                      )}
                    />
                    {groupLabel}
                  </div>
                  {list.map((it) => {
                    const active = isAllSites
                      ? it.id === `site-${ALL_SITES}`
                      : it.id === `site-${siteCode ?? ALL_SITES}`
                    return (
                      <CommandItemRow
                        key={it.id}
                        item={it}
                        isActive={it.id === activeItemId}
                        isCurrentSite={active}
                        onSelect={handleSelect}
                        onHover={handleHover}
                      />
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
          <span>共 {filtered.length} 项 · 按 <kbd className="px-1 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">ESC</kbd> 关闭</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↓</kbd>
            <span>导航</span>
            <kbd className="px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-800 font-mono text-[10px]">↵</kbd>
            <span>选择</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}