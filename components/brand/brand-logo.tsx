import Image from "next/image"
import { cn } from "@/lib/utils"
import { BRAND_LOGO, BRAND_LOGO_ALT } from "@/lib/branding"

export type BrandLogoVariant = keyof typeof BRAND_LOGO

type BrandLogoProps = {
  variant?: BrandLogoVariant
  className?: string
  /** 默认 h-8；登录主视觉可用更大 */
  priority?: boolean
}

/**
 * 药明康德横版 Logo。深色底用 white，浅色底用 color（或 black）。
 */
export function BrandLogo({
  variant = "color",
  className,
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO[variant]}
      alt={BRAND_LOGO_ALT}
      width={368}
      height={81}
      priority={priority}
      className={cn("h-8 w-auto max-w-full object-contain object-left", className)}
    />
  )
}
