"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SearchFile } from "@/lib/types/search"
import { Search, Download, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"
import { csvFromRows } from "@/lib/export/csv"
import {
  SEARCH_EXPORT_COLUMNS,
  SEARCH_EXPORT_LABELS,
  toSearchExportRowFromUi,
} from "@/lib/search/export-format"

interface SearchBlkInfo {
  blocker: string
  reason: string
  nextStep: string
}

const SEARCH_BLOCKER_REASON = "全文检索服务尚未接入或不可达，请检查 SEARCH_ES_URL / SEARCH_ES_INDEX。"
const SEARCH_BLOCKER_NEXT_STEP = "配置 OpenSearch 并确认 disc_file_index 有数据后重试。"
const PAGE_SIZE_OPTIONS = [100, 200, 500] as const
type SearchDataSource = "opensearch" | "blocked" | "empty"

type SearchApiHit = {
  sourceSiteId?: string
  siteName?: string | null
  sourceTable?: string | null
  sourceRecordId?: string
  docType?: string
  displayName?: string
  fileName?: string
  filePath?: string | null
  folderPath?: string | null
  extension?: string | null
  contentType?: string | null
  sizeBytes?: number | null
  volumeId?: number | null
  volumeCode?: string | null
  volumeName?: string | null
  hash?: string | null
  taskId?: string | null
  status?: number | null
  createDate?: string | null
  updatedAt?: string | null
}

type FacetSite = { code: string; name: string }
type FacetVolume = { siteCode: string; volumeId: string; name: string }

function formatSize(sizeBytes: number | null | undefined): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return "—"
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
  return `${(sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function mapApiHitToSearchFile(hit: SearchApiHit, index: number): SearchFile {
  const sourceSiteId = hit.sourceSiteId ?? "—"
  const sourceRecordId = hit.sourceRecordId ?? String(index)
  const docType = hit.docType ?? "file"
  const name = hit.displayName ?? hit.fileName ?? (docType === "folder" ? "(未命名目录)" : "(未命名文件)")
  return {
    id: `${sourceSiteId}:${hit.sourceTable ?? "row"}:${sourceRecordId}`,
    fileName: name,
    path: hit.folderPath || hit.filePath || "—",
    size: docType === "folder" ? "—" : formatSize(hit.sizeBytes),
    sizeBytes: hit.sizeBytes ?? 0,
    siteName: hit.siteName ?? sourceSiteId,
    siteCode: sourceSiteId,
    docType,
    volumeId: hit.volumeId ?? null,
    volume: hit.volumeName ?? (hit.volumeId != null ? `卷-${hit.volumeId}` : "—"),
    slotId: null,
    fileType: hit.extension ?? (docType === "folder" ? "目录" : "—"),
    contentType: hit.contentType ?? null,
    createdAt: hit.createDate ?? hit.updatedAt ?? "",
    checksum: hit.hash ?? undefined,
    taskId: hit.taskId,
    status: hit.status,
    sourceTable: hit.sourceTable,
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Page() {
  const [keyword, setKeyword] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100)
  const [siteFilter, setSiteFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [volumeFilter, setVolumeFilter] = useState("all")
  const [showExport, setShowExport] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [blk, setBlk] = useState<SearchBlkInfo | null>(null)
  const [dataSource, setDataSource] = useState<SearchDataSource>("blocked")
  const [sites, setSites] = useState<FacetSite[]>([])
  const [volumes, setVolumes] = useState<FacetVolume[]>([])
  /** 进入当前页所用的 searchAfter 栈；空 = 第 1 页 */
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [nextSearchAfter, setNextSearchAfter] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  /** 已 count 过的条件键；与当前条件一致则翻页复用 total */
  const [countedFilterKey, setCountedFilterKey] = useState<string | null>(null)
  const [exportOptions, setExportOptions] = useState({
    format: "CSV",
    range: "all",
  })

  const [searchResults, setSearchResults] = useState<SearchFile[]>([])
  const [searching, setSearching] = useState(false)
  const filterBarRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)

  const scrollFilterToTop = useCallback(() => {
    requestAnimationFrame(() => {
      filterBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    })
  }, [])

  const filteredVolumes = useMemo(() => {
    if (siteFilter === "all") return volumes
    return volumes.filter((v) => v.siteCode === siteFilter)
  }, [volumes, siteFilter])

  const paged = searchResults
  const canGoPrev = cursorStack.length > 0
  const canGoNext = hasMore && Boolean(nextSearchAfter)

  const buildFilterKey = useCallback(
    (kw: string, site: string, volume: string, docType: string) =>
      JSON.stringify({
        q: kw.trim(),
        site,
        volume,
        docType,
      }),
    [],
  )

  const currentFilterKey = useMemo(
    () => buildFilterKey(keyword, siteFilter, volumeFilter, typeFilter),
    [buildFilterKey, keyword, siteFilter, volumeFilter, typeFilter],
  )

  const appendFilterParams = (sp: URLSearchParams) => {
    if (siteFilter !== "all") sp.set("siteCode", siteFilter)
    if (volumeFilter !== "all") sp.set("volumeId", volumeFilter)
    if (typeFilter === "file" || typeFilter === "folder") sp.set("docType", typeFilter)
  }

  const fetchTotalIfNeeded = async (filterKey: string): Promise<number | null> => {
    if (countedFilterKey === filterKey) {
      return total
    }
    const sp = new URLSearchParams({ q: keyword })
    appendFilterParams(sp)
    const res = await fetch(`/api/search/count?${sp.toString()}`)
    const body = await res.json()
    const source = body?.data?.source ?? body?.source
    if (source === "blocked_by_external_system" || !res.ok) {
      return null
    }
    const n = Number(body?.data?.total ?? 0)
    const safe = Number.isFinite(n) && n >= 0 ? n : 0
    setTotal(safe)
    setCountedFilterKey(filterKey)
    return safe
  }

  const applyFacets = (facets: { sites?: FacetSite[]; volumes?: FacetVolume[] } | undefined) => {
    if (facets?.sites?.length) setSites(facets.sites)
    if (facets?.volumes) setVolumes(facets.volumes)
  }

  const detectEs = useCallback(async () => {
    try {
      const res = await fetch("/api/search?q=detect&pageSize=1")
      const data = await res.json()
      const source = data?.data?.source ?? data?.source
      applyFacets(data?.data?.facets)
      if (source === "blocked_by_external_system" || source === "not_implemented") {
        setBlk({
          blocker: data?.data?.blocker ?? "blocked_by_external_system",
          reason: SEARCH_BLOCKER_REASON,
          nextStep: SEARCH_BLOCKER_NEXT_STEP,
        })
        setDataSource("blocked")
        return
      }
      if (source === "opensearch") {
        setBlk(null)
        setDataSource("opensearch")
      }
    } catch {
      setDataSource("blocked")
      setBlk({
        blocker: "blocked_by_external_system",
        reason: SEARCH_BLOCKER_REASON,
        nextStep: SEARCH_BLOCKER_NEXT_STEP,
      })
    }
  }, [])

  useEffect(() => {
    void detectEs()
  }, [detectEs])

  const runSearch = async (opts?: {
    size?: number
    searchAfter?: string | null
    /** 请求成功后用于替换的游标栈 */
    nextStack?: string[]
    pageNo?: number
    silentToast?: boolean
    /** 是否需要按条件刷新总数（条件变化 / 新检索） */
    refreshTotal?: boolean
  }) => {
    const size = opts?.size ?? pageSize
    const searchAfter = opts?.searchAfter ?? null
    const nextStack = opts?.nextStack ?? []
    const pageNo = opts?.pageNo ?? 1
    const refreshTotal = opts?.refreshTotal === true

    setHasSearched(true)
    setPage(pageNo)
    setSearching(true)
    scrollFilterToTop()
    try {
      let countedTotal = total
      if (refreshTotal) {
        const n = await fetchTotalIfNeeded(currentFilterKey)
        if (n == null) {
          setSearchResults([])
          setNextSearchAfter(null)
          setHasMore(false)
          setCursorStack([])
          setTotal(0)
          setCountedFilterKey(null)
          setDataSource("blocked")
          setBlk({
            blocker: "blocked_by_external_system",
            reason: SEARCH_BLOCKER_REASON,
            nextStep: SEARCH_BLOCKER_NEXT_STEP,
          })
          toast({
            title: "检索暂不可用",
            description: SEARCH_BLOCKER_REASON,
            variant: "destructive",
          })
          return
        }
        countedTotal = n
      }

      const sp = new URLSearchParams({
        q: keyword,
        pageSize: String(size),
      })
      appendFilterParams(sp)
      if (searchAfter) sp.set("searchAfter", searchAfter)

      const res = await fetch(`/api/search?${sp.toString()}`)
      const body = await res.json()
      const source = body?.data?.source ?? body?.source
      applyFacets(body?.data?.facets)

      if (source === "not_implemented" || source === "blocked_by_external_system") {
        setSearchResults([])
        setNextSearchAfter(null)
        setHasMore(false)
        setCursorStack([])
        setDataSource("blocked")
        setBlk({
          blocker: body?.data?.blocker ?? "blocked_by_external_system",
          reason: SEARCH_BLOCKER_REASON,
          nextStep: SEARCH_BLOCKER_NEXT_STEP,
        })
        toast({
          title: "检索暂不可用",
          description: SEARCH_BLOCKER_REASON,
          variant: "destructive",
        })
        return
      }

      const items = (body?.data?.items ?? []) as SearchApiHit[]
      const mapped = items.map(mapApiHitToSearchFile)
      setSearchResults(mapped)
      setCursorStack(nextStack)
      setNextSearchAfter(
        typeof body?.data?.nextSearchAfter === "string" ? body.data.nextSearchAfter : null,
      )
      setHasMore(Boolean(body?.data?.hasMore))
      setDataSource(mapped.length > 0 || countedTotal > 0 ? "opensearch" : "empty")
      setBlk(null)
      scrollFilterToTop()
      if (!opts?.silentToast) {
        toast({
          title: "检索完成",
          description: `共 ${countedTotal.toLocaleString("zh-CN")} 条，本页 ${mapped.length} 条`,
        })
      }
    } catch {
      setSearchResults([])
      setNextSearchAfter(null)
      setHasMore(false)
      setDataSource("blocked")
      toast({ title: "检索请求失败", description: "全文检索服务暂未接入。", variant: "destructive" })
    } finally {
      setSearching(false)
    }
  }

  const handleSearch = () => {
    // 点检索：条件相对上次 count 有变化则重新 _count
    const needCount = countedFilterKey !== currentFilterKey
    void runSearch({
      size: pageSize,
      searchAfter: null,
      nextStack: [],
      pageNo: 1,
      refreshTotal: needCount || countedFilterKey == null,
    })
  }

  const handlePageSizeChange = (value: string) => {
    const next = Number(value) as (typeof PAGE_SIZE_OPTIONS)[number]
    setPageSize(next)
    if (hasSearched) {
      // 仅改每页条数：不重新 count，从第一页重查列表
      void runSearch({
        size: next,
        searchAfter: null,
        nextStack: [],
        pageNo: 1,
        refreshTotal: false,
        silentToast: true,
      })
    }
  }

  const handlePrevPage = () => {
    if (!canGoPrev || searching) return
    const newStack = cursorStack.slice(0, -1)
    const after = newStack.length > 0 ? newStack[newStack.length - 1] : null
    void runSearch({
      searchAfter: after,
      nextStack: newStack,
      pageNo: Math.max(1, page - 1),
      silentToast: true,
      refreshTotal: false,
    })
  }

  const handleNextPage = () => {
    if (!canGoNext || !nextSearchAfter || searching) return
    void runSearch({
      searchAfter: nextSearchAfter,
      nextStack: [...cursorStack, nextSearchAfter],
      pageNo: page + 1,
      silentToast: true,
      refreshTotal: false,
    })
  }

  const handleReset = () => {
    setKeyword("")
    setSiteFilter("all")
    setTypeFilter("all")
    setVolumeFilter("all")
    setPage(1)
    setSearchResults([])
    setCursorStack([])
    setNextSearchAfter(null)
    setHasMore(false)
    setTotal(0)
    setCountedFilterKey(null)
    setHasSearched(false)
    toast({ title: "已返回检索首页" })
  }

  const handleExport = () => {
    if (searchResults.length === 0) {
      toast({ title: "无数据可导出", description: "请先执行检索", variant: "destructive" })
      return
    }
    setShowExport(true)
  }

  const handleConfirmExport = () => {
    setShowExport(false)
    const rowsSource = exportOptions.range === "current" ? paged : searchResults
    const rows = rowsSource.map(toSearchExportRowFromUi)
    const stamp = new Date().toISOString().slice(0, 10)
    const fmt = exportOptions.format.toUpperCase() === "JSON" ? "json" : "csv"

    if (fmt === "json") {
      const body = JSON.stringify(
        {
          导出类型: "统一检索",
          导出时间: stamp,
          条数: rows.length,
          列: SEARCH_EXPORT_LABELS,
          数据: rows.map((r) => {
            const o: Record<string, string> = {}
            SEARCH_EXPORT_COLUMNS.forEach((col, i) => {
              o[SEARCH_EXPORT_LABELS[i]] = r[col]
            })
            return o
          }),
        },
        null,
        2,
      )
      downloadBlob(body, `统一检索导出-${stamp}.json`, "application/json;charset=utf-8")
    } else {
      const csv = csvFromRows(rows, [...SEARCH_EXPORT_COLUMNS], SEARCH_EXPORT_LABELS)
      downloadBlob(csv, `统一检索导出-${stamp}.csv`, "text/csv;charset=utf-8")
    }

    toast({
      title: "导出请求已提交",
      description: `已生成 ${rows.length} 条检索结果 (${fmt.toUpperCase()})`,
    })
  }

  const handleRestore = (file: SearchFile) => {
    toast({
      title: "回迁命令未提交",
      description: `文件「${file.fileName}」暂不能定位到可执行的回迁目标。`,
      variant: "destructive",
    })
  }

  const filterSelects = (
    <>
      <Select
        value={siteFilter}
        onValueChange={(v) => {
          setSiteFilter(v)
          setVolumeFilter("all")
        }}
      >
        <SelectTrigger className="h-9 w-[140px] shrink-0" data-testid="search-site-filter">
          <SelectValue placeholder="全部站点" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部站点</SelectItem>
          {sites.map((s) => (
            <SelectItem key={s.code} value={s.code}>
              {s.name} ({s.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={volumeFilter} onValueChange={setVolumeFilter}>
        <SelectTrigger className="h-9 w-[160px] shrink-0" data-testid="search-volume-filter">
          <SelectValue placeholder="全部存储卷" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部存储卷</SelectItem>
          {filteredVolumes.map((v) => (
            <SelectItem key={`${v.siteCode}-${v.volumeId}`} value={v.volumeId}>
              {v.name}
              {siteFilter === "all" ? ` · ${v.siteCode}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-9 w-[120px] shrink-0" data-testid="search-type-filter">
          <SelectValue placeholder="全部类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          <SelectItem value="file">文件</SelectItem>
          <SelectItem value="folder">目录</SelectItem>
        </SelectContent>
      </Select>
    </>
  )

  return (
    <AppShell mainClassName="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="统一检索"
            description={hasSearched ? "跨站点文件检索" : undefined}
            badge={dataSource === "blocked" ? "索引不可用" : undefined}
            actions={
              hasSearched ? (
                <Button variant="outline" size="sm" className="h-8" onClick={handleExport} data-testid="search-export">
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
              ) : undefined
            }
          />
        </div>

        {blk && hasSearched && (
          <Card
            className="shrink-0 gap-0 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
            data-testid="search-blocker-banner"
          >
            <CardContent className="flex gap-3 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">全文检索服务暂未接入</p>
                <p className="mt-1 text-amber-800 dark:text-amber-300">
                  <Badge
                    variant="outline"
                    className="border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                  >
                    服务不可用
                  </Badge>{" "}
                  {blk.reason}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">下一步: {blk.nextStep}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!hasSearched ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto px-2 pb-8">
            <div className="w-full max-w-3xl space-y-6">
              <div className="flex flex-wrap items-center justify-center gap-2">{filterSelects}</div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="输入文件名、目录名、路径或 hash…"
                    className="h-12 rounded-full border-slate-300 pl-12 pr-4 text-base shadow-sm focus-visible:ring-blue-500"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch()
                    }}
                    data-testid="search-keyword"
                    aria-label="全局搜索"
                  />
                </div>
                <Button
                  size="lg"
                  className="h-12 shrink-0 cursor-pointer rounded-full px-8"
                  onClick={handleSearch}
                  data-testid="search-submit"
                  disabled={searching}
                >
                  {searching ? "检索中..." : "检索"}
                </Button>
              </div>
              <div className="space-y-2 text-center text-sm text-slate-500">
                <p className="font-medium text-slate-600 dark:text-slate-400">检索说明</p>
                <ul className="mx-auto max-w-xl space-y-1 text-left sm:text-center">
                  <li>支持按文件名、目录名、路径、hash 关键词检索</li>
                  <li>可先选择站点、存储卷、文件/目录类型缩小范围</li>
                  <li>结果来自各站点推送到 OpenSearch 的文件索引</li>
                  <li>回车或点击「检索」后展示结果列表，可导出当前页或已加载结果</li>
                </ul>
                {blk && (
                  <p className="pt-2 text-amber-700 dark:text-amber-400" data-testid="search-blocker-banner">
                    当前索引服务暂不可用，请检查配置后再试。
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <Card
            ref={filterBarRef}
            className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden scroll-mt-2 py-0"
          >
            <div className="shrink-0 space-y-2 border-b px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {filterSelects}
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="按文件名、目录名、路径、hash 搜索..."
                    className="h-9 pl-9"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch()
                    }}
                    data-testid="search-keyword"
                    aria-label="全局搜索"
                  />
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    className="h-9 cursor-pointer"
                    onClick={handleSearch}
                    data-testid="search-submit"
                    disabled={searching}
                  >
                    {searching ? "检索中..." : "检索"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer"
                    onClick={handleReset}
                    data-testid="search-reset"
                    aria-label="清除筛选"
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    清除
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">检索结果</span>
                <Badge>共 {total.toLocaleString("zh-CN")} 条</Badge>
                <span className="text-xs text-slate-500">
                  {dataSource === "blocked"
                    ? "（检索服务未接入）"
                    : `第 ${page} 页 · 本页 ${paged.length} 条${hasMore ? " · 还可向后翻" : paged.length > 0 ? " · 已到末页" : ""}`}
                </span>
              </div>
            </div>

            <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto px-4">
              <Table className="table-fixed w-full" containerClassName="overflow-visible">
                <colgroup>
                  <col style={{ width: 180 }} />
                  <col style={{ width: 56 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 72 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 88 }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">名称</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">类型</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">路径</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">大小</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">站点</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">存储卷</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">扩展名</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">校验码</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">创建时间</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-xs text-slate-500">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-slate-500" data-testid="search-empty">
                        {dataSource === "blocked"
                          ? "全文检索服务未接入，当前无可检索文件"
                          : "未找到匹配的检索结果"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((f) => {
                      const created = formatBeijingTime(f.createdAt) || "—"
                      const siteLabel =
                        f.siteName && f.siteName !== f.siteCode ? `${f.siteName} (${f.siteCode})` : f.siteCode
                      return (
                        <TableRow
                          key={f.id}
                          className="transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                        >
                          <TableCell className="align-top whitespace-normal break-all text-sm font-medium text-blue-700 dark:text-blue-300">
                            {f.fileName || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm">
                            {f.docType === "folder" ? "目录" : "文件"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-all font-mono text-xs">
                            {f.path || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal text-sm">{f.size}</TableCell>
                          <TableCell className="align-top whitespace-normal break-all text-sm">
                            {siteLabel || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-all text-sm">
                            {f.volume || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-all text-sm">
                            {f.fileType || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-all font-mono text-xs text-slate-500">
                            {f.checksum || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal break-all text-sm text-slate-500">
                            {created}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 cursor-pointer text-xs"
                              onClick={() => handleRestore(f)}
                              data-testid="search-row-restore"
                            >
                              发起回迁
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-center gap-4 border-t bg-card px-4 py-3">
              <p className="text-sm text-slate-500">
                共 {total.toLocaleString("zh-CN")} 条 · 第 {page} 页 · 本页 {paged.length} 条
                {hasMore ? " · 可继续向后" : paged.length > 0 ? " · 已到末页" : ""}
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>每页</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-8 min-w-[7rem] w-auto" data-testid="search-page-size">
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer disabled:cursor-not-allowed"
                  disabled={!canGoPrev || searching}
                  onClick={handlePrevPage}
                  aria-label="上一页"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer disabled:cursor-not-allowed"
                  disabled={!canGoNext || searching}
                  onClick={handleNextPage}
                  aria-label="下一页"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>索引导出</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>导出格式</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(v) => setExportOptions({ ...exportOptions, format: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV (.csv)</SelectItem>
                  <SelectItem value="JSON">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>导出范围</Label>
              <Select
                value={exportOptions.range}
                onValueChange={(v) => setExportOptions({ ...exportOptions, range: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">当前已加载结果 ({searchResults.length} 条)</SelectItem>
                  <SelectItem value="current">当前页 ({paged.length} 条)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-500">
              导出列与列表一致：名称、类型、路径、大小、站点、存储卷、扩展名、校验码、创建时间（中文表头，时间已格式化）。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExport(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmExport} data-testid="search-confirm-export">
              确认导出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
