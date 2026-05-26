/**
 * Mock Store - localStorage 持久化工具
 * 浏览器端安全，避免 SSR/构建时报错
 * 写入后派发自定义事件，让页面刷新数据
 */

export const MOCK_STORE_EVENT = "odlm:mock-store-updated"

const STORAGE_KEYS = {
  racks: "odlm:v1:racks",
  sites: "odlm:v1:sites",
  tasks: "odlm:v1:tasks",
  users: "odlm:v1:users",
  settings: "odlm:v1:settings",
} as const

export type StorageKey = keyof typeof STORAGE_KEYS

export function getStorageKey(key: StorageKey): string {
  return STORAGE_KEYS[key]
}

export function readMockStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return structuredClone(fallback)
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return structuredClone(fallback)
    return JSON.parse(raw) as T
  } catch {
    window.localStorage.removeItem(key)
    return structuredClone(fallback)
  }
}

export function writeMockStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(MOCK_STORE_EVENT, { detail: { key } }))
  } catch {
    // localStorage 满了或不可用，静默失败
  }
}

// 重置指定类型的 mock 数据
export function resetMockStore(key: StorageKey): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEYS[key])
  window.dispatchEvent(new CustomEvent(MOCK_STORE_EVENT, { detail: { key: STORAGE_KEYS[key] } }))
}

// 重置所有 mock 数据
export function resetAllMockStores(): void {
  if (typeof window === "undefined") return
  Object.values(STORAGE_KEYS).forEach(key => {
    window.localStorage.removeItem(key)
  })
  window.dispatchEvent(new CustomEvent(MOCK_STORE_EVENT, { detail: { key: "all" } }))
}