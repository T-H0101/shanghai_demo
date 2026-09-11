import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from '@/components/providers'
import { GlobalControlBall } from '@/components/ui/global-control-ball'
import { ThemeProvider } from '@/components/theme-provider'
import { PRODUCT_NAME } from '@/lib/branding'
import './globals.css'
import '@/styles/dark.css'

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_NAME,
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/brand/wuxi-apptec-logo.png',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/brand/wuxi-apptec-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Providers>{children}</Providers>
          <GlobalControlBall />
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}