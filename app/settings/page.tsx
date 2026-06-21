"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Database, KeyRound, RefreshCw, Server, ShieldAlert } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { CapsuleTabs, type CapsuleTabItem } from "@/components/platform/capsule-tabs"
import { PageHeader } from "@/components/platform/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SyncSiteConfig {
  siteCode: string
  siteName: string
  enabled: boolean
  intervalSeconds: number
  status: string
  credentialKeyRef: string | null
}

interface EnvKeyRef {
  key: string
  configured: boolean
}

interface SafeAuthConfig {
  mode: string
  issuerUrlConfigured: boolean
  clientIdConfigured: boolean
  clientSecretKeyRef: string
  jwksUrlConfigured: boolean
  ldapUrlConfigured: boolean
  ldapBaseDnConfigured: boolean
}

interface RegistrySite {
  id: string
  name: string
  code: string
  status: string
  deviceCount: number
  sourceSiteId?: string
  sourceTable?: string
  description?: string
}

interface SiteRuntimeStatus {
  siteCode: string
  siteName: string
  intervalSeconds: number
  schedulerStatus: string
  schedulerStartedAt: string | null
  packageStatus: string
  packageBatchId: string | null
  consistencyStatus: string
  matchedTableCount: number | null
  mismatchedTableCount: number | null
}

interface SettingsSnapshot {
  sites: SyncSiteConfig[]
  registrySites: RegistrySite[]
  registryDataSource: string
  registrySource: string
  siteStatuses: SiteRuntimeStatus[]
  envKeyRefs: EnvKeyRef[]
  auth: SafeAuthConfig
  systemStatus: string
  systemUptime: number | null
  databaseConnected: boolean
  databaseStatus: string
  databaseLatencyMs: number | null
  realityNote: string
}

const EMPTY_SNAPSHOT: SettingsSnapshot = {
  sites: [],
  registrySites: [],
  registryDataSource: "empty",
  registrySource: "none",
  siteStatuses: [],
  envKeyRefs: [],
  auth: {
    mode: "disabled",
    issuerUrlConfigured: false,
    clientIdConfigured: false,
    clientSecretKeyRef: "AUTH_CLIENT_SECRET",
    jwksUrlConfigured: false,
    ldapUrlConfigured: false,
    ldapBaseDnConfigured: false,
  },
  systemStatus: "unknown",
  systemUptime: null,
  databaseConnected: false,
  databaseStatus: "unknown",
  databaseLatencyMs: null,
  realityNote: "",
}

