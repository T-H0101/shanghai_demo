"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Database, KeyRound, RefreshCw, Server, ShieldAlert } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { CapsuleTabs, type CapsuleTabItem } from "@/components/platform/capsule-tabs"
import { GlassPanel } from "@/components/platform/glass-panel"
import { PageHeader } from "@/components/platform/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
            <GlassPanel
              data-testid="settings-overview-health"
              title={
                <>
                  <Database className="mr-1 inline h-4 w-4" />
                  运行健康
                </>
              }
              description="实时展示平台服务与数据连接状态"
              shine
              intensity="default"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">应用服务</p>
                  <p className="mt-2 text-lg font-semibold">{snapshot.systemStatus}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    运行 {snapshot.systemUptime === null ? "—" : `${Math.floor(snapshot.systemUptime)} 秒`}
                  </p>
                </div>
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">中心数据库</p>
                  <p className="mt-2 text-lg font-semibold">{snapshot.databaseStatus}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {snapshot.databaseConnected ? "已连接" : "未连接"} · 延迟{" "}
                    {snapshot.databaseLatencyMs === null ? "—" : `${snapshot.databaseLatencyMs} ms`}
                  </p>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-overview-blocked"
              title={
                <>
                  <ShieldAlert className="mr-1 inline h-4 w-4" />
                  未接入能力
                </>
              }
              description="未启用能力保持明确标记，不展示为已完成"
              shine
              intensity="default"
            >
              <div className="space-y-2 text-sm">
                <BlockedItem label="配置写入、重置、导出" status="not_implemented" />
                <BlockedItem label="邮件、Webhook 测试发送" status="not_implemented" />
                <BlockedItem label="企业认证与权限策略" status="blocked_by_auth" />
                <BlockedItem label="告警阈值与任务策略" status="blocked_by_external_system" />
              </div>
            </GlassPanel>
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
            <GlassPanel
              data-testid="settings-site-registry"
              title={
                <>
                  <Server className="mr-1 inline h-4 w-4" />
                  站点注册状态
                </>
              }
              description={snapshot.registryDataSource === "database" ? "站点来自注册配置" : "站点来自已同步业务记录"}
              shine
              intensity="default"
            >
              <div className="space-y-3">
                <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  自动发现的站点可用于查看与筛选；正式纳管仍需补齐站点注册配置。
                </div>
                {snapshot.registrySites.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无可验证的站点注册或派生记录。</p>
                ) : (
                  snapshot.registrySites.map((site) => (
                    <div key={site.id} className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{site.name}</p>
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{site.code}</p>
                        </div>
                        <Badge variant="outline">{site.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        设备 {site.deviceCount ?? 0}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-site-runtime"
              title={
                <>
                  <Server className="mr-1 inline h-4 w-4" />
                  中心调度配置
                </>
              }
              description="展示每个站点的同步周期与最近运行状态"
              shine
              intensity="default"
            >
              <div className="space-y-3">
                {snapshot.sites.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无可读取的站点同步配置。</p>
                ) : (
                  snapshot.sites.map((site) => (
                    <div key={site.siteCode} className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-3">
                      {(() => {
                        const runtime = snapshot.siteStatuses.find(
                          (item) => item.siteCode === site.siteCode
                        )
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{site.siteName}</p>
                                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{site.siteCode}</p>
                              </div>
                              <Badge variant={site.enabled ? "default" : "secondary"}>
                                {site.enabled ? displayStatus(site.status) : "已停用"}
                              </Badge>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">同步周期</p>
                                <p className="mt-1 font-medium">{site.intervalSeconds} 秒</p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">凭据引用</p>
                                <p className="mt-1 break-all font-mono font-medium">
                                  {site.credentialKeyRef ?? "未配置"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">最近调度</p>
                                <p className="mt-1 font-medium">
                                  {displayStatus(runtime?.schedulerStatus ?? "not_run")}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 dark:text-slate-400">最近一致性</p>
                                <p className="mt-1 font-medium">
                                  {displayStatus(runtime?.consistencyStatus ?? "not_run")} ·{" "}
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
                  <p className="text-xs text-amber-700 dark:text-amber-300">{snapshot.realityNote}</p>
                )}
              </div>
            </GlassPanel>
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
            <GlassPanel
              data-testid="settings-env-keys"
              title={
                <>
                  <KeyRound className="mr-1 inline h-4 w-4" />
                  运行时配置引用
                </>
              }
              description="仅显示配置引用和是否已配置，不展示敏感值"
              shine
              intensity="default"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {snapshot.envKeyRefs.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无配置引用。</p>
                ) : (
                  snapshot.envKeyRefs.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                    >
                      <span className="break-all font-mono text-xs">{item.key}</span>
                      <Badge variant={item.configured ? "default" : "outline"}>
                        {item.configured ? "已配置" : "未配置"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-sync-config"
              title={
                <>
                  <RefreshCw className="mr-1 inline h-4 w-4" />
                  同步配置 (只读)
                </>
              }
              description="展示站点同步周期、凭据引用和只读运行配置"
              shine
              intensity="default"
            >
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  当前默认调度：每{" "}
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">60</span>{" "}
                  分钟执行一次站点同步；个别站点可使用独立周期。
                </p>
                {snapshot.sites.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500">暂无可读取的同步配置。</p>
                ) : (
                  snapshot.sites.map((site) => (
                    <div
                      key={site.siteCode}
                      className="rounded-lg border bg-slate-50 dark:bg-slate-800/40 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{site.siteName}</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{site.siteCode}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">凭据引用</p>
                          <p className="mt-1 font-mono">
                            {site.credentialKeyRef ?? "未配置"}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">周期</p>
                          <p className="mt-1 font-mono">{site.intervalSeconds} 秒</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-scheduler-config"
              title={
                <>
                  <RefreshCw className="mr-1 inline h-4 w-4" />
                  调度配置
                </>
              }
              description="默认每 60 分钟执行一次站点同步"
              shine
              intensity="default"
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                  <span>默认调度周期</span>
                  <Badge variant="outline" className="font-mono">
                    60 分钟
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                  <span>配置来源</span>
                  <Badge variant="outline" className="font-mono">
                    平台配置
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                  <span>调度进程</span>
                  <Badge variant="outline" className="font-mono">
                    独立运行
                  </Badge>
                </div>
                <WriteRow label="调整默认周期" reason="not_implemented" />
                <WriteRow label="覆盖单站点周期" reason="not_implemented" />
              </div>
            </GlassPanel>
          </div>
        ),
      },
      {
        key: "auth",
        label: "认证",
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <GlassPanel
              data-testid="settings-auth-config"
              title={
                <>
                  <ShieldAlert className="mr-1 inline h-4 w-4" />
                  认证配置边界
                </>
              }
              description="仅显示配置状态和安全引用，不展示 URL、密码或 token"
              shine
              intensity="default"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                  <span className="text-sm">当前模式</span>
                  <Badge variant="outline" className="font-mono">
                    {snapshot.auth.mode}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <ConfigFlag label="单点登录服务" configured={snapshot.auth.issuerUrlConfigured} />
                  <ConfigFlag label="客户端标识" configured={snapshot.auth.clientIdConfigured} />
                  <ConfigFlag label="公钥配置" configured={snapshot.auth.jwksUrlConfigured} />
                  <ConfigFlag label="目录服务地址" configured={snapshot.auth.ldapUrlConfigured} />
                  <ConfigFlag label="目录同步范围" configured={snapshot.auth.ldapBaseDnConfigured} />
                  <div className="rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">客户端密钥引用</p>
                    <p className="mt-1 break-all font-mono text-xs font-medium">
                      {snapshot.auth.clientSecretKeyRef}
                    </p>
                  </div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-auth-boundary"
              title={
                <>
                  <ShieldAlert className="mr-1 inline h-4 w-4" />
                  认证边界
                </>
              }
              description="本地登录已启用；企业单点登录当前未启用"
              shine
              intensity="default"
            >
              <div className="space-y-2 text-sm">
                <BlockedItem label="本地登录已启用" status="enabled" />
                <BlockedItem label="ADFS / OIDC 联邦登录" status="blocked_by_auth" />
                <BlockedItem label="LDAP 账号同步" status="blocked_by_auth" />
                <BlockedItem label="角色与权限矩阵" status="blocked_by_auth" />
                <BlockedItem label="登录续签策略" status="blocked_by_auth" />
              </div>
            </GlassPanel>
          </div>
        ),
      },
      {
        key: "external",
        label: "外部依赖",
        icon: <Database className="h-3.5 w-3.5" />,
        content: (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
            <GlassPanel
              data-testid="settings-external-boundary"
              title={
                <>
                  <Database className="mr-1 inline h-4 w-4" />
                  外部存储边界
                </>
              }
              description="高吞吐检索与日志分析服务按接入状态展示"
              shine
              intensity="default"
            >
              <div className="space-y-2 text-sm">
                <BlockedItem
                  label="全文检索索引"
                  status={snapshot.databaseConnected ? "configured" : "blocked_by_external_system"}
                />
                <BlockedItem
                  label="日志分析服务"
                  status={snapshot.databaseConnected ? "configured" : "blocked_by_external_system"}
                />
                <BlockedItem
                  label="邮件 / Webhook 投递"
                  status="blocked_by_external_system"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  配置由运行环境统一管理，页面仅展示状态，不直接填写敏感连接信息。
                </p>
              </div>
            </GlassPanel>

            <GlassPanel
              data-testid="settings-external-agent"
              title={
                <>
                  <Server className="mr-1 inline h-4 w-4" />
                  站点端代理
                </>
              }
              description="展示站点同步代理的最近运行状态"
              shine
              intensity="default"
            >
              <div className="space-y-2 text-sm">
                {snapshot.siteStatuses.length === 0 ? (
                  <p className="text-xs text-slate-500">无站点调度器状态。</p>
                ) : (
                  snapshot.siteStatuses.map((item) => (
                    <div
                      key={item.siteCode}
                      className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs"
                    >
                      <span className="font-mono">{item.siteCode}</span>
                      <Badge variant="outline">{displayStatus(item.schedulerStatus)}</Badge>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>
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

      <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">当前页面只读</p>
            <p className="mt-1 text-xs">
              写入配置、企业认证和敏感安全策略尚未解锁。页面不会保存、导出或测试发送任何配置。
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
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
    <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {reason === "not_implemented" ? "未启用" : reason}
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
    <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
      <span className="text-xs">{label}</span>
      <Badge variant={configured ? "default" : "outline"}>
        {configured ? "已配置" : "未配置"}
      </Badge>
    </div>
  )
}

function BlockedItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded border bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
      <span>{label}</span>
      <Badge variant="outline" className="font-mono text-[10px]">
        {displayStatus(status)}
      </Badge>
    </div>
  )
}

function displayStatus(status: string): string {
  const map: Record<string, string> = {
    enabled: "已启用",
    configured: "已配置",
    disabled: "已停用",
    not_implemented: "未启用",
    blocked_by_auth: "待认证服务",
    blocked_by_external_system: "待外部服务",
    blocked_by_source_schema: "待站点字段",
    blocked_by_site_change: "待站点配合",
    not_run: "未运行",
    success: "成功",
    failed: "失败",
    running: "运行中",
    pending: "等待中",
  }
  return map[status] ?? status
}
