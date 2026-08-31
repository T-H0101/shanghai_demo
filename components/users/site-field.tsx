"use client"

import { useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL_SITES, useSiteSites } from "@/lib/site/site-context"
import { cn } from "@/lib/utils"

export function formatSiteLabel(code: string, label?: string | null): string {
  const c = (code ?? "").trim()
  if (!c) return "—"
  let name = (label ?? "").trim()
  if (!name || name === c) return c
  // site-context 的 label 常为「CODE 名称」，去掉前缀后再拼「名称（编号）」
  if (name.startsWith(`${c} `)) name = name.slice(c.length + 1).trim()
  if (!name || name === c) return c
  return `${name}（${c}）`
}

export function useRegisteredSites() {
  const { sites, loading, error } = useSiteSites()
  const registered = useMemo(
    () => sites.filter((site) => site.code && site.code !== ALL_SITES),
    [sites],
  )
  return { sites: registered, loading, error }
}

export function SiteSelect({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  testId?: string
}) {
  const { sites, loading } = useRegisteredSites()
  const options =
    value && !sites.some((site) => site.code === value)
      ? [{ code: value, label: value }, ...sites]
      : sites

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled || loading || options.length === 0}>
      <SelectTrigger className="w-full" data-testid={testId}>
        <SelectValue placeholder={loading ? "站点加载中…" : options.length === 0 ? "暂无已登记站点" : "请选择站点"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((site) => (
          <SelectItem key={site.code} value={site.code}>
            {formatSiteLabel(site.code, site.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SiteMultiSelect({
  value,
  onChange,
  disabled,
  testId = "auth-accessible-sites",
}: {
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
  testId?: string
}) {
  const { sites, loading } = useRegisteredSites()
  const allSelected = value.includes("*")
  const selected = allSelected ? [] : value.filter(Boolean)

  const summary = allSelected
    ? "全部站点"
    : selected.length === 0
      ? "请选择站点"
      : selected.length > 2
        ? `已选 ${selected.length} 个站点`
        : selected
            .map((code) => {
              const site = sites.find((item) => item.code === code)
              return formatSiteLabel(code, site?.label)
            })
            .join("、")

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading}
          className="h-9 w-full min-w-0 max-w-full justify-between gap-2 overflow-hidden px-3 font-normal"
          data-testid={testId}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !allSelected && selected.length === 0 && "text-muted-foreground",
            )}
          >
            {loading ? "站点加载中…" : summary}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={(checked) => onChange(checked === true ? ["*"] : [])}
          onSelect={(event) => event.preventDefault()}
        >
          全部站点
        </DropdownMenuCheckboxItem>
        {sites.map((site) => {
          const checked = allSelected || selected.includes(site.code)
          return (
            <DropdownMenuCheckboxItem
              key={site.code}
              checked={checked}
              onCheckedChange={(next) => {
                if (next === true) {
                  const nextCodes = allSelected ? [site.code] : [...selected, site.code]
                  onChange(
                    sites.length > 0 && sites.every((item) => nextCodes.includes(item.code))
                      ? ["*"]
                      : nextCodes,
                  )
                  return
                }
                if (allSelected) {
                  onChange(sites.map((item) => item.code).filter((code) => code !== site.code))
                  return
                }
                onChange(selected.filter((code) => code !== site.code))
              }}
              onSelect={(event) => event.preventDefault()}
            >
              {formatSiteLabel(site.code, site.label)}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function formatAccessibleSites(
  codes: string[] | null | undefined,
  sites: { code: string; label: string }[],
): string {
  if (!codes || codes.length === 0) return "—"
  if (codes.includes("*")) return "全部站点"
  return codes
    .map((code) => {
      const site = sites.find((item) => item.code === code)
      return formatSiteLabel(code, site?.label)
    })
    .join("、")
}
