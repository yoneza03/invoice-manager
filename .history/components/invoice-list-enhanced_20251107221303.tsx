"use client"

import { useState } from "react"
import { ChevronLeft, Download, Trash2, Eye } from "lucide-react"
import { useStore } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/api"
import { InvoiceStatus } from "@/lib/types"

interface InvoiceListEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
}

export default function InvoiceListEnhanced({ onNavigate }: InvoiceListEnhancedProps) {
  const { invoices, deleteInvoice } = useStore()
  const [filter, setFilter] = useState<string>("all")

  const filteredInvoices = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter)

  const handleDelete = (id: string, invoiceNumber: string) => {
    if (confirm(`請求書 ${invoiceNumber} を削除しますか?`)) {
      deleteInvoice(id)
    }
  }

  const getStatusText = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return "支払済み"
      case "pending":
        return "未払い"
      case "overdue":
        return "期限切れ"
      default:
        return "下書き"
    }
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
        {["all", "paid", "pending", "overdue"].map((status) => (
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
                : status === "pending"
                  ? "未払い"
                  : "期限切れ"}
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
                <tr key={invoice.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-6 text-sm font-medium text-foreground">{invoice.invoiceNumber}</td>
                  <td className="py-4 px-6 text-sm text-foreground">{invoice.client.name}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-foreground">{formatCurrency(invoice.total)}</td>
                  <td className="py-4 px-6 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        invoice.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : invoice.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {getStatusText(invoice.status)}
                    </span>
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
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="ダウンロード">
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