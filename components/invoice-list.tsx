"use client"

import { useState } from "react"
import { ChevronLeft, Download, Trash2, Eye } from "lucide-react"

interface InvoiceListProps {
  onNavigate: (page: string) => void
}

const invoices = [
  {
    id: "INV-2024-001",
    client: "株式会社A",
    amount: "¥125,000",
    status: "paid",
    date: "2024-06-15",
    dueDate: "2024-07-15",
  },
  {
    id: "INV-2024-002",
    client: "株式会社B",
    amount: "¥89,500",
    status: "pending",
    date: "2024-06-14",
    dueDate: "2024-07-14",
  },
  {
    id: "INV-2024-003",
    client: "株式会社C",
    amount: "¥156,200",
    status: "overdue",
    date: "2024-06-10",
    dueDate: "2024-06-24",
  },
  {
    id: "INV-2024-004",
    client: "株式会社D",
    amount: "¥73,800",
    status: "paid",
    date: "2024-06-12",
    dueDate: "2024-07-12",
  },
  {
    id: "INV-2024-005",
    client: "株式会社E",
    amount: "¥234,500",
    status: "pending",
    date: "2024-06-13",
    dueDate: "2024-07-13",
  },
  {
    id: "INV-2024-006",
    client: "株式会社F",
    amount: "¥98,000",
    status: "paid",
    date: "2024-06-11",
    dueDate: "2024-07-11",
  },
]

export default function InvoiceList({ onNavigate }: InvoiceListProps) {
  const [filter, setFilter] = useState("all")

  const filteredInvoices = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter)

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
                  <td className="py-4 px-6 text-sm font-medium text-foreground">{invoice.id}</td>
                  <td className="py-4 px-6 text-sm text-foreground">{invoice.client}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-foreground">{invoice.amount}</td>
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
                      {invoice.status === "paid" ? "支払済み" : invoice.status === "pending" ? "未払い" : "期限切れ"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{invoice.date}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{invoice.dueDate}</td>
                  <td className="py-4 px-6 text-sm">
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="詳細表示">
                        <Eye size={18} className="text-primary" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="ダウンロード">
                        <Download size={18} className="text-accent" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="削除">
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
