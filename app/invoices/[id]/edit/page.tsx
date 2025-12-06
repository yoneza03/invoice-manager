"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import InvoiceCreateEnhanced from "@/components/invoice-create-enhanced"
import { ChevronLeft, AlertTriangle } from "lucide-react"

export default function InvoiceEditPage() {
  const params = useParams()
  const router = useRouter()
  const { invoices, authState } = useStore()
  const [isLoading, setIsLoading] = useState(true)
  
  const invoiceId = params.id as string
  const invoice = invoices.find(inv => inv.id === invoiceId)

  useEffect(() => {
    // 認証チェック
    if (!authState.loading && !authState.isAuthenticated) {
      router.push("/login")
      return
    }
    
    if (!authState.loading) {
      setIsLoading(false)
    }
  }, [authState, router])

  // ローディング中
  if (isLoading || authState.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 認証されていない場合
  if (!authState.isAuthenticated) {
    return null
  }

  // 請求書が見つからない場合
  if (!invoice) {
    return (
      <div className="min-h-screen p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => router.push("/")} 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">請求書編集</h1>
              <p className="text-muted-foreground">請求書が見つかりません</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">
              指定された請求書（ID: {invoiceId}）が存在しません。
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 改ざん検知された請求書の場合
  if (invoice.isTampered) {
    return (
      <div className="min-h-screen p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => router.push("/")} 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">請求書編集</h1>
              <p className="text-muted-foreground">{invoice.invoiceNumber}</p>
            </div>
          </div>

          {/* 改ざん検知警告 */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <AlertTriangle size={32} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-900 mb-4">⚠️ データ改ざんを検知しました</h2>
                <p className="text-red-800 mb-4">
                  この請求書のデータが最後に保存された時点から不正に変更されている可能性があります。
                  データの整合性が保証されないため、編集操作は無効化されています。
                </p>
                <div className="bg-white border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-red-900 mb-2">検出内容:</h3>
                  <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                    <li>LocalStorageのデータが手動で変更された可能性があります</li>
                    <li>データのハッシュ値が一致しません</li>
                    <li>この請求書は閲覧のみ可能で、編集・更新はできません</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/invoices/${invoiceId}`)}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    詳細を表示
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="px-6 py-2 bg-white border border-red-300 text-red-900 font-semibold rounded-lg hover:bg-red-50 transition-colors"
                  >
                    ダッシュボードに戻る
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 読み取り専用の請求書の場合
  if (invoice.isReadonly) {
    return (
      <div className="min-h-screen p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => router.push("/")} 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">請求書編集</h1>
              <p className="text-muted-foreground">{invoice.invoiceNumber}</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <AlertTriangle size={32} className="text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-yellow-900 mb-2">編集不可</h2>
            <p className="text-yellow-800 mb-6">
              この請求書は読み取り専用のため編集できません。
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/invoices/${invoiceId}`)}
                className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                詳細を表示
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2 bg-white border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
              >
                ダッシュボードに戻る
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 通常の編集画面
  const handleNavigate = (page: string) => {
    if (page === "invoices") {
      router.push("/")
    } else if (page === "dashboard") {
      router.push("/")
    } else {
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen">
      <InvoiceCreateEnhanced 
        onNavigate={handleNavigate} 
        invoiceId={invoiceId} 
      />
    </div>
  )
}