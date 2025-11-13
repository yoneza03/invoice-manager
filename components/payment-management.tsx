"use client"

import { ChevronLeft, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface PaymentManagementProps {
  onNavigate: (page: string) => void
}

const payments = [
  {
    id: 1,
    invoiceId: "INV-2024-001",
    amount: "¥125,000",
    status: "paid",
    dueDate: "2024-07-15",
    paidDate: "2024-06-20",
  },
  { id: 2, invoiceId: "INV-2024-002", amount: "¥89,500", status: "pending", dueDate: "2024-07-14", paidDate: null },
  { id: 3, invoiceId: "INV-2024-003", amount: "¥156,200", status: "overdue", dueDate: "2024-06-24", paidDate: null },
]

export default function PaymentManagement({ onNavigate }: PaymentManagementProps) {
  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">支払管理</h1>
          <p className="text-muted-foreground">支払状況の確認と管理</p>
        </div>
      </div>

      {/* Payment Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={24} className="text-green-500" />
            <p className="text-muted-foreground text-sm">支払済み</p>
          </div>
          <p className="text-3xl font-bold text-foreground">¥125,000</p>
          <p className="text-xs text-muted-foreground mt-2">1件</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={24} className="text-yellow-500" />
            <p className="text-muted-foreground text-sm">未払い</p>
          </div>
          <p className="text-3xl font-bold text-foreground">¥89,500</p>
          <p className="text-xs text-muted-foreground mt-2">1件</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle size={24} className="text-red-500" />
            <p className="text-muted-foreground text-sm">期限切れ</p>
          </div>
          <p className="text-3xl font-bold text-foreground">¥156,200</p>
          <p className="text-xs text-muted-foreground mt-2">1件</p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">請求書ID</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">金額</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">ステータス</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">期限日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">支払日</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">アクション</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-6 text-sm font-medium text-foreground">{payment.invoiceId}</td>
                  <td className="py-4 px-6 text-sm font-semibold text-foreground">{payment.amount}</td>
                  <td className="py-4 px-6 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        payment.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : payment.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {payment.status === "paid" ? "支払済み" : payment.status === "pending" ? "未払い" : "期限切れ"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{payment.dueDate}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{payment.paidDate || "-"}</td>
                  <td className="py-4 px-6 text-sm">
                    <button className="px-3 py-1 border border-primary text-primary font-medium rounded-lg hover:bg-primary/5 transition-colors text-xs">
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
