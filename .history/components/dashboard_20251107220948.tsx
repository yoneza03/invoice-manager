"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, AlertCircle, CheckCircle, Clock, ArrowRight } from "lucide-react"
import { useStore } from "@/lib/store"
import { calculateDashboardStats, calculateMonthlyData, formatCurrency } from "@/lib/api"

interface DashboardProps {
  onNavigate: (page: string, invoiceId?: string) => void
}

const dashboardData = [
  { month: "1月", paid: 12500, pending: 8000, overdue: 2000 },
  { month: "2月", paid: 15200, pending: 6500, overdue: 3100 },
  { month: "3月", paid: 18900, pending: 5200, overdue: 1800 },
  { month: "4月", paid: 16700, pending: 7100, overdue: 2900 },
  { month: "5月", paid: 21300, pending: 4800, overdue: 1200 },
  { month: "6月", paid: 24100, pending: 3900, overdue: 800 },
]

const statusData = [
  { name: "支払済み", value: 118900, color: "#4ade80" },
  { name: "未払い", value: 35500, color: "#fbbf24" },
  { name: "期限切れ", value: 11800, color: "#ef4444" },
]

const recentInvoices = [
  { id: "INV-2024-001", client: "株式会社A", amount: "¥125,000", status: "paid", date: "2024-06-15" },
  { id: "INV-2024-002", client: "株式会社B", amount: "¥89,500", status: "pending", date: "2024-06-14" },
  { id: "INV-2024-003", client: "株式会社C", amount: "¥156,200", status: "overdue", date: "2024-06-10" },
  { id: "INV-2024-004", client: "株式会社D", amount: "¥73,800", status: "paid", date: "2024-06-12" },
]

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { invoices } = useStore()
  const stats = calculateDashboardStats(invoices)
  const monthlyData = calculateMonthlyData(invoices)
  
  const statusData = [
    { name: "支払済み", value: stats.paidAmount, color: "#4ade80" },
    { name: "未払い", value: stats.pendingAmount, color: "#fbbf24" },
    { name: "期限切れ", value: stats.overdueAmount, color: "#ef4444" },
  ]
  
  const recentInvoices = invoices.slice(0, 4)

  return (
    <div className="p-8 lg:p-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">ダッシュボード</h1>
        <p className="text-muted-foreground">請求書管理システムへようこそ</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp size={24} className="text-primary" />
            </div>
            <span className="text-xs font-semibold text-success">+12%</span>
          </div>
          <p className="text-muted-foreground text-sm mb-1">売上合計</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <CheckCircle size={24} className="text-accent" />
            </div>
            <span className="text-xs font-semibold text-success">+5%</span>
          </div>
          <p className="text-muted-foreground text-sm mb-1">支払済み金額</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.paidAmount)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock size={24} className="text-yellow-600" />
            </div>
            <span className="text-xs font-semibold text-yellow-600">{stats.pendingCount}件</span>
          </div>
          <p className="text-muted-foreground text-sm mb-1">未払い金額</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.pendingAmount)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertCircle size={24} className="text-destructive" />
            </div>
            <span className="text-xs font-semibold text-destructive">{stats.overdueCount}件</span>
          </div>
          <p className="text-muted-foreground text-sm mb-1">期限切れ金額</p>
          <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.overdueAmount)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">売上推移</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData.length > 0 ? monthlyData : [{month: '1月', paid: 0, pending: 0, overdue: 0}]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="paid" stroke="#4ade80" name="支払済み" />
              <Line type="monotone" dataKey="pending" stroke="#fbbf24" name="未払い" />
              <Line type="monotone" dataKey="overdue" stroke="#ef4444" name="期限切れ" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">ステータス別</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-card border border-border rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">月別売上比較</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData.length > 0 ? monthlyData : [{month: '1月', paid: 0, pending: 0, overdue: 0}]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="paid" fill="#4ade80" name="支払済み" />
            <Bar dataKey="pending" fill="#fbbf24" name="未払い" />
            <Bar dataKey="overdue" fill="#ef4444" name="期限切れ" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Invoices */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-foreground">最近の請求書</h3>
          <button
            onClick={() => onNavigate("invoices")}
            className="text-primary hover:text-primary/80 font-medium flex items-center gap-2"
          >
            すべて表示 <ArrowRight size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">請求書ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">顧客</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">金額</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">ステータス</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">日付</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onNavigate("detail", invoice.id)}>
                  <td className="py-3 px-4 text-sm font-medium text-foreground">{invoice.invoiceNumber}</td>
                  <td className="py-3 px-4 text-sm text-foreground">{invoice.client.name}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-foreground">{formatCurrency(invoice.total)}</td>
                  <td className="py-3 px-4 text-sm">
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
                  <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(invoice.issueDate).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-8 flex-wrap">
        <button
          onClick={() => onNavigate("create")}
          className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
        >
          新規請求書作成
        </button>
        <button
          onClick={() => onNavigate("payments")}
          className="px-6 py-3 bg-card border border-primary text-primary font-semibold rounded-lg hover:bg-primary/5 transition-colors"
        >
          支払管理へ
        </button>
      </div>
    </div>
  )
}
