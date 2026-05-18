"use client"

/**
 * Mock Enterprise Authentication Demo — Route Guard
 *
 * 未登录用户访问非登录页面时，自动跳转 /login
 * 已登录用户访问 /login 时，自动跳转首页
 *
 * 不实现复杂权限控制（按钮级/菜单级裁剪）
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth/session"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const isAuth = isAuthenticated()
    if (!isAuth) {
      router.replace("/login")
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">验证中...</div>
      </div>
    )
  }

  return <>{children}</>
}