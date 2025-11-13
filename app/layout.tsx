import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { StoreProvider } from '@/lib/store'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: '請求書管理システム | Invoice Management System',
  description: '受取側の請求書の回収・保管・支払システム',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <StoreProvider>
            {children}
            <Analytics />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
