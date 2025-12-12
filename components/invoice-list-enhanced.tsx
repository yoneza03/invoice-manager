"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Download, Trash2, Eye, Edit, Mail, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate, markInvoiceAsViewed } from "@/lib/api"
import { InvoiceStatus, Invoice } from "@/lib/types"
import { downloadInvoicePDFJapanese } from "@/lib/pdf-generator-japanese"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

interface InvoiceListEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
}

export default function InvoiceListEnhanced({ onNavigate }: InvoiceListEnhancedProps) {
  const { invoices: localInvoices, deleteInvoice, settings, updateInvoiceStatus } = useStore()
  const { toast } = useToast()
  const [filter, setFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [mergedInvoices, setMergedInvoices] = useState<Invoice[]>(localInvoices)
  const itemsPerPage = 10

  // ★★★ Supabaseから請求書データを取得してLocalStorageとマージ ★★★
  useEffect(() => {
    const fetchAndMergeInvoices = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // ログインしていない場合はLocalStorageのみ使用
        setMergedInvoices(localInvoices)
        return
      }

      // Supabaseから請求書を取得
      const { data: supabaseInvoices, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[invoice-list] Supabase取得エラー:", error)
        setMergedInvoices(localInvoices)
        return
      }

      if (!supabaseInvoices || supabaseInvoices.length === 0) {
        setMergedInvoices(localInvoices)
        return
      }

      // SupabaseデータとLocalStorageデータをマージ
      const merged = localInvoices.map((localInv) => {
        const supabaseInv = supabaseInvoices.find((s: any) => s.id === localInv.id)

        if (supabaseInv) {
          // Supabaseのデータを優先してマージ
          return {
            ...localInv,
            // ★ Supabaseの値を優先（status, issuerInfo, issue_date等）
            status: supabaseInv.status as InvoiceStatus,
            issueDate: supabaseInv.issue_date ? new Date(supabaseInv.issue_date) : localInv.issueDate,
            dueDate: supabaseInv.due_date ? new Date(supabaseInv.due_date) : localInv.dueDate,
            paidDate: supabaseInv.paid_date ? new Date(supabaseInv.paid_date) : undefined,
            total: supabaseInv.amount ?? localInv.total,
            client: {
              ...localInv.client,
              name: supabaseInv.client_name ?? localInv.client.name,
            },
            issuerInfo: supabaseInv.issuer_name ? {
              name: supabaseInv.issuer_name,
              address: supabaseInv.issuer_address ?? undefined,
              phone: supabaseInv.issuer_tel ?? undefined,
              email: supabaseInv.issuer_email ?? undefined,
              registrationNumber: supabaseInv.issuer_registration_number ?? undefined,
            } : localInv.issuerInfo,
            paymentInfo: (supabaseInv.issuer_bank_name || supabaseInv.issuer_bank_branch || supabaseInv.issuer_bank_account) ? {
              bankName: supabaseInv.issuer_bank_name ?? undefined,
              branchName: supabaseInv.issuer_bank_branch ?? undefined,
              accountNumber: supabaseInv.issuer_bank_account ?? undefined,
            } : localInv.paymentInfo,
            // LocalStorageのlineItemsはそのまま保持
            lineItems: localInv.lineItems,
          }
        }

        return localInv
      })

      console.log("[invoice-list] マージ完了:", merged.length, "件")
      setMergedInvoices(merged)
    }

    fetchAndMergeInvoices()
  }, [localInvoices])

  const filteredInvoices = filter === "all" ? mergedInvoices : mergedInvoices.filter((inv) => inv.status === filter)
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex)

  const handleDelete = (id: string, invoiceNumber: string) => {
    if (confirm(`請求書 ${invoiceNumber} を削除しますか?`)) {
      deleteInvoice(id)
    }
  }

  const handleEdit = (id: string, isTampered?: boolean) => {
    if (isTampered) {
      toast({
        title: "編集不可",
        description: "改ざんが検知された請求書は編集できません",
        variant: "destructive",
      })
      return
    }
    onNavigate("invoice-edit", id)
  }

  const handleSendEmail = (invoice: Invoice) => {
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

  const handleDownloadPDF = (invoice: Invoice) => {
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

  const getStatusText = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return "支払済み"
      case "unpaid":
        return "未払い"
      case "overdue":
        return "期限切れ"
      default:
        return "下書き"
    }
  }

  const getStatusBadgeColor = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800"
      case "unpaid":
        return "bg-yellow-100 text-yellow-800"
      case "overdue":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus, invoiceNumber: string) => {
    // LocalStorageを更新
    updateInvoiceStatus(invoiceId, newStatus)

    // Supabaseも更新
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", invoiceId)

    if (error) {
      console.error("[invoice-list] ステータス更新エラー:", error)
      toast({
        title: "更新エラー",
        description: "Supabaseの更新に失敗しました",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "ステータス更新",
      description: `請求書 ${invoiceNumber} のステータスを ${getStatusText(newStatus)} に変更しました`,
    })
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">請求書一覧</h1>
          <p className="text-muted-foreground">全請求書の管理</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "paid", "unpaid", "overdue", "draft"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === status ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"
            }`}
          >
            {status === "all"
              ? "すべて"
              : status === "paid"
                ? "支払済み"
                : status === "unpaid"
                  ? "未払い"
                  : status === "overdue"
                    ? "期限切れ"
                    : "下書き"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">請求書ID</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">発行者</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">顧客名</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">金額</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">ステータス</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">発行日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">期限日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">アクション</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={`border-b border-border hover:bg-muted/50 transition-colors ${
                    invoice.isTampered ? "bg-red-50/50" : ""
                  }`}
                >
                  <td className="py-4 px-6 text-sm font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {invoice.invoiceNumber}
                      {invoice.isTampered && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-md">
                          <AlertTriangle size={12} />
                          改ざん検知
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-foreground">
                    {/* インポートデータの場合は発行者情報を表示、手動作成の場合は自社情報 */}
                    {(invoice.source === "pdf_import" || invoice.source === "image_import") && invoice.issuerInfo ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{invoice.issuerInfo.name}</span>
                        {invoice.issuerInfo.registrationNumber && (
                          <span className="text-xs text-muted-foreground">{invoice.issuerInfo.registrationNumber}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium">{settings.company.name}</span>
                        {settings.company.registrationNumber && (
                          <span className="text-xs text-muted-foreground">{settings.company.registrationNumber}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm text-foreground">{invoice.client.name}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-foreground">{formatCurrency(invoice.total)}</td>
                  <td className="py-4 px-6 text-sm">
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => handleStatusChange(invoice.id, value as InvoiceStatus, invoice.invoiceNumber)}
                    >
                      <SelectTrigger className={`w-[140px] ${getStatusBadgeColor(invoice.status)} border-0 font-semibold`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">下書き</SelectItem>
                        <SelectItem value="unpaid">未払い</SelectItem>
                        <SelectItem value="paid">支払済み</SelectItem>
                        <SelectItem value="overdue">期限切れ</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{formatDate(invoice.issueDate)}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{formatDate(invoice.dueDate)}</td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // 既読フラグを更新
                          markInvoiceAsViewed(invoice.id)
                          onNavigate("detail", invoice.id)
                        }}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="詳細表示"
                      >
                        <Eye size={18} className="text-primary" />
                      </button>
                      {!invoice.isReadonly && (
                        <>
                          <button
                            onClick={() => handleEdit(invoice.id, invoice.isTampered)}
                            className={`p-2 hover:bg-muted rounded-lg transition-colors ${
                              invoice.isTampered ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                            title={invoice.isTampered ? "改ざん検知のため編集不可" : "編集"}
                            disabled={invoice.isTampered}
                          >
                            <Edit size={18} className="text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleSendEmail(invoice)}
                            className={`p-2 rounded-lg transition-colors ${
                              invoice.isTampered
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-muted"
                            }`}
                            title={invoice.isTampered ? "改ざん検知のため送信不可" : "メール送信"}
                            disabled={invoice.isTampered}
                          >
                            <Mail size={18} className="text-green-600" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadPDF(invoice)
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          invoice.isTampered
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-muted"
                        }`}
                        title={invoice.isTampered ? "改ざん検知のためダウンロード不可" : "ダウンロード"}
                        disabled={invoice.isTampered}
                      >
                        <Download size={18} className="text-accent" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id, invoice.invoiceNumber)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="削除"
                      >
                        <Trash2 size={18} className="text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-6">
        <p className="text-sm text-muted-foreground">
          全 {filteredInvoices.length} 件中 {startIndex + 1}～{Math.min(endIndex, filteredInvoices.length)} 件を表示
        </p>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 border border-border rounded-lg font-medium transition-colors ${
              currentPage === 1
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-muted"
            }`}
          >
            前へ
          </button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 border border-border rounded-lg font-medium transition-colors ${
              currentPage === totalPages
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-muted"
            }`}
          >
            次へ
          </button>
        </div>
      </div>
    </div>
  )
}
