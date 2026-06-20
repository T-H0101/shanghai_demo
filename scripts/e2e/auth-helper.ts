export async function installAuthenticatedFetch(baseUrl: string) {
  const originalFetch = globalThis.fetch
  const loginRes = await originalFetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin", siteCode: "SH01" }),
  })
  const cookie = loginRes.headers.get("set-cookie")?.match(/odp_session=([^;]+)/)?.[1]
  if (!loginRes.ok || !cookie) {
    throw new Error(`e2e auth login failed: HTTP ${loginRes.status}`)
  }

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (!url.startsWith(baseUrl)) return originalFetch(input, init)

    const headers = new Headers(init?.headers)
    if (!headers.has("cookie")) {
      headers.set("cookie", `odp_session=${cookie}`)
    }
    return originalFetch(input, { ...init, headers })
  }) as typeof fetch

  return cookie
}
