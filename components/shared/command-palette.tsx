"use client"

/**
 * Sprint UI-2026-06 — 全局命令面板 (⌘K / Ctrl+K)
 *
 * 功能:
 * - 模糊搜索页面 (跨 sidebar menuItems)
 * - 跳转到任意页面
 * - 切换站点
 * - 触发快速任务操作 (跳转 /tasks?status=...)
 * - 不修改业务逻辑, 只 router.push + 触发现有 API
 *
 * 设计依据: 设计系统 Master → Components → Modals (cmdk 风格)
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  MapPin,
  Search as SearchIcon,
  ClipboardList,
  HardDrive,
  Database,
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
import { ALL_SITES, SITE_CANDIDATES, useSite } from "@/lib/site/site-context"
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

export function CommandPalette() {
  const router = useRouter()
  const { siteCode, isAllSites, setSiteCode } = useSite()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

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
      setActiveIndex(0)
    }
  }, [open])

  const items: CommandItem[] = useMemo(() => {
    const pages: CommandItem[] = [
      { id: "p-dashboard", label: "控制台", icon: LayoutDashboard, group: "page", keywords: ["home", "overview", "控制台", "首页"], perform: () => router.push("/") },
      { id: "p-sites", label: "站点管理", icon: MapPin, group: "page", keywords: ["site", "站点"], perform: () => router.push("/sites") },
      { id: "p-search", label: "统一检索", icon: SearchIcon, group: "page", keywords: ["search", "检索", "全文"], perform: () => router.push("/search") },
      { id: "p-tasks", label: "任务管理", icon: ClipboardList, group: "page", keywords: ["task", "任务", "工单"], perform: () => router.push("/tasks") },
      { id: "p-tasks-failed", label: "任务管理 · 失败任务", hint: "查看失败任务", icon: AlertTriangle, group: "action", keywords: ["failed", "失败", "task"], perform: () => router.push("/tasks?status=failed") },
      { id: "p-tasks-running", label: "任务管理 · 进行中", hint: "查看运行中任务", icon: Activity, group: "action", keywords: ["running", "运行"], perform: () => router.push("/tasks?status=running") },
      { id: "p-racks", label: "盘架管理", icon: HardDrive, group: "page", keywords: ["rack", "盘架", "设备"], perform: () => router.push("/racks") },
      { id: "p-volumes", label: "存储卷", icon: Database, group: "page", keywords: ["volume", "卷", "存储"], perform: () => router.push("/volumes") },
      { id: "p-users", label: "用户与权限", icon: Users, group: "page", keywords: ["user", "用户", "权限"], perform: () => router.push("/users") },
      { id: "p-logs", label: "审计日志", icon: FileText, group: "page", keywords: ["log", "审计", "日志"], perform: () => router.push("/logs") },
      { id: "p-settings", label: "系统设置", icon: Settings, group: "page", keywords: ["setting", "设置", "config"], perform: () => router.push("/settings") },
    ]

    const sites: CommandItem[] = SITE_CANDIDATES.map((s) => ({
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
  }, [router, setSiteCode])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = `${it.label} ${it.hint ?? ""} ${(it.keywords ?? []).join(" ")}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  // 重置 activeIndex 当 query 变化
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleSelect = (item: CommandItem) => {
    setOpen(false)
    item.perform()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = filtered[activeIndex]
      if (item) handleSelect(item)
    }
  }

  // 按 group 分组渲染
  const grouped: Record<string, CommandItem[]> = { page: [], action: [], site: [] }
  for (const it of filtered) {
    grouped[it.group] = grouped[it.group] ?? []
    grouped[it.group].push(it)
  }

  // 重新计算 active 在分组视图里的全局下标 (用于视觉高亮)
  let globalIdx = -1

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
            placeholder="搜索页面、站点、操作... (↑↓ 选择, Enter 确认)"
            className="border-0 shadow-none focus-visible:ring-0 px-0 text-base"
            data-testid="command-palette-input"
          />
          <kbd className="hidden md:inline-flex h-6 px-2 items-center text-[10px] font-mono rounded border bg-slate-100 text-slate-500">
            ESC
          </kbd>
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
              return (
                <div key={g} className="px-2 pb-1">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                    {groupLabel}
                  </div>
                  {list.map((it) => {
                    globalIdx += 1
                    const isActive = globalIdx === activeIndex
                    const active = isAllSites
                      ? it.id === `site-${ALL_SITES}`
                      : it.id === `site-${siteCode ?? ALL_SITES}`
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => handleSelect(it)}
                        onMouseEnter={() => setActiveIndex(items.findIndex((x) => x.id === it.id))}
                        className={cn(
                          "w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-left transition-colors cursor-pointer",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        )}
                        data-testid={`command-item-${it.id}`}
                      >
                        <it.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-white" : "text-slate-500"
                          )}
                        />
                        <span className="flex-1">{it.label}</span>
                        {it.hint && (
                          <span
                            className={cn(
                              "text-xs",
                              isActive ? "text-blue-100" : "text-slate-400"
                            )}
                          >
                            {it.hint}
                          </span>
                        )}
                        {active && it.group === "site" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="border-t px-4 py-2 text-[11px] text-slate-500 flex items-center justify-between">
          <span>共 {filtered.length} 项</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded border bg-slate-100 font-mono">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded border bg-slate-100 font-mono">↓</kbd>
            <span>导航</span>
            <kbd className="ml-2 px-1.5 py-0.5 rounded border bg-slate-100 font-mono">↵</kbd>
            <span>选择</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
