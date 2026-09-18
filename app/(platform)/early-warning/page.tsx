"use client"

/**
 * /early-warning — 站点预警跨站只读列表 (Sprint R.101)
 *
 * 布局：定高视口，列表/详情分区内滚动，禁止整页滚动。
 * 处理：经 SSO 跳转站点预警页（本页不写回）。
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/platform/page-header"
import { DetailPanel, DetailRow } from "@/components/platform/detail-panel"
import { TimeDisplay } from "@/components/shared/time-format"
import { AppTooltip } from "@/components/shared/tooltip"
import { formatSiteLabel } from "@/components/users/site-field"
import { useSite, useSiteSites } from "@/lib/site/site-context"
import {
  EARLY_WARNING_LEVEL_LABELS,
  EARLY_WARNING_STATUS_LABELS,
  EARLY_WARNING_TYPE_LABELS,
  type EarlyWarningFeedbackItem,
  type EarlyWarningListItem,
} from "@/lib/early-warning/display"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

type DataSource = "database" | "empty" | "error" | "loading"

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500] as const
/** 站点默认主题预警管理路由（hash）；SSO redirect 会规范为 /#/early-warning-list */
const SITE_EARLY_WARNING_PATH = "/early-warning-list"

interface ApiEnvelope {
  code: number
  message?: string
  data?: {
    items: EarlyWarningListItem[]
    total: number
    feedbacks?: EarlyWarningFeedbackItem[]
    readOnly?: boolean
  }
  dataSource?: DataSource
}

function levelBadgeClass(level: number | null): string {
  if (level == null || level === 0) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
  }
  if (level === 1) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
}

function statusBadgeClass(status: number | null): string {
  if (status === 2) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
  }
  if (status === 1) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
  }
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
}

async function jumpToSiteEarlyWarning(siteCode: string): Promise<string> {
  const qs = new URLSearchParams({ redirect: SITE_EARLY_WARNING_PATH })
  const res = await fetch(
    `/api/sites/${encodeURIComponent(siteCode)}/sso?${qs.toString()}`,
    { cache: "no-store", credentials: "include" },
  )
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) {
    throw new Error("请先登录后再跳转站点")
  }
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  if (json.status !== "ready" || !json.jumpUrl) {
    throw new Error(json.message || json.blocker || "无法签发站点跳转")
  }
  return String(json.jumpUrl)
}

