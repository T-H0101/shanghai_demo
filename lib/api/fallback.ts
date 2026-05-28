/**
 * Mock Fallback 工具
 * API 请求失败时自动降级到 Mock 数据
 */

export interface FallbackOptions {
  context: string  // 调用上下文，用于日志
  silent?: boolean  // 是否静默降级（不打印 warn）
}

/**
 * API 请求失败时自动降级到 Mock
 * @param apiFn API 请求函数
 * @param mockFn Mock 数据函数
 * @param options 配置选项
 */
export async function withMockFallback<T>(
  apiFn: () => Promise<T>,
  mockFn: () => T | Promise<T>,
  options: FallbackOptions
): Promise<T> {
  const { context, silent = false } = options

  try {
    const result = await apiFn()
    return result
  } catch (error) {
    if (!silent) {
      console.warn(`[API Fallback] ${context} failed, using mock:`, error instanceof Error ? error.message : String(error))
    }

    try {
      const mockResult = await mockFn()
      return mockResult
    } catch (mockError) {
      // Mock 也失败，抛出异常
      console.error(`[API Fallback] Both API and mock failed for ${context}:`, mockError)
      throw new Error(`Failed to load ${context}: API failed, mock also failed`)
    }
  }
}

/**
 * 创建带 fallback 的 API 调用
 * @param url API URL
 * @param mockFn Mock 数据函数
 * @param context 调用上下文
 */
export async function fetchWithFallback<T>(
  url: string,
  mockFn: () => T | Promise<T>,
  context: string
): Promise<T> {
  return withMockFallback(
    async () => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      // 解包 ApiResponse
      if (json.code !== 0 && json.code !== undefined) {
        throw new Error(json.message || "API returned error")
      }
      return json.data
    },
    mockFn,
    { context }
  )
}

/**
 * 批量获取，带 fallback
 */
export async function batchFetchWithFallback<T>(
  requests: Array<{
    url: string
    mockFn: () => T | Promise<T>
    context: string
  }>
): Promise<T[]> {
  return Promise.all(
    requests.map(({ url, mockFn, context }) =>
      fetchWithFallback(url, mockFn, context)
    )
  )
}
