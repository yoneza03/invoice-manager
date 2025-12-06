"use client"

import { useState } from "react"
import { ChevronLeft, Download, Trash2, Eye, Edit, Mail, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/api"
import { InvoiceStatus } from "@/lib/types"
import { downloadInvoicePDFJapanese } from "@/lib/pdf-generator-japanese"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InvoiceListEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
}

export default function InvoiceListEnhanced({ onNavigate }: InvoiceListEnhancedProps) {
  const { invoices, deleteInvoice, settings, updateInvoiceStatus } = useStore()
  const { toast } = useToast()
  const [filter, setFilter] = useState<string>("all")

  const filteredInvoices = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter)

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

  const handleSendEmail = (invoice: typeof invoices[0]) => {
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

  const handleDownloadPDF = (invoice: typeof invoices[0]) => {
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

  const handleStatusChange = (invoiceId: string, newStatus: InvoiceStatus, invoiceNumber: string) => {
    updateInvoiceStatus(invoiceId, newStatus)
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
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">顧客名</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">金額</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">ステータス</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">発行日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">期限日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">アクション</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
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
                        onClick={() => onNavigate("detail", invoice.id)}
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
        <p className="text-sm text-muted-foreground">全 {filteredInvoices.length} 件を表示</p>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium">
            前へ
          </button>
          <button className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors font-medium">
            次へ
          </button>
        </div>
      </div>
    </div>
  )
}