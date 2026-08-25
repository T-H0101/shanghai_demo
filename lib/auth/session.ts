import type { AuthSession } from "@/lib/types/auth"

export async function getSession(): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
    credentials: "include",
  })
  if (!response.ok) return null
  const payload = await response.json()
  return payload?.data?.user ?? null
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getSession())
}

export async function clearSession(): Promise<string | null> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  })
  const payload = await response.json().catch(() => null)
  const url = payload?.data?.adfsLogoutUrl
  return typeof url === "string" && url.length > 0 ? url : null
}
