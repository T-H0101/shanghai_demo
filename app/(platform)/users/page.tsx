"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/platform/page-header"
import { AccountMappingPanel } from "@/components/users/account-mapping-panel"
import { AuthAccountsPanel } from "@/components/users/auth-accounts-panel"
import { BuiltinRolesPanel } from "@/components/users/builtin-roles-panel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type UsersTab = "accounts" | "roles" | "mappings"

export default function Page() {
  const [tab, setTab] = useState<UsersTab>("accounts")
  const [loading, setLoading] = useState(false)
  const refreshRef = useRef<(() => Promise<void>) | null>(null)

  const onRefresh = useCallback(() => {
    void refreshRef.current?.()
  }, [])

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        <div className="shrink-0">
          <PageHeader
            title="用户与权限"
            description="管理登录账号、角色权限与站点账号映射。"
            actions={
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onRefresh}
                disabled={loading}
                data-testid="users-page-refresh"
              >
                {loading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-4 w-4" />
                )}
                刷新
              </Button>
            }
          />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as UsersTab)}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
          <TabsList className="h-9 w-fit shrink-0">
            <TabsTrigger value="accounts" className="text-xs" data-testid="users-tab-accounts">
              账号
            </TabsTrigger>
            <TabsTrigger value="roles" className="text-xs" data-testid="users-tab-roles">
              角色权限
            </TabsTrigger>
            <TabsTrigger value="mappings" className="text-xs" data-testid="users-tab-mappings">
              站点账号映射
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
            <AuthAccountsPanel
              className="h-full"
              refreshRef={refreshRef}
              onLoadingChange={setLoading}
              active={tab === "accounts"}
            />
          </TabsContent>

          <TabsContent value="roles" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
            <BuiltinRolesPanel
              className="h-full"
              refreshRef={refreshRef}
              onLoadingChange={setLoading}
              active={tab === "roles"}
            />
          </TabsContent>

          <TabsContent value="mappings" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
            <AccountMappingPanel
              className="h-full"
              refreshRef={refreshRef}
              onLoadingChange={setLoading}
              active={tab === "mappings"}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
