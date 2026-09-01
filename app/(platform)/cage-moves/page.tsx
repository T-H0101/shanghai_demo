"use client"

/**
 * /cage-moves — 盘笼移位登记与历史（requirements §4.3）
 */

import { useEffect, useRef, useState } from "react"
import { PageHeader } from "@/components/platform/page-header"
import { CageMoveHistoryView } from "@/components/racks/cage-move-view"
import { CageMoveDialog } from "@/components/racks/cage-move-dialog"
import { AppTooltip } from "@/components/shared/tooltip"
import { Button } from "@/components/ui/button"
import { isApiMode } from "@/lib/api"
import { ArrowLeftRight, Loader2, RefreshCw } from "lucide-react"

export default function CageMovesPage() {
  const [listLoading, setListLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)
  const [siteOptions, setSiteOptions] = useState<{ code: string; name: string }[]>([])

  useEffect(() => {
    if (!isApiMode()) return
    let cancelled = false
    fetch("/api/sites", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const rows = Array.isArray(json?.data) ? json.data : []
        setSiteOptions(
          rows.map((s: { code?: string; id?: string; name?: string }) => ({
            code: s.code ?? s.id ?? "",
            name: s.name ?? s.code ?? s.id ?? "",
          })).filter((s: { code: string }) => s.code),
        )
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="盘笼移位"
            description="登记盘笼跨站移位并查看登记记录"
            badge="CAGE MOVE"
            actions={
              <div className="flex items-center gap-2">
                <AppTooltip content="重新拉取移位登记列表">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => void refreshRef.current?.()}
                    disabled={listLoading}
                    data-testid="cage-moves-refresh"
                  >
                    {listLoading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    刷新
                  </Button>
                </AppTooltip>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => setShowRegister(true)}
                  data-testid="cage-moves-register-open"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  盘笼移位
                </Button>
              </div>
            }
          />
        </div>

        <CageMoveHistoryView
          className="min-h-0 flex-1"
          refreshToken={refreshToken}
          refreshRef={refreshRef}
          onLoadingChange={setListLoading}
        />
      </div>

      <CageMoveDialog
        open={showRegister}
        onOpenChange={setShowRegister}
        sites={siteOptions}
        onRegistered={() => {
          setRefreshToken((n) => n + 1)
        }}
      />
    </div>
  )
}
