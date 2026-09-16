"use client"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { PageHeader } from "@/components/platform/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SearchFile } from "@/lib/types/search"
import { Search, Download, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { formatBeijingTime } from "@/components/shared/time-format"
import { csvFromRows } from "@/lib/export/csv"
import {
  SEARCH_EXPORT_COLUMNS,
  SEARCH_EXPORT_LABELS,
  toSearchExportRowFromUi,
} from "@/lib/search/export-format"
import {
  canInitiatePhysicalRestore,
  formatDeviceEndpoint,
  formatDeviceLocationLabel,
  isHardDiskVolume,
  RESTORE_RELOCATED_HINT,
} from "@/lib/search/location-display"
import { openSiteSsoJump } from "@/lib/site/open-site-sso"

interface SearchBlkInfo {
  blocker: string
  reason: string
  nextStep: string
}

const SEARCH_BLOCKER_REASON = "全文检索服务尚未接入或不可达，请检查 SEARCH_ES_URL / SEARCH_ES_INDEX。"
const SEARCH_BLOCKER_NEXT_STEP = "配置 OpenSearch 并确认 disc_file_index 有数据后重试。"
const PAGE_SIZE_OPTIONS = [100, 200, 500] as const
const SEARCH_FETCH_INIT: RequestInit = { credentials: "include" }
/** 站点任务列表（SSO redirect，与设备「去站点管理」同一跳转契约） */
const SITE_TASK_LIST_PATH = "/task-list"
const RESTORE_SUBMITTED_PREFIX = "search-restore-submitted-at:"
const RESTORE_CONFIRM_WINDOW_MS = 5 * 60 * 1000

function restoreSubmittedStorageKey(fileId: string): string {
  return `${RESTORE_SUBMITTED_PREFIX}${fileId}`
}

/** 5 分钟内是否已成功发起过（sessionStorage 时间戳；整页刷新清空） */
function wasRestoreSubmittedRecently(fileId: string): boolean {
  if (typeof window === "undefined" || !fileId) return false
  try {
    const raw = sessionStorage.getItem(restoreSubmittedStorageKey(fileId))
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    if (Date.now() - at > RESTORE_CONFIRM_WINDOW_MS) {
      sessionStorage.removeItem(restoreSubmittedStorageKey(fileId))
      return false
    }
    return true
  } catch {
    return false
  }
}

function markRestoreSubmittedNow(fileId: string): void {
  if (typeof window === "undefined" || !fileId) return
  try {
    sessionStorage.setItem(restoreSubmittedStorageKey(fileId), String(Date.now()))
  } catch {
    // ignore quota / private mode
  }
}

type SearchDataSource = "opensearch" | "blocked" | "empty"

type SearchApiHit = {
  sourceSiteId?: string
  displaySiteCode?: string | null
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
  volumeType?: number | null
  magazineRfid?: string | null
  serialNum?: string | null
  deviceIp?: string | null
  devicePort?: string | null
  deviceName?: string | null
  siteDisplayLabel?: string | null
  locationLabel?: string | null
  logicalRegionCode?: string | null
  logicalRegionName?: string | null
  relocated?: boolean
  slotId?: number | null
  slotOrder?: number | null
  discSide?: number | null
  hash?: string | null
  taskId?: string | null
  status?: number | null
  createDate?: string | null
  updatedAt?: string | null
}

type FacetRegion = { code: string; name: string }

function formatSize(sizeBytes: number | null | undefined): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) return "—"
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
  return `${(sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDeviceLabel(hit: SearchApiHit): string {
  return formatDeviceEndpoint(hit.deviceName, hit.deviceIp, hit.devicePort) || "—"
}

function SearchDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm border-b border-slate-100 last:border-0 dark:border-slate-800">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  )
}

function mapApiHitToSearchFile(hit: SearchApiHit, index: number): SearchFile {
  const archiveSiteId = hit.sourceSiteId ?? "—"
  const displaySiteCode = hit.displaySiteCode?.trim() || archiveSiteId
  const relocated = Boolean(hit.relocated)
  const sourceRecordId = hit.sourceRecordId ?? String(index)
  const docType = hit.docType ?? "file"
  const name = hit.displayName ?? hit.fileName ?? (docType === "folder" ? "(未命名目录)" : "(未命名文件)")
  const volumeType =
    hit.volumeType != null && Number.isFinite(Number(hit.volumeType))
      ? Number(hit.volumeType)
      : null
  const serialNum = hit.serialNum?.trim() || null
  const magazineRfid = hit.magazineRfid?.trim() || null
  const slotOrder =
    hit.slotOrder != null && Number.isFinite(Number(hit.slotOrder))
      ? Number(hit.slotOrder)
      : null
  const discSide =
    hit.discSide != null && Number.isFinite(Number(hit.discSide))
      ? Number(hit.discSide)
      : null
  const deviceIp = hit.deviceIp?.trim() || null
  const devicePort = hit.devicePort?.trim() || null
  const deviceName = hit.deviceName?.trim() || null
  const siteDisplayLabel =
    hit.siteDisplayLabel?.trim() ||
    (hit.siteName && hit.siteName !== displaySiteCode
      ? `${hit.siteName} (${displaySiteCode})`
      : displaySiteCode)
  const locationLabel =
    hit.locationLabel?.trim() ||
    formatDeviceLocationLabel({
      volumeType,
      deviceName,
      deviceIp,
      devicePort,
      magazineRfid,
      slotOrder,
      discSide,
      serialNum,
    })
  return {
    id: `${archiveSiteId}:${hit.sourceTable ?? "row"}:${sourceRecordId}`,
    fileName: name,
    path: hit.folderPath || hit.filePath || "—",
    size: docType === "folder" ? "—" : formatSize(hit.sizeBytes),
    sizeBytes: hit.sizeBytes ?? 0,
    siteName: hit.siteName ?? displaySiteCode,
    siteCode: displaySiteCode,
    siteDisplayLabel,
    relocated,
    logicalRegionCode: hit.logicalRegionCode?.trim() || null,
    docType,
    volumeId: hit.volumeId ?? null,
    volume: hit.volumeName ?? (hit.volumeId != null ? `卷-${hit.volumeId}` : "—"),
    volumeType,
    deviceLabel: formatDeviceLabel(hit),
    deviceIp,
    devicePort,
    magazineRfid,
    serialNum,
    slotId:
      hit.slotId != null && Number.isFinite(Number(hit.slotId))
        ? Number(hit.slotId)
        : null,
    slotOrder,
    discSide,
    locationLabel,
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
  const [regionFilter, setRegionFilter] = useState("all")
  const [showExport, setShowExport] = useState(false)
  const [detailFile, setDetailFile] = useState<SearchFile | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [blk, setBlk] = useState<SearchBlkInfo | null>(null)
  const [dataSource, setDataSource] = useState<SearchDataSource>("blocked")
  const [regions, setRegions] = useState<FacetRegion[]>([])
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
  const [restoreSubmittingId, setRestoreSubmittingId] = useState<string | null>(null)
  const [restoreSuccess, setRestoreSuccess] = useState<{
    file: SearchFile
    message: string
    winnerSiteCode: string | null
    winnerSiteName: string | null
    winnerDeviceLabel: string | null
  } | null>(null)
  const [restoreFailDetail, setRestoreFailDetail] = useState<{
    title: string
    lines: string[]
  } | null>(null)
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<SearchFile | null>(null)
  const [ssoJumping, setSsoJumping] = useState(false)
  const filterBarRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)

  const scrollFilterToTop = useCallback(() => {
    requestAnimationFrame(() => {
      filterBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0
    })
  }, [])

  const buildFilterKey = useCallback(
    (kw: string, region: string) =>
      JSON.stringify({
        q: kw.trim(),
        region,
        docType: "file",
      }),
    [],
  )

  const currentFilterKey = useMemo(
    () => buildFilterKey(keyword, regionFilter),
    [buildFilterKey, keyword, regionFilter],
  )

  const appendFilterParams = (sp: URLSearchParams) => {
    if (regionFilter !== "all") sp.set("regionCode", regionFilter)
    sp.set("docType", "file")
  }

  const paged = searchResults
  const canGoPrev = cursorStack.length > 0
  const canGoNext = hasMore && Boolean(nextSearchAfter)

  const fetchTotalIfNeeded = async (filterKey: string): Promise<number | null> => {
    if (countedFilterKey === filterKey) {
      return total
    }
    const sp = new URLSearchParams({ q: keyword })
    appendFilterParams(sp)
    const res = await fetch(`/api/search/count?${sp.toString()}`, SEARCH_FETCH_INIT)
    if (res.status === 401 || res.status === 403) {
      return null
    }
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

  const applyFacets = (facets: { regions?: FacetRegion[] } | undefined) => {
    if (facets?.regions?.length) {
      setRegions((prev) => (facets.regions!.length >= prev.length ? facets.regions! : prev))
    }
  }

  const loadRegionFacets = useCallback(async () => {
    try {
      const res = await fetch("/api/sites/regions", SEARCH_FETCH_INIT)
      if (!res.ok) return
      const json = await res.json()
      const rows = (json?.data?.regions ?? []) as Array<{
        code: string
        name?: string
        status?: string
      }>
      setRegions(
        rows
          .filter((r) => r.status === "active")
          .map((r) => ({
            code: r.code,
            name: r.name?.trim() || r.code,
          })),
      )
    } catch {
      // ignore
    }
  }, [])

  const detectEs = useCallback(async () => {
    try {
      const res = await fetch("/api/search?q=detect&pageSize=1", SEARCH_FETCH_INIT)
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
    void loadRegionFacets()
  }, [detectEs, loadRegionFacets])

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

      const res = await fetch(`/api/search?${sp.toString()}`, SEARCH_FETCH_INIT)
      if (res.status === 401) {
        toast({
          title: "请先登录总控",
          description: "统一检索需要登录会话",
          variant: "destructive",
        })
        return
      }
      if (res.status === 403) {
        toast({
          title: "无权检索该站点",
          description: "请切换为有权限的站点筛选条件",
          variant: "destructive",
        })
        return
      }
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
    setRegionFilter("all")
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

  const submitRestore = async (file: SearchFile) => {
    if (restoreSubmittingId) return

    const missing: string[] = []
    if (!file.magazineRfid?.trim()) missing.push("盘笼RFID")
    if (file.slotOrder == null || !Number.isFinite(file.slotOrder)) missing.push("盘位号")
    if (file.discSide == null || !Number.isFinite(file.discSide)) missing.push("光盘面(AB)")
    if (!file.path?.trim() || file.path === "—") missing.push("文件路径")
    if (!file.checksum?.trim()) missing.push("文件校验码")
    if (file.relocated) {
      if (!file.logicalRegionCode?.trim()) missing.push("目标区域")
    } else if (!file.siteCode?.trim() || file.siteCode === "—") {
      missing.push("目标站点")
    }

    if (missing.length) {
      toast({
        title: "回迁记录未提交",
        description: `物理位置不齐全，缺少：${missing.join("、")}`,
        variant: "destructive",
      })
      return
    }

    setRestoreSubmittingId(file.id)
    try {
      const res = await fetch("/api/search/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relocated: Boolean(file.relocated),
          fanoutByRegion: Boolean(file.relocated),
          regionCode: file.logicalRegionCode ?? null,
          targetSiteCode: file.relocated ? null : file.siteCode,
          deviceIp: file.deviceIp,
          devicePort: file.devicePort,
          magazineRfid: file.magazineRfid,
          slotOrder: file.slotOrder,
          discSide: file.discSide,
          folderPath: file.path,
          fileName: file.fileName,
          fileHash: file.checksum,
          fileSize:
            typeof file.sizeBytes === "number" && Number.isFinite(file.sizeBytes)
              ? file.sizeBytes
              : null,
          docType: file.docType,
        }),
      })
      const body = await res.json().catch(() => ({}))
      const siteReasonCode =
        typeof body?.data?.siteReasonCode === "string"
          ? body.data.siteReasonCode
          : null
      const message =
        typeof body?.message === "string"
          ? body.message
          : res.ok
            ? "回迁记录已提交到站点待回迁表，等待站点处理"
            : "回迁记录提交失败"
      const attempts = Array.isArray(body?.data?.attempts) ? body.data.attempts : []

      if (!res.ok || body?.code !== 0) {
        const missingFields = Array.isArray(body?.data?.missing)
          ? body.data.missing.join(", ")
          : ""
        const inProgress =
          siteReasonCode === "RESTORE_IN_PROGRESS" ||
          attempts.some(
            (a: { reasonCode?: string }) => a?.reasonCode === "RESTORE_IN_PROGRESS",
          )
        if (inProgress) {
          toast({
            title: "当前文件正在回迁中",
            description: message || "请稍后再试，或前往站点任务列表查看进度",
            variant: "destructive",
          })
          return
        }
        if (attempts.length > 0) {
          setRestoreFailDetail({
            title: "回迁记录未提交",
            lines: attempts.map(
              (a: {
                siteName?: string
                siteCode?: string
                message?: string
                reasonCode?: string
              }) =>
                `${a.siteName || a.siteCode || "站点"}（${a.siteCode || "—"}）：${
                  a.message || a.reasonCode || "失败"
                }`,
            ),
          })
          return
        }
        toast({
          title: "回迁记录未提交",
          description: missingFields ? `${message}（${missingFields}）` : message,
          variant: "destructive",
        })
        return
      }

      const winnerSiteCode =
        typeof body?.data?.winnerSiteCode === "string"
          ? body.data.winnerSiteCode
          : typeof body?.data?.targetSiteCode === "string"
            ? body.data.targetSiteCode
            : file.siteCode
      const winnerSiteName =
        typeof body?.data?.winnerSiteName === "string"
          ? body.data.winnerSiteName
          : null
      const winnerDeviceLabel =
        typeof body?.data?.winnerDeviceLabel === "string"
          ? body.data.winnerDeviceLabel
          : null

      markRestoreSubmittedNow(file.id)
      setRestoreConfirmFile(null)
      setRestoreSuccess({
        file,
        message,
        winnerSiteCode,
        winnerSiteName,
        winnerDeviceLabel,
      })
      setDetailFile(null)
    } catch (e) {
      toast({
        title: "回迁记录未提交",
        description: e instanceof Error ? e.message : "网络异常",
        variant: "destructive",
      })
    } finally {
      setRestoreSubmittingId(null)
    }
  }

  const handleRestore = async (file: SearchFile) => {
    if (file.docType === "folder") {
      toast({
        title: "回迁记录未提交",
        description: "目录暂不支持按物理位置登记回迁，请选择文件。",
        variant: "destructive",
      })
      return
    }

    if (!canInitiatePhysicalRestore(file.volumeType)) {
      toast({
        title: "回迁记录未提交",
        description: "硬盘卷暂不支持从总控发起物理回迁。",
        variant: "destructive",
      })
      return
    }

    if (restoreSubmittingId) return

    if (wasRestoreSubmittedRecently(file.id)) {
      setRestoreConfirmFile(file)
      return
    }

    await submitRestore(file)
  }

  const handleJumpToSiteTaskList = async () => {
    const siteCode =
      restoreSuccess?.winnerSiteCode?.trim() || restoreSuccess?.file.siteCode?.trim()
    if (!siteCode || siteCode === "—") {
      toast({
        title: "无法跳转站点",
        description: "缺少目标站点",
        variant: "destructive",
      })
      return
    }
    setSsoJumping(true)
    try {
      await openSiteSsoJump(siteCode, { redirect: SITE_TASK_LIST_PATH })
      toast({
        title: "正在打开站点",
        description: `已签发跳转票据 → ${siteCode} 任务列表`,
      })
    } catch (e) {
      toast({
        title: "无法跳转站点",
        description: e instanceof Error ? e.message : "签发跳转失败",
        variant: "destructive",
      })
    } finally {
      setSsoJumping(false)
    }
  }

  const filterSelects = (
    <>
      <Select value={regionFilter} onValueChange={setRegionFilter}>
        <SelectTrigger className="h-9 w-[200px] shrink-0" data-testid="search-region-filter">
          <SelectValue placeholder="全部区域" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部区域</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r.code} value={r.code}>
              {r.name} ({r.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden page-pad">
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
                    placeholder="输入文件名、路径或 hash…"
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
                  <li>支持按文件名、路径、hash 关键词检索</li>
                  <li>可先选择站点、设备缩小范围</li>
                  <li>结果仅含文件（不含目录条目），来自各站点 OpenSearch 文件索引</li>
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
                    placeholder="按文件名、路径、hash 搜索..."
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
                  <col style={{ width: "16%" }} />
                  {/* <col style={{ width: "4%" }} /> 类型列暂隐藏 */}
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">名称</TableHead>
                    {/* <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">类型</TableHead> */}
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">路径</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">大小</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">区域/站点</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">备份位置</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">扩展名</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500">校验码</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500 whitespace-nowrap">创建时间</TableHead>
                    <TableHead className="sticky top-0 z-20 bg-card text-sm text-slate-500 whitespace-nowrap">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-slate-500" data-testid="search-empty">
                        {dataSource === "blocked"
                          ? "全文检索服务未接入，当前无可检索文件"
                          : "未找到匹配的检索结果"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((f) => {
                      const created = formatBeijingTime(f.createdAt) || "—"
                      const siteLabel = f.siteDisplayLabel || f.siteName || f.siteCode
                      const restoreDisabled =
                        !canInitiatePhysicalRestore(f.volumeType, f.relocated) ||
                        restoreSubmittingId === f.id
                      const restoreTitle = isHardDiskVolume(f.volumeType)
                        ? "硬盘卷暂不支持从总控发起物理回迁"
                        : f.relocated
                          ? RESTORE_RELOCATED_HINT
                          : undefined
                      return (
                        <TableRow
                          key={f.id}
                          className="transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/20"
                        >
                          <TableCell className="align-top max-w-0 whitespace-normal break-all text-sm font-medium text-blue-700 dark:text-blue-300">
                            {f.fileName || "—"}
                          </TableCell>
                          {/* <TableCell className="align-top whitespace-nowrap text-sm">
                            {f.docType === "folder" ? "目录" : "文件"}
                          </TableCell> */}
                          <TableCell className="align-top max-w-0 whitespace-normal break-all font-mono text-sm">
                            {f.path || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap text-sm">{f.size}</TableCell>
                          <TableCell className="align-top max-w-0 whitespace-normal break-all text-sm">
                            {siteLabel || "—"}
                          </TableCell>
                          <TableCell className="align-top max-w-0 whitespace-normal break-all text-sm">
                            {f.locationLabel || "—"}
                          </TableCell>
                          <TableCell className="align-top max-w-0 whitespace-normal break-all text-sm">
                            {f.fileType || "—"}
                          </TableCell>
                          <TableCell className="align-top max-w-0 whitespace-normal break-all font-mono text-sm text-slate-500">
                            {f.checksum || "—"}
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap text-sm text-slate-500">
                            {created}
                          </TableCell>
                          <TableCell className="align-top whitespace-nowrap">
                            <div className="flex flex-nowrap items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 cursor-pointer px-2.5 text-xs"
                                onClick={() => setDetailFile(f)}
                                data-testid="search-row-detail"
                              >
                                详情
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 cursor-pointer px-2.5 text-xs disabled:cursor-not-allowed"
                                onClick={() => handleRestore(f)}
                                disabled={restoreDisabled}
                                title={restoreTitle}
                                data-testid="search-row-restore"
                              >
                                {restoreSubmittingId === f.id ? "提交中…" : "发起回迁"}
                              </Button>
                            </div>
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

      <Dialog open={detailFile != null} onOpenChange={(open) => { if (!open) setDetailFile(null) }}>
        <DialogContent className="sm:max-w-lg" data-testid="search-detail-dialog">
          <DialogHeader>
            <DialogTitle className="pr-6 break-all">
              {detailFile?.fileName || "检索详情"}
            </DialogTitle>
          </DialogHeader>
          {detailFile && (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              <SearchDetailRow label="名称" value={detailFile.fileName || "—"} />
              {/* <SearchDetailRow
                label="类型"
                value={detailFile.docType === "folder" ? "目录" : "文件"}
              /> */}
              <SearchDetailRow label="大小" value={detailFile.size || "—"} />
              <SearchDetailRow
                label="路径"
                value={<span className="break-all font-mono text-xs">{detailFile.path || "—"}</span>}
              />
              <SearchDetailRow
                label="站点"
                value={
                  detailFile.siteName && detailFile.siteName !== detailFile.siteCode
                    ? `${detailFile.siteName} (${detailFile.siteCode})`
                    : detailFile.siteCode || "—"
                }
              />
              <SearchDetailRow label="设备" value={detailFile.deviceLabel || "—"} />
              {isHardDiskVolume(detailFile.volumeType) ? (
                <SearchDetailRow
                  label="硬盘序列号"
                  value={
                    <span className="break-all font-mono text-xs">
                      {detailFile.serialNum || "—"}
                    </span>
                  }
                />
              ) : (
                <>
                  <SearchDetailRow
                    label="盘笼 RFID"
                    value={
                      <span className="break-all font-mono text-xs">
                        {detailFile.magazineRfid || "—"}
                      </span>
                    }
                  />
                  <SearchDetailRow
                    label="盘位号"
                    value={
                      detailFile.slotOrder != null && Number.isFinite(detailFile.slotOrder)
                        ? String(detailFile.slotOrder)
                        : "—"
                    }
                  />
                  <SearchDetailRow
                    label="光盘面"
                    value={
                      detailFile.discSide == null || !Number.isFinite(detailFile.discSide)
                        ? "—"
                        : detailFile.discSide === 0
                          ? "A面 (0)"
                          : detailFile.discSide === 1
                            ? "B面 (1)"
                            : String(detailFile.discSide)
                    }
                  />
                </>
              )}
              <SearchDetailRow label="扩展名" value={detailFile.fileType || "—"} />
              <SearchDetailRow
                label="创建时间"
                value={formatBeijingTime(detailFile.createdAt) || "—"}
              />
              <SearchDetailRow
                label="校验码"
                value={
                  <span className="break-all font-mono text-xs">{detailFile.checksum || "—"}</span>
                }
              />
              {detailFile.contentType ? (
                <SearchDetailRow label="内容类型" value={detailFile.contentType} />
              ) : null}
              {detailFile.sourceTable ? (
                <SearchDetailRow
                  label="源表"
                  value={<span className="break-all font-mono text-xs">{detailFile.sourceTable}</span>}
                />
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDetailFile(null)}>
              关闭
            </Button>
            {detailFile ? (
              <Button
                type="button"
                onClick={() => {
                  handleRestore(detailFile)
                }}
                disabled={
                  !canInitiatePhysicalRestore(detailFile.volumeType, detailFile.relocated) ||
                  restoreSubmittingId === detailFile.id
                }
                title={
                  isHardDiskVolume(detailFile.volumeType)
                    ? "硬盘卷暂不支持从总控发起物理回迁"
                    : detailFile.relocated
                      ? RESTORE_RELOCATED_HINT
                      : undefined
                }
                data-testid="search-detail-restore"
              >
                {restoreSubmittingId === detailFile.id ? "提交中…" : "发起回迁"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(restoreConfirmFile)}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmFile(null)
        }}
      >
        <DialogContent data-testid="search-restore-confirm-dialog">
          <DialogHeader>
            <DialogTitle>已发起过回迁</DialogTitle>
            <DialogDescription>
              该文件在 5 分钟内已发起过回迁。是否再次发起？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreConfirmFile(null)}
              disabled={Boolean(restoreSubmittingId)}
              data-testid="search-restore-confirm-cancel"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (restoreConfirmFile) void submitRestore(restoreConfirmFile)
              }}
              disabled={Boolean(restoreSubmittingId)}
              data-testid="search-restore-confirm-retry"
            >
              {restoreSubmittingId && restoreConfirmFile?.id === restoreSubmittingId
                ? "提交中…"
                : "再次发起回迁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(restoreSuccess)}
        onOpenChange={(open) => {
          if (!open) setRestoreSuccess(null)
        }}
      >
        <DialogContent data-testid="search-restore-success-dialog">
          <DialogHeader>
            <DialogTitle>回迁记录已提交</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>
                  已提交到站点
                  {(() => {
                    const code = restoreSuccess?.winnerSiteCode || restoreSuccess?.file.siteCode
                    const name = restoreSuccess?.winnerSiteName || restoreSuccess?.file.siteName
                    if (!code) return ""
                    return name && name !== code ? ` ${name}（${code}）` : ` ${code}`
                  })()}
                  的回迁任务
                  {restoreSuccess?.winnerDeviceLabel
                    ? `，设备 ${restoreSuccess.winnerDeviceLabel}`
                    : ""}
                  。请在站点任务列表查看处理进度。
                </p>
                <p>
                  总控任务管理需等待站点同步后才会出现（约 5 分钟），请勿重复发起。
                </p>
                {restoreSuccess?.message ? (
                  <p className="text-xs text-slate-500">{restoreSuccess.message}</p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreSuccess(null)}
              data-testid="search-restore-success-close"
            >
              关闭
            </Button>
            <Button
              type="button"
              onClick={() => void handleJumpToSiteTaskList()}
              disabled={
                ssoJumping ||
                !(
                  restoreSuccess?.winnerSiteCode?.trim() ||
                  restoreSuccess?.file.siteCode?.trim()
                )
              }
              data-testid="search-restore-jump-site"
            >
              {ssoJumping ? "跳转中…" : "去站点查看"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(restoreFailDetail)}
        onOpenChange={(open) => {
          if (!open) setRestoreFailDetail(null)
        }}
      >
        <DialogContent data-testid="search-restore-fail-dialog">
          <DialogHeader>
            <DialogTitle>{restoreFailDetail?.title || "回迁记录未提交"}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>站点区域内各设备均未成功回迁文件，原因如下：</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
                  {(restoreFailDetail?.lines || []).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreFailDetail(null)}
              data-testid="search-restore-fail-close"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              导出列与列表一致：名称、路径、大小、站点、设备位置、扩展名、校验码、创建时间（中文表头，时间已格式化）。
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
    </div>
  )
}
