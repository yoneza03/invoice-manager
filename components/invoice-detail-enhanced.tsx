"use client"

import { ChevronLeft, Download, Send, Edit } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/api"
import { downloadInvoicePDFJapanese } from "@/lib/pdf-generator-japanese"
import { Invoice } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface InvoiceDetailEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
  invoiceId: string | null
}

export default function InvoiceDetailEnhanced({ onNavigate, invoiceId }: InvoiceDetailEnhancedProps) {
  const { invoices, settings } = useStore()
  const { toast } = useToast()
  
  const invoice = invoiceId ? invoices.find((inv) => inv.id === invoiceId) : null
  
  // デバッグ用ログ
  console.log('Invoice IssuerInfo:', JSON.stringify(invoice?.issuerInfo, null, 2))

  if (!invoice) {
    return (
      <div className="p-8 lg:p-12">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => onNavigate("invoices")} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">請求書詳細</h1>
            <p className="text-muted-foreground">請求書が見つかりません</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">指定された請求書が存在しません</p>
          <button
            onClick={() => onNavigate("invoices")}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            請求書一覧に戻る
          </button>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      case "imported":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "paid":
        return "支払済み"
      case "pending":
        return "未払い"
      case "overdue":
        return "期限切れ"
      case "imported":
        return "インポート"
      default:
        return "下書き"
    }
  }

  // 元のPDFをダウンロードする関数
  const downloadOriginalPDF = (invoice: Invoice) => {
    const originalAttachmentId = invoice.originalPdfAttachmentId
    
    if (!originalAttachmentId) {
      alert("元のPDFファイルが見つかりません")
      return
    }
    
    const originalAttachment = invoice.attachments?.find(
      att => att.id === originalAttachmentId
    )
    
    if (!originalAttachment || !originalAttachment.base64Data) {
      alert("元のPDFファイルが見つかりません");
      return;
    }
    
    // Base64データをBlobに変換
    const byteString = atob(originalAttachment.base64Data.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i)
    }
    const blob = new Blob([ab], { type: originalAttachment.fileType })
    
    // ダウンロード
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = originalAttachment.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 編集ボタンのハンドラー
  const handleEdit = () => {
    onNavigate("invoice-edit", invoice.id)
  }

  // メール送信ボタンのハンドラー
  const handleSendEmail = () => {
    const email = invoice.client.email
    
    if (!email) {
      toast({
        title: "エラー",
        description: "請求先のメールアドレスが登録されていません",
        variant: "destructive",
      })
      return
    }

    const subject = encodeURIComponent(`請求書 ${invoice.invoiceNumber}`)
    const body = encodeURIComponent(
      `${invoice.client.name} 様\n\n` +
      `請求書 ${invoice.invoiceNumber} を送付いたします。\n\n` +
      `請求金額: ${formatCurrency(invoice.total)}\n` +
      `発行日: ${formatDate(invoice.issueDate)}\n` +
      `期限日: ${formatDate(invoice.dueDate)}\n\n` +
      `よろしくお願いいたします。`
    )
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
    
    toast({
      title: "メール送信",
      description: `${email} 宛にメールクライアントを開きました`,
    })
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("invoices")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">請求書詳細</h1>
          <p className="text-muted-foreground">{invoice.invoiceNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Content */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-8">
          <div className="mb-8 pb-8 border-b border-border">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">請求書</h2>
                <p className="text-muted-foreground">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">発行日</p>
                <p className="font-semibold text-foreground">{formatDate(invoice.issueDate)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-border">
            <div>
              <p className="text-sm text-muted-foreground mb-2">発行者</p>
              <div>
                {/* インポートデータの場合は抽出された発行者情報を表示 */}
                {(invoice.source === "pdf_import" || invoice.source === "image_import") && invoice.issuerInfo ? (
                  <>
                    <p className="font-semibold text-foreground">{invoice.issuerInfo.name}</p>
                    {invoice.issuerInfo.address && (
                      <p className="text-sm text-muted-foreground">{invoice.issuerInfo.address}</p>
                    )}
                    {invoice.issuerInfo.phone && (
                      <p className="text-sm text-muted-foreground">{invoice.issuerInfo.phone}</p>
                    )}
                    {invoice.issuerInfo.registrationNumber && (
                      <p className="text-sm text-muted-foreground mt-1">
                        登録番号: {invoice.issuerInfo.registrationNumber}
                      </p>
                    )}
                  </>
                ) : (
                  /* 手動作成データの場合はシステム設定の自社情報を表示 */
                  <>
                    <p className="font-semibold text-foreground">{settings.company.name}</p>
                    <p className="text-sm text-muted-foreground">{settings.company.address}</p>
                    <p className="text-sm text-muted-foreground">{settings.company.email}</p>
                    {settings.company.registrationNumber && (
                      <p className="text-sm text-muted-foreground mt-1">
                        登録番号: {settings.company.registrationNumber}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">請求先</p>
              <div>
                <p className="font-semibold text-foreground">{invoice.client.name}</p>
                <p className="text-sm text-muted-foreground">{invoice.client.address}</p>
                <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
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
                {invoice.lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-border">
                    <td className="py-4 px-0 text-sm text-foreground">{item.description}</td>
                    <td className="py-4 px-0 text-sm text-right text-foreground">{item.quantity}</td>
                    <td className="py-4 px-0 text-sm text-right text-foreground">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-4 px-0 text-sm text-right font-semibold text-foreground">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-full max-w-xs">
              <div className="flex justify-between py-3 border-b border-border mb-3">
                <p className="text-muted-foreground">小計</p>
                <p className="font-semibold text-foreground">{formatCurrency(invoice.subtotal)}</p>
              </div>
              <div className="flex justify-between py-3 border-b border-border mb-3">
                <p className="text-muted-foreground">消費税（{(invoice.taxRate > 1 ? invoice.taxRate : invoice.taxRate * 100).toFixed(0)}%）</p>
                <p className="font-semibold text-foreground">{formatCurrency(invoice.tax)}</p>
              </div>
              <div className="flex justify-between py-3">
                <p className="text-lg font-bold text-foreground">請求額</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(invoice.total)}</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">お支払い条件</p>
            <p className="font-semibold text-foreground">期限日: {formatDate(invoice.dueDate)}</p>
            {invoice.notes && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-1">備考</p>
                <p className="text-sm text-foreground">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-2">ステータス</p>
            <div className={`inline-block px-4 py-2 rounded-full font-semibold text-sm mb-4 ${getStatusBadge(invoice.status)}`}>
              {getStatusText(invoice.status)}
            </div>
            {invoice.paidDate && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>支払日:</strong> {formatDate(invoice.paidDate)}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {/* インポートデータの場合は元のPDFをダウンロード */}
            {(invoice.source === "pdf_import" || invoice.source === "image_import") ? (
              <button
                onClick={() => downloadOriginalPDF(invoice)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download size={18} />
                元のPDFダウンロード
              </button>
            ) : (
              <>
                {/* 手動作成データの場合は通常のボタンを表示 */}
                <button
                  onClick={() => downloadInvoicePDFJapanese(invoice, settings.company)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Download size={18} />
                  PDFダウンロード
                </button>
                <button
                  onClick={handleSendEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Send size={18} />
                  メール送信
                </button>
                <button
                  onClick={handleEdit}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
                >
                  <Edit size={18} />
                  編集
                </button>
              </>
            )}
          </div>

          {/* Payment Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-4 font-semibold">支払情報</p>
            
            {/* インポートデータの場合は元のPDFの支払先情報を表示 */}
            {(invoice.source === "pdf_import" || invoice.source === "image_import") && invoice.paymentInfo ? (
              <div className="space-y-3 text-sm">
                <div className="bg-blue-50 p-3 rounded mb-3">
                  <p className="text-xs text-blue-800">
                    ※ インポートされたPDFの支払先情報
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">銀行振込先</p>
                  <p className="font-semibold text-foreground">
                    {invoice.paymentInfo.bankName} {invoice.paymentInfo.branchName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">口座種別</p>
                  <p className="font-semibold text-foreground">{invoice.paymentInfo.accountType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">口座番号</p>
                  <p className="font-semibold text-foreground">{invoice.paymentInfo.accountNumber}</p>
                </div>
                {invoice.paymentInfo.accountHolder && (
                  <div>
                    <p className="text-muted-foreground">口座名義</p>
                    <p className="font-semibold text-foreground">{invoice.paymentInfo.accountHolder}</p>
                  </div>
                )}
              </div>
            ) : (
              /* 手動作成データの場合はシステム設定の自社情報を表示 */
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">銀行振込先</p>
                  <p className="font-semibold text-foreground">
                    {settings.company.bankName} {settings.company.branchName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">口座種別</p>
                  <p className="font-semibold text-foreground">{settings.company.accountType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">口座番号</p>
                  <p className="font-semibold text-foreground">{settings.company.accountNumber}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}