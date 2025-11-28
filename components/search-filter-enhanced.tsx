"use client"

import { useState } from "react"
import { ChevronLeft, Search, Eye, Download } from "lucide-react"
import { useStore } from "@/lib/store"
import { SearchFilters, InvoiceStatus, InvoiceSource } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/api"
import { downloadInvoicePDFJapanese } from "@/lib/pdf-generator-japanese"

interface SearchFilterEnhancedProps {
  onNavigate: (page: string, invoiceId?: string) => void
}

export default function SearchFilterEnhanced({ onNavigate }: SearchFilterEnhancedProps) {
  const { invoices, settings } = useStore()
  const [filters, setFilters] = useState<SearchFilters>({})
  const [searchResults, setSearchResults] = useState(invoices)

  const handleSearch = () => {
    let results = invoices

    // キーワード検索
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase()
      results = results.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(keyword) ||
          inv.client.name.toLowerCase().includes(keyword) ||
          inv.client.email.toLowerCase().includes(keyword) ||
          inv.notes?.toLowerCase().includes(keyword)
      )
    }

    // ステータスフィルター
    if (filters.status && filters.status.length > 0) {
      results = results.filter((inv) => filters.status!.includes(inv.status))
    }

    // データソースフィルター
    if (filters.source) {
      results = results.filter((inv) => inv.source === filters.source)
    }

    // 金額範囲
    if (filters.minAmount !== undefined) {
      results = results.filter((inv) => inv.total >= filters.minAmount!)
    }
    if (filters.maxAmount !== undefined) {
      results = results.filter((inv) => inv.total <= filters.maxAmount!)
    }

    // 日付範囲
    if (filters.startDate) {
      results = results.filter((inv) => inv.issueDate >= filters.startDate!)
    }
    if (filters.endDate) {
      results = results.filter((inv) => inv.issueDate <= filters.endDate!)
    }

    setSearchResults(results)
  }

  const handleReset = () => {
    setFilters({})
    setSearchResults(invoices)
  }

  const toggleStatus = (status: InvoiceStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status]
    setFilters({ ...filters, status: newStatuses })
  }

  const getStatusBadgeClass = (status: InvoiceStatus) => {
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

  const getSourceText = (source?: InvoiceSource) => {
    switch (source) {
      case "pdf_import":
        return "PDFインポート"
      case "image_import":
        return "画像インポート"
      case "manual":
        return "手動作成"
      default:
        return "手動作成"
    }
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">検索・フィルター</h1>
          <p className="text-muted-foreground">請求書の詳細検索</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* フィルター */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">キーワード検索</label>
            <div className="relative">
              <Search className="absolute left-4 top-3 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="請求書IDまたは顧客名..."
                value={filters.keyword || ""}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                className="w-full pl-12 pr-4 py-3 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">ステータス</label>
              <div className="space-y-2">
                {(["paid", "unpaid", "overdue", "draft"] as InvoiceStatus[]).map((status) => (
                  <label key={status} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.status?.includes(status) || false}
                      onChange={() => toggleStatus(status)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-foreground">{getStatusText(status)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <label className="block text-sm font-medium text-foreground mb-3">データソース</label>
              <select
                value={filters.source || ""}
                onChange={(e) =>
                  setFilters({ ...filters, source: e.target.value as InvoiceSource | undefined })
                }
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">すべて</option>
                <option value="manual">手動作成</option>
                <option value="pdf_import">PDFインポート</option>
                <option value="image_import">画像インポート</option>
              </select>
            </div>

            <div className="border-t border-border pt-6">
              <label className="block text-sm font-medium text-foreground mb-3">金額範囲</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="最小額"
                  value={filters.minAmount || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, minAmount: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  placeholder="最大額"
                  value={filters.maxAmount || ""}
                  onChange={(e) =>
                    setFilters({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <label className="block text-sm font-medium text-foreground mb-3">期間</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={filters.startDate ? filters.startDate.toISOString().split("T")[0] : ""}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value ? new Date(e.target.value) : undefined })
                  }
                  className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="date"
                  value={filters.endDate ? filters.endDate.toISOString().split("T")[0] : ""}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value ? new Date(e.target.value) : undefined })
                  }
                  className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-border">
              <button
                onClick={handleSearch}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                検索
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
              >
                リセット
              </button>
            </div>
          </div>
        </div>

        {/* 検索結果 */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">検索結果</h2>
              <span className="text-sm text-muted-foreground">{searchResults.length}件</span>
            </div>

            <div className="space-y-3">
              {searchResults.map((invoice) => (
                <div
                  key={invoice.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-foreground">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">{invoice.client.name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">発行日</p>
                      <p className="text-foreground">{formatDate(invoice.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">金額</p>
                      <p className="text-foreground font-semibold">{formatCurrency(invoice.total)}</p>
                    </div>
                  </div>

                  {invoice.source && (
                    <div className="mb-3">
                      <span className="text-xs px-2 py-1 bg-muted rounded">
                        {getSourceText(invoice.source)}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => onNavigate("detail", invoice.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Eye size={16} />
                      <span className="text-sm">詳細</span>
                    </button>
                    <button
                      onClick={() => downloadInvoicePDFJapanese(invoice, settings.company)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <Download size={16} />
                      <span className="text-sm">PDF</span>
                    </button>
                  </div>
                </div>
              ))}

              {searchResults.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>検索条件に一致する請求書が見つかりませんでした</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}