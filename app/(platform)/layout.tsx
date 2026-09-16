"use client"

import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"

/**
 * 业务页共享壳：侧栏 / 顶栏 / RouteGuard 跨路由保持挂载，避免点菜单整页闪屏。
 * 各 page 自行控制 main 内边距与定高（不再包一层 AppShell）。
 */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <AppShell mainClassName="min-h-0 overflow-y-auto p-0">{children}</AppShell>
}
