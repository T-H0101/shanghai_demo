"use client"

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
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (cancelled) return
      if (!authenticated) {
        router.replace("/login")
      } else {
        setChecked(true)
      }
    })
    return () => {
      cancelled = true
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
