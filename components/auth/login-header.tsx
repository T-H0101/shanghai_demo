"use client"

import { BrandLogo } from "@/components/brand/brand-logo"
import { PRODUCT_NAME } from "@/lib/branding"

export function LoginHeader() {
  return (
    <header
      className="relative z-10 flex items-center gap-3 px-6 py-4 lg:px-12"
      data-testid="login-header"
    >
      <BrandLogo variant="color" className="h-8 w-auto max-w-[160px] dark:hidden" priority />
      <BrandLogo variant="white" className="hidden h-8 w-auto max-w-[160px] dark:block" priority />
      <span className="hidden whitespace-nowrap text-sm font-semibold tracking-wide text-slate-900 sm:inline dark:text-slate-100">
        {PRODUCT_NAME}
      </span>
    </header>
  )
}
