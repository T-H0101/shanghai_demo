'use client'

import { Suspense } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { SiteProvider } from '@/lib/site/site-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <SiteProvider>{children}</SiteProvider>
      </Suspense>
      <Toaster />
    </>
  )
}
