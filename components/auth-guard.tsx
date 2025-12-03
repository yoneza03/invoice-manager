"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useStore } from "@/lib/store"
import { Loader2 } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authState } = useStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // ログイン・登録ページは認証チェックをスキップ
    if (pathname === "/login" || pathname === "/register") {
      if (authState.isAuthenticated && !authState.loading) {
        router.push("/")
      }
      return
    }

    // 認証が必要なページでログインしていない場合はログインページにリダイレクト
    if (!authState.loading && !authState.isAuthenticated) {
      router.push("/login")
    }
  }, [authState.isAuthenticated, authState.loading, pathname, router])

  // ログイン・登録ページの場合はそのまま表示
  if (pathname === "/login" || pathname === "/register") {
    return <>{children}</>
  }

  // ローディング中
  if (authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未認証の場合は何も表示しない（リダイレクト中）
  if (!authState.isAuthenticated) {
    return null
  }

  // 認証済みの場合は子コンポーネントを表示
  return <>{children}</>
}