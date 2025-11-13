"use client"

import { ChevronLeft, Download, Send, Edit } from "lucide-react"

interface InvoiceDetailProps {
  onNavigate: (page: string) => void
}

export default function InvoiceDetail({ onNavigate }: InvoiceDetailProps) {
  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("invoices")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">請求書詳細</h1>
          <p className="text-muted-foreground">INV-2024-001</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Content */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-8">
          <div className="mb-8 pb-8 border-b border-border">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">請求書</h2>
                <p className="text-muted-foreground">INV-2024-001</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">発行日</p>
                <p className="font-semibold text-foreground">2024年6月15日</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-border">
            <div>
              <p className="text-sm text-muted-foreground mb-2">発行者</p>
              <div>
                <p className="font-semibold text-foreground">v0 Inc.</p>
                <p className="text-sm text-muted-foreground">東京都渋谷区</p>
                <p className="text-sm text-muted-foreground">info@v0.inc</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">請求先</p>
              <div>
                <p className="font-semibold text-foreground">株式会社A</p>
                <p className="text-sm text-muted-foreground">東京都中央区</p>
                <p className="text-sm text-muted-foreground">contact@company-a.jp</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-0 text-sm font-semibold text-foreground">品目</th>
                  <th className="text-right py-3 px-0 text-sm font-semibold text-foreground">数量</th>
                  <th className="text-right py-3 px-0 text-sm font-semibold text-foreground">単価</th>
                  <th className="text-right py-3 px-0 text-sm font-semibold text-foreground">合計</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-4 px-0 text-sm text-foreground">ウェブ開発サービス</td>
                  <td className="py-4 px-0 text-sm text-right text-foreground">50</td>
                  <td className="py-4 px-0 text-sm text-right text-foreground">¥2,500</td>
                  <td className="py-4 px-0 text-sm text-right font-semibold text-foreground">¥125,000</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-full max-w-xs">
              <div className="flex justify-between py-3 border-b border-border mb-3">
                <p className="text-muted-foreground">小計</p>
                <p className="font-semibold text-foreground">¥125,000</p>
              </div>
              <div className="flex justify-between py-3 border-b border-border mb-3">
                <p className="text-muted-foreground">消費税（10%）</p>
                <p className="font-semibold text-foreground">¥12,500</p>
              </div>
              <div className="flex justify-between py-3">
                <p className="text-lg font-bold text-foreground">請求額</p>
                <p className="text-lg font-bold text-primary">¥137,500</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">お支払い条件</p>
            <p className="font-semibold text-foreground">期限日: 2024年7月15日</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-2">ステータス</p>
            <div className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm mb-4">
              支払済み
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                <strong>支払日:</strong> 2024年6月20日
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              <Download size={18} />
              PDFダウンロード
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/5 transition-colors">
              <Send size={18} />
              メール送信
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors">
              <Edit size={18} />
              編集
            </button>
          </div>

          {/* Payment Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4 font-semibold">支払情報</p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">銀行振込先</p>
                <p className="font-semibold text-foreground">◯◯銀行 ◯◯支店</p>
              </div>
              <div>
                <p className="text-muted-foreground">口座番号</p>
                <p className="font-semibold text-foreground">1234567890</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
