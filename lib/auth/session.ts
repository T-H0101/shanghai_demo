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

export async function clearSession(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  })
}
