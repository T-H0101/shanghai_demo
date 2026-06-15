export interface TaskCreateNavigation {
  siteCode: string
  envKeyRef: string
  configured: boolean
  url: string | null
  reason: string | null
}

export function taskCreateUrlKey(siteCode: string): string {
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(siteCode)) {
    throw new Error("invalid siteCode")
  }
  return `SITE_NODE_TASK_CREATE_URL_${siteCode.toUpperCase()}`
}

export function resolveTaskCreateNavigation(
  siteCode: string,
  env: Readonly<Record<string, string | undefined>> = process.env
): TaskCreateNavigation {
  const normalizedSiteCode = siteCode.toUpperCase()
  const envKeyRef = taskCreateUrlKey(normalizedSiteCode)
  const raw = env[envKeyRef]?.trim()

  if (!raw) {
    return {
      siteCode: normalizedSiteCode,
      envKeyRef,
      configured: false,
      url: null,
      reason: "node_task_create_url_not_configured",
    }
  }

  const parsed = new URL(raw)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("task create URL must use http or https")
  }

  return {
    siteCode: normalizedSiteCode,
    envKeyRef,
    configured: true,
    url: parsed.toString(),
    reason: null,
  }
}