export default function EarlyWarningPage() {
  const { siteCode, isAllSites, isReady: siteReady } = useSite()
  const { sites } = useSiteSites()
  const siteLabelByCode = useMemo(
    () => new Map(sites.map((s) => [s.code, s.label])),
    [sites],
  )
  const [items, setItems] = useState<EarlyWarningListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<DataSource>("loading")
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [applied, setApplied] = useState({
    keyword: "",
    type: "all",
    status: "all",
    level: "all",
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50)
  const [selected, setSelected] = useState<EarlyWarningListItem | null>(null)
  const [feedbacks, setFeedbacks] = useState<EarlyWarningFeedbackItem[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [ssoJumping, setSsoJumping] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const applyFilters = useCallback(() => {
    setPage(1)
    setApplied({
      keyword: keyword.trim(),
      type: typeFilter,
      status: statusFilter,
      level: levelFilter,
    })
  }, [keyword, typeFilter, statusFilter, levelFilter])

  const loadList = useCallback(async () => {
    if (!siteReady) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set("limit", String(pageSize))
      qs.set("offset", String((page - 1) * pageSize))
      if (!isAllSites && siteCode) qs.set("siteCode", siteCode)
      if (applied.keyword) qs.set("keyword", applied.keyword)
      if (applied.type !== "all") qs.set("type", applied.type)
      if (applied.status !== "all") qs.set("status", applied.status)
      if (applied.level !== "all") qs.set("level", applied.level)

      const res = await fetch(`/api/early-warning?${qs.toString()}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as ApiEnvelope
      if (!res.ok || json.code !== 0) {
        throw new Error(json.message || `HTTP ${res.status}`)
      }
      const list = json.data?.items ?? []
      setItems(list)
      setTotal(json.data?.total ?? list.length)
      setDataSource(
        json.dataSource === "empty" || (json.data?.total ?? 0) === 0
          ? "empty"
          : "database",
      )
    } catch (e) {
      setItems([])
      setTotal(0)
      setDataSource("error")
      toast({
        title: "加载预警失败",
        description: e instanceof Error ? e.message : "unknown",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [siteReady, isAllSites, siteCode, applied, page, pageSize])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    setPage(1)
    setSelected(null)
    setFeedbacks([])
  }, [isAllSites, siteCode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openDetail = useCallback(async (row: EarlyWarningListItem) => {
    setSelected(row)
    setFeedbacks([])
    if (row.srcWarningId == null || !row.sourceSiteId) return
    setFeedbackLoading(true)
    try {
      const qs = new URLSearchParams({
        siteCode: row.sourceSiteId,
        warningId: String(row.srcWarningId),
        limit: "1",
      })
      const res = await fetch(`/api/early-warning?${qs.toString()}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as ApiEnvelope
      if (res.ok && json.code === 0) {
        setFeedbacks(json.data?.feedbacks ?? [])
      }
    } catch {
      setFeedbacks([])
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  useEffect(() => {
    if (items.length === 0) {
      setSelected(null)
      setFeedbacks([])
      return
    }
    const selectedStillInList =
      selected != null &&
      items.some(
        (r) =>
          r.sourceRecordId === selected.sourceRecordId &&
          r.sourceSiteId === selected.sourceSiteId,
      )
    if (!selectedStillInList) {
      void openDetail(items[0])
    }
  }, [items, selected, openDetail])

  const handleGoSiteProcess = async () => {
    const targetSite = selected?.sourceSiteId
    if (!targetSite) {
      toast({
        title: "请先选择预警",
        description: "从左侧列表点击一条预警后再去站点处理",
        variant: "destructive",
      })
      return
    }
    setSsoJumping(true)
    try {
      const jumpUrl = await jumpToSiteEarlyWarning(targetSite)
      toast({
        title: "正在打开站点",
        description: `前往 ${formatSiteLabel(targetSite, siteLabelByCode.get(targetSite))} 预警管理`,
      })
      window.open(jumpUrl, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast({
        title: "跳转失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setSsoJumping(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden page-pad">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="站点预警"
            description="汇总各站点空间、温度、设备等预警信息。本页仅供查看，处理请到对应站点完成。"
            actions={
              <div className="flex items-center gap-2">
                <AppTooltip content="重新拉取站点预警列表">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => void loadList()}
                    disabled={loading}
                    data-testid="early-warning-refresh"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    刷新
                  </Button>
                </AppTooltip>
              </div>
            }
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-3">
          <Card className="flex min-h-0 flex-col gap-0 overflow-hidden py-0 xl:col-span-2">
            <CardHeader className="flex shrink-0 flex-row items-center space-y-0 border-b border-slate-100 px-5 !py-3 dark:border-slate-700">
              <CardTitle className="flex min-h-9 items-center gap-2 text-base font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                预警列表
                <span className="text-sm font-normal text-muted-foreground">
                  共 {total} 条
                  {dataSource === "empty" ? " · 暂无数据" : ""}
                  {dataSource === "error" ? " · 加载失败" : ""}
                </span>
              </CardTitle>
            </CardHeader>

            <div className="shrink-0 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <Input
                  className="h-8 max-w-xs"
                  placeholder="预警内容关键词"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyFilters()
                  }}
                />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {EARLY_WARNING_TYPE_LABELS.map((label, i) => (
                      <SelectItem key={label} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="处理状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    {EARLY_WARNING_STATUS_LABELS.map((label, i) => (
                      <SelectItem key={label} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue placeholder="级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部级别</SelectItem>
                    {EARLY_WARNING_LEVEL_LABELS.map((label, i) => (
                      <SelectItem key={label} value={String(i)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0 cursor-pointer"
                  onClick={applyFilters}
                >
                  查询
                </Button>
              </div>
            </div>

            <CardContent className="min-h-0 flex-1 overflow-auto p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="w-40">站点</TableHead>
                    <TableHead>预警内容</TableHead>
                    <TableHead className="w-28">级别</TableHead>
                    <TableHead className="w-28">类型</TableHead>
                    <TableHead className="w-28">处理状态</TableHead>
                    <TableHead className="w-44">预警时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        暂无预警数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((row) => (
                      <TableRow
                        key={`${row.sourceSiteId}-${row.sourceRecordId}`}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          selected?.sourceRecordId === row.sourceRecordId &&
                          selected?.sourceSiteId === row.sourceSiteId
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : ""
                        }`}
                        onClick={() => void openDetail(row)}
                      >
                        <TableCell className="max-w-[10rem] text-xs" title={formatSiteLabel(row.sourceSiteId, siteLabelByCode.get(row.sourceSiteId))}>
                          <span className="block truncate">
                            {formatSiteLabel(row.sourceSiteId, siteLabelByCode.get(row.sourceSiteId))}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 truncate" title={row.title}>
                          {row.title || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={levelBadgeClass(row.level)} variant="secondary">
                            {row.levelLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.typeLabel}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.status)} variant="secondary">
                            {row.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.triggeredAt ? (
                            <TimeDisplay value={row.triggeredAt} />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {total > 0 && (
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <span className="text-xs text-slate-500 tabular-nums">
                  第 {page} / {totalPages} 页 · 共 {total} 条
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">每页</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v) as (typeof PAGE_SIZE_OPTIONS)[number])
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[88px]" aria-label="每页条数">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} 条
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>

          <DetailPanel
            className="min-h-0 overflow-hidden xl:col-span-1"
            title="预警详情"
            subtitle={
              selected
                ? formatSiteLabel(selected.sourceSiteId, siteLabelByCode.get(selected.sourceSiteId))
                : undefined
            }
            empty={!selected}
            emptyText="点击左侧预警查看详情"
            actions={
              selected ? (
                <Button
                  size="sm"
                  className="h-7 shrink-0 cursor-pointer gap-1 text-xs"
                  disabled={ssoJumping}
                  onClick={() => void handleGoSiteProcess()}
                >
                  {ssoJumping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  去站点处理
                </Button>
              ) : undefined
            }
          >
            {selected && (
              <div className="space-y-4">
                <DetailRow
                  label="站点"
                  value={formatSiteLabel(
                    selected.sourceSiteId,
                    siteLabelByCode.get(selected.sourceSiteId),
                  )}
                />
                <DetailRow label="预警内容" value={selected.title || "—"} />
                <DetailRow label="类型" value={selected.typeLabel} />
                <DetailRow label="级别" value={selected.levelLabel} />
                <DetailRow label="处理状态" value={selected.statusLabel} />
                <DetailRow
                  label="预警时间"
                  value={
                    selected.triggeredAt ? (
                      <TimeDisplay value={selected.triggeredAt} />
                    ) : (
                      "—"
                    )
                  }
                />
                <div className="pt-2">
                  <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    处理反馈
                  </div>
                  {feedbackLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : feedbacks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无反馈记录</p>
                  ) : (
                    <ul className="space-y-2">
                      {feedbacks.map((fb) => (
                        <li
                          key={`${fb.sourceSiteId}-${fb.sourceRecordId}`}
                          className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
                        >
                          <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
                            <span>{fb.userName || "—"}</span>
                            <span>
                              {fb.feedbackAt ? (
                                <TimeDisplay value={fb.feedbackAt} />
                              ) : (
                                "—"
                              )}
                            </span>
                          </div>
                          <div>{fb.content || "—"}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  处理请在站点完成。点击「去站点处理」将打开该站预警管理页。
                </p>
              </div>
            )}
          </DetailPanel>
        </div>
      </div>
    </div>
  )
}
