"use client"

import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/platform/page-header"
import { AccountMappingPanel } from "@/components/users/account-mapping-panel"
import { AuthAccountsPanel } from "@/components/users/auth-accounts-panel"
// 站点同步 RBAC / 字典 / 日志视图：总控无需查看，暂注释
// import { RolePermissionsTab } from "@/components/rbac/role-permissions-tab"
// import { DictionariesTab } from "@/components/rbac/dictionaries-tab"
// import { LogsCredentialsTab } from "@/components/rbac/logs-credentials-tab"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Page() {
  return (
    <AppShell>
      <PageHeader
        title="用户与权限"
        description="管理登录账号，并设置进入各站点时使用的用户名。"
      />

      {/*
        原 Tabs：统一用户视图 / 角色权限 / 基础配置 / 权限日志（站点同步只读）
        总控无需查看各站点用户角色，仅保留 Auth 账号管理。恢复时取消下方注释并还原 import。

      <Tabs defaultValue="auth">
        <TabsList className="h-9">
          <TabsTrigger value="unified" className="text-xs">统一用户视图</TabsTrigger>
          <TabsTrigger value="auth" className="text-xs">Auth 账号管理</TabsTrigger>
          <TabsTrigger value="rbac" className="text-xs">角色权限</TabsTrigger>
          <TabsTrigger value="dict" className="text-xs">基础配置</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">权限日志</TabsTrigger>
        </TabsList>
        <TabsContent value="rbac" className="mt-4"><RolePermissionsTab /></TabsContent>
        <TabsContent value="dict" className="mt-4"><DictionariesTab /></TabsContent>
        <TabsContent value="logs" className="mt-4"><LogsCredentialsTab /></TabsContent>
      </Tabs>
      */}

      <AuthAccountsPanel />
      <AccountMappingPanel />
    </AppShell>
  )
}
