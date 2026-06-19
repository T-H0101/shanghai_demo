"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated } from "@/lib/auth/session"
import { Spinner } from "@/components/ui/spinner"

interface RouteGuardProps {
  children: ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    isAuthenticated().then((authenticated) => {
      if (cancelled) return
      if (!authenticated) {
        router.replace("/login")
        return
      }
      setAllowed(true)
    })
    return () => {
      cancelled = true
    }
  }, [router])

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    )
  }

  return <>{children}</>
}
