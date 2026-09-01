"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getCachedSession, getSession } from "@/lib/auth/session"
import { Spinner } from "@/components/ui/spinner"
import {
  canAccessPath,
  firstAccessibleHref,
} from "@/lib/auth/menu-permissions"

interface RouteGuardProps {
  children: ReactNode
}

function pathAllowed(pathname: string): boolean {
  const cached = getCachedSession()
  if (cached === undefined || cached === null) return false
  return canAccessPath(cached.permissions ?? [], pathname)
}

export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter()
  const pathname = usePathname() ?? "/"
  // 有缓存且路径允许时直接放行，避免换页整屏 Spinner 卸掉侧栏
  const [allowed, setAllowed] = useState(() => pathAllowed(pathname))

  useEffect(() => {
    let cancelled = false

    // 路径变化时：若缓存已允许，保持界面；不要 setAllowed(false)
    if (pathAllowed(pathname)) {
      setAllowed(true)
    }

    getSession().then((session) => {
      if (cancelled) return
      if (!session) {
        setAllowed(false)
        router.replace("/login")
        return
      }
      const perms = session.permissions ?? []
      if (!canAccessPath(perms, pathname)) {
        const target = firstAccessibleHref(perms)
        const qs = typeof window !== "undefined" ? window.location.search : ""
        router.replace(`${target}${qs}`)
        return
      }
      setAllowed(true)
    })
    return () => {
      cancelled = true
    }
  }, [router, pathname])

  if (!allowed) {
    // 仅冷启动 / 无缓存时整屏等待；已登录换页不会走到这里（侧栏保持挂载）
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    )
  }

  return <>{children}</>
}
