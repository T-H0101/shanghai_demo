import type { AuthSession } from "@/lib/types/auth"

/** 客户端会话缓存：避免换页时 RouteGuard / 侧栏反复整页转圈 */
let cachedSession: AuthSession | null | undefined
let cachedAt = 0
let inflight: Promise<AuthSession | null> | null = null

const CACHE_TTL_MS = 30_000

/** 同步读取缓存（undefined = 尚未拉过） */
export function getCachedSession(): AuthSession | null | undefined {
  return cachedSession
}

export function invalidateSessionCache(): void {
  cachedSession = undefined
  cachedAt = 0
  inflight = null
}

export async function getSession(options?: { force?: boolean }): Promise<AuthSession | null> {
  const force = options?.force === true
  if (
    !force &&
    cachedSession !== undefined &&
    Date.now() - cachedAt < CACHE_TTL_MS
  ) {
    return cachedSession
  }
  if (!force && inflight) return inflight

  inflight = (async () => {
    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      })
      if (!response.ok) {
        cachedSession = null
        cachedAt = Date.now()
        return null
      }
      const payload = await response.json()
      const user = (payload?.data?.user ?? null) as AuthSession | null
      cachedSession = user
      cachedAt = Date.now()
      return user
    } finally {
      inflight = null
    }
  })()

  return inflight
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getSession())
}

export async function clearSession(): Promise<string | null> {
  invalidateSessionCache()
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  })
  const payload = await response.json().catch(() => null)
  const url = payload?.data?.adfsLogoutUrl
  return typeof url === "string" && url.length > 0 ? url : null
}
