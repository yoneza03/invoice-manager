"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Download, Send, Edit, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate, markInvoiceAsViewed } from "@/lib/api"
import { downloadInvoicePDFJapanese } from "@/lib/pdf-generator-japanese"
import { Invoice, InvoiceStatus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

interface InvoiceDetailEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
  invoiceId: string | null
}

export default function InvoiceDetailEnhanced({ onNavigate, invoiceId }: InvoiceDetailEnhancedProps) {
  const { invoices: localInvoices, settings } = useStore()
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  // ★★★ Supabaseから請求書データを取得してLocalStorageとマージ ★★★
  useEffect(() => {
    const fetchAndMergeInvoice = async () => {
      if (!invoiceId) {
        setInvoice(null)
        return
      }

      // LocalStorageから請求書を取得
      const localInv = localInvoices.find((inv) => inv.id === invoiceId)

      if (!localInv) {
        setInvoice(null)
        return
      }

      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // ログインしていない場合はLocalStorageのみ使用
        setInvoice(localInv)
        return
      }

      // Supabaseから請求書を取得
      const { data: supabaseInv, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("user_id", user.id)
        .single()

      if (error || !supabaseInv) {
        console.error("[invoice-detail] Supabase取得エラー:", error)
        setInvoice(localInv)
        return
      }

      // ★★★ LocalStorageとSupabaseをマージ（優先順位に基づく） ★★★
      const merged: Invoice = {
        ...localInv,
        // Supabaseの基本フィールドをマージ
        status: supabaseInv.status as InvoiceStatus,
        issueDate: supabaseInv.issue_date ? new Date(supabaseInv.issue_date) : localInv.issueDate,
        dueDate: supabaseInv.due_date ? new Date(supabaseInv.due_date) : localInv.dueDate,
        paidDate: supabaseInv.paid_date ? new Date(supabaseInv.paid_date) : localInv.paidDate,
        invoiceNumber: supabaseInv.invoice_number ?? localInv.invoiceNumber,
        total: supabaseInv.amount ?? localInv.total,
        // sourceの優先順位: LocalStorage → Supabase
        source: localInv.source ?? (supabaseInv.source as any),
        // client.nameのみSupabaseから更新（他のフィールドはLocalStorage優先）
        client: {
          ...localInv.client,
          name: supabaseInv.client_name ?? localInv.client.name,
        },
        // issuerInfoの優先順位: LocalStorage → Supabaseのissuer_*フィールドから構築
        issuerInfo: localInv.issuerInfo ?? (
          supabaseInv.issuer_name ? {
            name: supabaseInv.issuer_name,
            address: supabaseInv.issuer_address ?? undefined,
            phone: supabaseInv.issuer_tel ?? undefined,
            email: supabaseInv.issuer_email ?? undefined,
            registrationNumber: supabaseInv.issuer_registration_number ?? undefined,
          } : undefined
        ),
        // paymentInfoの優先順位: LocalStorage → Supabaseのissuer_bank_*フィールドから構築
        paymentInfo: localInv.paymentInfo ?? (
          supabaseInv.issuer_bank_name ? {
            bankName: supabaseInv.issuer_bank_name,
            branchName: supabaseInv.issuer_bank_branch ?? undefined,
            accountNumber: supabaseInv.issuer_bank_account ?? undefined,
          } : undefined
        ),
        // lineItems はLocalStorageを絶対優先（Supabaseで上書きしない）
      }

      console.log("[invoice-detail] LocalStorage優先マージ完了:", merged)
      console.log("[invoice-detail] IssuerInfo (LocalStorage優先):", merged.issuerInfo)
      console.log("[invoice-detail] LineItems (LocalStorage優先):", merged.lineItems)
      console.log("[invoice-detail] PaymentInfo (LocalStorage優先):", merged.paymentInfo)
      setInvoice(merged)
    }

    fetchAndMergeInvoice()
  }, [invoiceId, localInvoices])

  // デバッグ用ログ
  useEffect(() => {
    if (invoice) {
      console.log('Invoice IssuerInfo:', JSON.stringify(invoice.issuerInfo, null, 2))
      console.log('Invoice LineItems:', JSON.stringify(invoice.lineItems, null, 2))
      console.log('Invoice Status:', invoice.status)
    }
  }, [invoice])

  // 詳細画面を開いたタイミングで既読にする
  useEffect(() => {
    if (invoiceId) {
      markInvoiceAsViewed(invoiceId)
    }
  }, [invoiceId])

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
      case "unpaid":
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
      case "unpaid":
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
    if (invoice.isTampered) {
      toast({
        title: "編集不可",
        description: "改ざんが検知された請求書は編集できません",
        variant: "destructive",
      })
      return
    }
    onNavigate("invoice-edit", invoice.id)
  }

  // PDFダウンロードボタンのハンドラー
  const handleDownloadPDF = () => {
    if (invoice.isTampered) {
      toast({
        title: "ダウンロード不可",
        description: "改ざんが検知された請求書はダウンロードできません",
        variant: "destructive",
      })
      return
    }
    downloadInvoicePDFJapanese(invoice, settings.company)
  }

  // メール送信ボタンのハンドラー
  const handleSendEmail = () => {
    if (invoice.isTampered) {
      toast({
        title: "送信不可",
        description: "改ざんが検知された請求書は送信できません",
        variant: "destructive",
      })
      return
    }

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

      {/* 改ざん検知警告カード */}
      {invoice.isTampered && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-2">⚠️ データ改ざんを検知しました</h3>
              <p className="text-sm text-red-800 mb-3">
                この請求書のデータが最後に保存された時点から変更されている可能性があります。
                データの整合性が保証されないため、編集操作は無効化されています。
              </p>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>LocalStorageのデータが手動で変更された可能性があります</li>
                <li>この請求書は閲覧のみ可能で、編集・更新はできません</li>
                <li>データの信頼性を確保するため、元のデータを確認してください</li>
              </ul>
            </div>
          </div>
        </div>
      )}

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
                {/* 優先順位: 1. issuerInfo → 2. システム設定 */}
                {invoice.issuerInfo ? (
                  /* インポートデータまたはissuerInfoが存在する場合 */
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
                  /* 手動作成データまたはissuerInfoがない場合はシステム設定を表示 */
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
            {(invoice.source === "imported" || invoice.source === "pdf_import" || invoice.source === "image_import") ? (
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
                  onClick={handleDownloadPDF}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-lg transition-colors ${
                    invoice.isTampered
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  disabled={invoice.isTampered}
                  title={invoice.isTampered ? "改ざん検知のためダウンロード不可" : "PDFダウンロード"}
                >
                  <Download size={18} />
                  PDFダウンロード
                </button>
                <button
                  onClick={handleSendEmail}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border font-semibold rounded-lg transition-colors ${
                    invoice.isTampered
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border"
                      : "border-primary text-primary hover:bg-primary/5"
                  }`}
                  disabled={invoice.isTampered}
                  title={invoice.isTampered ? "改ざん検知のため送信不可" : "メール送信"}
                >
                  <Send size={18} />
                  メール送信
                </button>
                <button
                  onClick={handleEdit}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border border-border text-foreground font-semibold rounded-lg transition-colors ${
                    invoice.isTampered
                      ? "opacity-50 cursor-not-allowed bg-muted"
                      : "hover:bg-muted"
                  }`}
                  disabled={invoice.isTampered}
                  title={invoice.isTampered ? "改ざん検知のため編集不可" : "編集"}
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

            {/* 優先順位: 1. paymentInfo → 2. システム設定 */}
            {invoice.paymentInfo ? (
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
