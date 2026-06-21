/**
 * API Fallback 工具
 *
 * 设计目标: 显式失败, 不静默回退
 * - API 模式 (`NEXT_PUBLIC_API_MODE=api`) 下, fetch 失败时必须抛出 `ApiUnavailableError`
 * - Mock fallback 仅在显式传入 `mockFn` 时可用 (遗留调用方)
 * - 任何降级都通过 `console.error` 显著记录, 不再使用 console.warn 静默降级
 */

export interface FallbackOptions {
  context: string  // 调用上下文，用于日志
}

/**
 * 类型化的"API 不可用"错误
 *
 * 携带 `isApiUnavailable: true` 标记, UI 可据此渲染显式 blocked/error 状态
 * (`dataSource: "blocked"`), 而不是把 mock 数据当成真实数据展示。
 */
export class ApiUnavailableError extends Error {
  readonly isApiUnavailable = true
  readonly isMockFallback = false

  constructor(
    public readonly context: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`${context}: ${message}`)
    this.name = "ApiUnavailableError"
  }
}

interface MockFallbackSentinel {
  __mockFallback: true
  context: string
}

function createMockFallbackSentinel(context: string): MockFallbackSentinel {
  return { __mockFallback: true, context }
}

/**
 * 探测返回值是否为 mock fallback 标记
 */
export function isMockFallbackSentinel<T>(value: T): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __mockFallback?: unknown }).__mockFallback === true
  )
}

/**
 * 包装 API 请求, 失败时按 options 决定行为:
 * - 若传入 `mockFn`: 调用 mockFn 并显式记录 (console.error, 包含 context)
 * - 若未传入 `mockFn`: 抛出 `ApiUnavailableError` (fail closed)
 *
 * 永不静默回退。
 */
export async function withMockFallback<T>(
  apiFn: () => Promise<T>,
  mockFn: (() => T | Promise<T>) | undefined,
  options: FallbackOptions
): Promise<T> {
  const { context } = options

  try {
    return await apiFn()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)

    if (mockFn === undefined) {
      // API 模式: 显式失败, 不静默回退
      console.error(
        `[API Unavailable] ${context} failed (no mock fallback configured): ${reason}`
      )
      throw new ApiUnavailableError(context, reason, error)
    }

    // 显式传入 mockFn: 显式记录 + 调用 mockFn
    console.error(
      `[API Fallback] ${context} failed, falling back to mock: ${reason}`
    )
    try {
      return await mockFn()
    } catch (mockError) {
      const mockReason =
        mockError instanceof Error ? mockError.message : String(mockError)
      console.error(
        `[API Fallback] Both API and mock failed for ${context}: ${mockReason}`
      )
      throw new ApiUnavailableError(
        context,
        `API failed and mock also failed: ${mockReason}`,
        mockError
      )
    }
  }
}

/**
 * 创建带 fallback 的 API 调用
 *
 * `mockFn` 为可选参数: API 模式下若不传入, 失败时抛 `ApiUnavailableError`。
 */
export async function fetchWithFallback<T>(
  url: string,
  mockFn: (() => T | Promise<T>) | undefined,
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
      return json.data as T
    },
    mockFn,
    { context }
  )
}

/**
 * 批量获取，带 fallback
 *
 * 任一请求失败: 若未提供 mockFn, 抛 `ApiUnavailableError`; 否则显式记录并用 mock。
 */
export async function batchFetchWithFallback<T>(
  requests: Array<{
    url: string
    mockFn?: () => T | Promise<T>
    context: string
  }>
): Promise<T[]> {
  return Promise.all(
    requests.map(({ url, mockFn, context }) =>
      fetchWithFallback(url, mockFn, context)
    )
  )
}

// re-export sentinel factory for downstream typing (e.g. dataSource tagging)
export const _internal = { createMockFallbackSentinel }
