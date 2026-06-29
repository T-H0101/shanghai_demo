/**
 * lib/mock-mode/racks-browse.ts
 * R.90 PR 前修复: 隔离 lib/mock/* 的访问入口.
 *
 * 设计:
 *   - API 模式: 返回 blocked DTO (UI 显示空 + blocker)
 *   - Mock 模式: lazy import lib/mock/racks, 返回 mock tree
 *
 * 调用方 (app/racks/page.tsx) 只 import 这里, **不** import "@/lib/mock/*".
 * audit:api-mode-no-fallback 通过此隔离层实现.
 */

import { isApiMode } from "@/lib/api"

export type RacksBrowseNode = {
  id: string
  name: string
  type: "file" | "folder"
  size?: number
  children?: RacksBrowseNode[]
}

export type RacksBrowseResult = {
  source: "mock" | "blocked_by_external_system"
  blocker?: string
  root?: RacksBrowseNode
  targetOptions?: string[]
}

/**
 * 加载浏览/恢复 mock tree. API 模式下返回 blocked.
 * R.90: API 模式不允许加载 mock 数据.
 */
export async function loadRacksBrowseMock(
  storageTab: "browse" | "restore" | string
): Promise<RacksBrowseResult> {
  if (isApiMode) {
    return {
      source: "blocked_by_external_system",
      blocker: "browse_not_wired_to_real_source",
    }
  }
  if (storageTab !== "browse" && storageTab !== "restore") {
    return { source: "mock" }
  }
  const mod = await import("@/lib/mock/racks")
  const files = mod.mockBackupFiles as any[]
  return {
    source: "mock",
    root: files[0],
  }
}

/**
 * 加载恢复模式下的目标路径选项. API 模式返回 blocked.
 */
export async function loadRacksRestoreTargetsMock(
  restoreMode: "server" | "local"
): Promise<RacksBrowseResult> {
  if (isApiMode) {
    return {
      source: "blocked_by_external_system",
      blocker: "restore_not_wired_to_real_source",
      targetOptions: [],
    }
  }
  const mod = await import("@/lib/mock/racks")
  const paths = (restoreMode === "server" ? mod.mockServerPaths : mod.mockLocalPaths) as any[]
  return {
    source: "mock",
    targetOptions: paths.map((p) => String(p.path ?? p)),
  }
}