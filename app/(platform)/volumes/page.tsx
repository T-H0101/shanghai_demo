"use client"

/**
 * /volumes — 存储卷管理独立页面
 */

import { useRef, useState } from "react"
import { PageHeader } from "@/components/platform/page-header"
import { VolumesView } from "@/components/racks/volumes-view"
import { AppTooltip } from "@/components/shared/tooltip"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"

export default function VolumesPage() {
  const [listLoading, setListLoading] = useState(false)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  return (
    <div className="flex h-full flex-col overflow-hidden page-pad">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="存储卷管理"
            description="逻辑卷容量、类型与站点归属总览"
            badge="VOLUMES"
            actions={
              <div className="flex items-center gap-2">
                <AppTooltip content="重新拉取存储卷列表">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => void refreshRef.current?.()}
                    disabled={listLoading}
                    data-testid="volumes-refresh"
                  >
                    {listLoading ? (
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
        <VolumesView
          className="min-h-0 flex-1"
          refreshRef={refreshRef}
          onLoadingChange={setListLoading}
        />
      </div>
    </div>
  )
}