export default function Page() {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(EMPTY_SNAPSHOT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("overview")

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [syncRes, healthRes, dbHealthRes, sitesRes, siteStatusRes] = await Promise.all([
        fetch("/api/sync/config", { cache: "no-store" }),
        fetch("/api/system/health", { cache: "no-store" }),
        fetch("/api/system/db-health", { cache: "no-store" }),
        fetch("/api/sites", { cache: "no-store" }),
        fetch("/api/sync/sites/status", { cache: "no-store" }),
      ])
      const [sync, health, dbHealth, sites, siteStatus] = await Promise.all([
        syncRes.json(),
        healthRes.json(),
        dbHealthRes.json(),
        sitesRes.json(),
        siteStatusRes.json(),
      ])

      if (
        !syncRes.ok ||
        !healthRes.ok ||
        (!dbHealthRes.ok && dbHealthRes.status !== 503) ||
        !sitesRes.ok ||
        !siteStatusRes.ok
      ) {
        throw new Error("读取系统配置或健康状态失败")
      }

      setSnapshot({
        sites: sync.data?.sites ?? [],
        registrySites: sites.data ?? [],
        registryDataSource: sites.dataSource ?? "empty",
        registrySource: sites.source ?? "none",
        siteStatuses: siteStatus.data?.items ?? [],
        envKeyRefs: sync.data?.runtime?.envKeyRefs ?? [],
        auth: sync.data?.auth ?? EMPTY_SNAPSHOT.auth,
        systemStatus: health.status ?? "unknown",
        systemUptime: typeof health.uptime === "number" ? health.uptime : null,
        databaseConnected: Boolean(dbHealth.database?.connected),
        databaseStatus: dbHealth.database?.status ?? "unknown",
        databaseLatencyMs:
          typeof dbHealth.database?.latencyMs === "number" ? dbHealth.database.latencyMs : null,
        realityNote: sync.data?.reality?.note ?? "",
      })
    } catch (loadError) {
      setSnapshot(EMPTY_SNAPSHOT)
      setError(loadError instanceof Error ? loadError.message : "读取系统设置失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  // R.77: Enterprise UI 产品化 - 用 CapsuleTabs 切分 5 个分段
  // overview 概览, sites 站点, sync 同步, auth 认证, external 外部依赖
  const tabItems: CapsuleTabItem[] = useMemo(
    () => [
      {
        key: "overview",
        label: "概览",
        icon: <Database className="h-3.5 w-3.5" />,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-5 w-5" />
                  运行健康
                </CardTitle>
                <CardDescription>来源：实时 system health 与 database health API</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">应用服务</p>
                  <p className="mt-2 text-lg font-semibold">{snapshot.systemStatus}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    运行 {snapshot.systemUptime === null ? "—" : `${Math.floor(snapshot.systemUptime)} 秒`}
                  </p>
                </div>
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">中心数据库</p>
                  <p className="mt-2 text-lg font-semibold">{snapshot.databaseStatus}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {snapshot.databaseConnected ? "已连接" : "未连接"} · 延迟{" "}
                    {snapshot.databaseLatencyMs === null ? "—" : `${snapshot.databaseLatencyMs} ms`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5" />
                  未接入能力
                </CardTitle>
                <CardDescription>不使用 mock 或本地状态冒充配置完成</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <BlockedItem label="配置写入、重置、导出" status="not_implemented" />
                <BlockedItem label="邮件、Webhook 测试发送" status="not_implemented" />
                <BlockedItem label="JWT、RBAC、ADFS 安全策略" status="blocked_by_auth" />
                <BlockedItem label="真实告警阈值与任务策略" status="blocked_by_external_system" />
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        key: "sites",
        label: "站点",
        icon: <Server className="h-3.5 w-3.5" />,
        badge: snapshot.sites.length || undefined,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <Card className="gap-0" data-testid="settings-site-registry">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5" />
                  站点注册/派生来源
                </CardTitle>
                <CardDescription>
                  来源：{snapshot.registrySource}，dataSource={snapshot.registryDataSource}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  derived 仅表示从中心业务表发现站点编码，不等同于源端 `tbl_site` 真实注册。
                </div>
                {snapshot.registrySites.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无可验证的站点注册或派生记录。</p>
                ) : (
                  snapshot.registrySites.map((site) => (
                    <div key={site.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{site.name}</p>
                          <p className="font-mono text-xs text-slate-500">
                            {site.code} · sourceSiteId={site.sourceSiteId ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline">{site.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        设备 {site.deviceCount ?? 0} · sourceTable={site.sourceTable ?? "—"}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="gap-0" data-testid="settings-site-runtime">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5" />
                  中心调度配置
                </CardTitle>
                <CardDescription>来源：中心库 sync_sites，仅展示安全字段</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {snapshot.sites.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无可读取的站点同步配置。</p>
                ) : (
                  snapshot.sites.map((site) => (
                    <div key={site.siteCode} className="rounded-lg border bg-slate-50 p-3">
                      {(() => {
                        const runtime = snapshot.siteStatuses.find(
                          (item) => item.siteCode === site.siteCode
                        )
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{site.siteName}</p>
                                <p className="font-mono text-xs text-slate-500">{site.siteCode}</p>
                              </div>
                              <Badge variant={site.enabled ? "default" : "secondary"}>
                                {site.enabled ? site.status : "disabled"}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-slate-500">同步周期</p>
                                <p className="mt-1 font-medium">{site.intervalSeconds} 秒</p>
                              </div>
                              <div>
                                <p className="text-slate-500">凭据键引用</p>
                                <p className="mt-1 break-all font-mono font-medium">
                                  {site.credentialKeyRef ?? "未配置"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500">最近调度</p>
                                <p className="mt-1 font-medium">
                                  {runtime?.schedulerStatus ?? "not_run"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500">最近一致性</p>
                                <p className="mt-1 font-medium">
                                  {runtime?.consistencyStatus ?? "not_run"} ·{" "}
                                  {runtime?.matchedTableCount ?? "—"} /{" "}
                                  {runtime?.mismatchedTableCount ?? "—"}
                                </p>
                              </div>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))
                )}
                {snapshot.realityNote && (
                  <p className="text-xs text-amber-700">{snapshot.realityNote}</p>
                )}
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        key: "sync",
        label: "同步",
        icon: <RefreshCw className="h-3.5 w-3.5" />,
        badge: snapshot.envKeyRefs.length || undefined,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <Card className="gap-0" data-testid="settings-env-keys">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-5 w-5" />
                  运行时配置引用
                </CardTitle>
                <CardDescription>仅显示环境变量键名和是否配置，不返回 secret 值</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {snapshot.envKeyRefs.length === 0 && !loading ? (
                    <p className="text-sm text-slate-500">暂无环境变量键引用。</p>
                  ) : (
                    snapshot.envKeyRefs.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2"
                      >
                        <span className="break-all font-mono text-xs">{item.key}</span>
                        <Badge variant={item.configured ? "default" : "outline"}>
                          {item.configured ? "已配置" : "未配置"}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="h-5 w-5" />
                  同步策略 (只读)
                </CardTitle>
                <CardDescription>写配置接口为 not_implemented，UI 不会修改</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <WriteRow label="编辑同步周期" reason="not_implemented" />
                <WriteRow label="启用/禁用单站点" reason="not_implemented" />
                <WriteRow label="立即触发同步包" reason="not_implemented" />
                <WriteRow label="查看同步包原始数据" reason="blocked_by_external_system" />
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        key: "auth",
        label: "认证",
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <Card className="gap-0" data-testid="settings-auth-config">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5" />
                  Auth 配置边界
                </CardTitle>
                <CardDescription>
                  仅显示配置状态和 secret 键引用，不返回 URL、密码或 token
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
                  <span className="text-sm">当前模式</span>
                  <Badge variant="outline" className="font-mono">
                    {snapshot.auth.mode}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ConfigFlag label="OIDC issuer" configured={snapshot.auth.issuerUrlConfigured} />
                  <ConfigFlag label="OIDC client ID" configured={snapshot.auth.clientIdConfigured} />
                  <ConfigFlag label="JWKS" configured={snapshot.auth.jwksUrlConfigured} />
                  <ConfigFlag label="LDAP URL" configured={snapshot.auth.ldapUrlConfigured} />
                  <ConfigFlag label="LDAP base DN" configured={snapshot.auth.ldapBaseDnConfigured} />
                  <div className="rounded border bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">Client secret 键引用</p>
                    <p className="mt-1 break-all font-mono text-xs font-medium">
                      {snapshot.auth.clientSecretKeyRef}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-5 w-5" />
                  接入路线 (blocked_by_auth)
                </CardTitle>
                <CardDescription>
                  企业身份联邦与 RBAC 依赖站点 / 上游系统提供 metadata 与测试账号
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <BlockedItem label="ADFS / OIDC 联邦登录" status="blocked_by_auth" />
                <BlockedItem label="LDAP 账号同步" status="blocked_by_auth" />
                <BlockedItem label="RBAC 角色与权限矩阵" status="blocked_by_auth" />
                <BlockedItem label="本地 JWT 过期/续签策略" status="blocked_by_auth" />
              </CardContent>
            </Card>
          </div>
        ),
      },
      {
        key: "external",
        label: "外部依赖",
        icon: <Database className="h-3.5 w-3.5" />,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-5 w-5" />
                  搜索 / 索引
                </CardTitle>
                <CardDescription>来源：实时 system health API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <BlockedItem
                  label="ES / OpenSearch 索引"
                  status={snapshot.databaseConnected ? "configured" : "blocked_by_external_system"}
                />
                <BlockedItem
                  label="ClickHouse 检索聚合"
                  status={snapshot.databaseConnected ? "configured" : "blocked_by_external_system"}
                />
                <p className="text-xs text-slate-500">
                  配置基于真实 API 状态，不在 UI 中手填, 避免与后端不同步。
                </p>
              </CardContent>
            </Card>

            <Card className="gap-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-5 w-5" />
                  站点端 Agent
                </CardTitle>
                <CardDescription>来源：sync_sites.schedulerStatus</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {snapshot.siteStatuses.length === 0 ? (
                  <p className="text-xs text-slate-500">无站点调度器状态。</p>
                ) : (
                  snapshot.siteStatuses.map((item) => (
                    <div
                      key={item.siteCode}
                      className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="font-mono">{item.siteCode}</span>
                      <Badge variant="outline">{item.schedulerStatus}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ),
      },
    ],
    [snapshot, loading]
  )

  return (
    <AppShell>
      <PageHeader
        title="系统设置"
        description="查看同步策略、安全配置引用与运行健康状态"
        badge="READ ONLY"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void loadSettings()}
            disabled={loading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        }
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">当前页面只读</p>
            <p className="mt-1 text-xs">
              写配置接口为 not_implemented；JWT、RBAC、ADFS 与敏感安全策略为 blocked_by_auth。
              页面不会保存、导出或测试发送任何配置。
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <CapsuleTabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={tabItems}
        testId="settings-tabs"
      />
    </AppShell>
  )
}

function WriteRow({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {reason}
        </Badge>
        <Button variant="outline" size="sm" disabled className="h-7 px-2 text-[11px]">
          不可写
        </Button>
      </div>
    </div>
  )
}

function ConfigFlag({
  label,
  configured,
}: {
  label: string
  configured: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
      <span className="text-xs">{label}</span>
      <Badge variant={configured ? "default" : "outline"}>
        {configured ? "已配置" : "未配置"}
      </Badge>
    </div>
  )
}

function BlockedItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <Badge variant="outline" className="font-mono text-[10px]">
        {status}
      </Badge>
    </div>
  )
}
