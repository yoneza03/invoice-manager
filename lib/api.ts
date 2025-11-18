import { Invoice, InvoiceStatus, SearchFilters, DashboardStats } from "./types"

// 請求書番号を生成
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, "0")
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `INV-${year}-${month}${random}`
}

// 金額をフォーマット
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`
}

// 日付をフォーマット
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

// 請求書のステータスを判定
export function determineInvoiceStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.paidDate) {
    return "paid"
  }

  const now = new Date()
  const dueDate = new Date(invoice.dueDate)

  if (dueDate < now) {
    return "overdue"
  }

  return "pending"
}

// 請求書をフィルタリング
export function filterInvoices(invoices: Invoice[], filters: SearchFilters): Invoice[] {
  let filtered = [...invoices]

  // キーワード検索
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase()
    filtered = filtered.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(keyword) ||
        inv.client.name.toLowerCase().includes(keyword) ||
        inv.client.email.toLowerCase().includes(keyword)
    )
  }

  // ステータスフィルター
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter((inv) => filters.status!.includes(inv.status))
  }

  // 金額範囲フィルター
  if (filters.minAmount !== undefined) {
    filtered = filtered.filter((inv) => inv.total >= filters.minAmount!)
  }

  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter((inv) => inv.total <= filters.maxAmount!)
  }

  // 日付範囲フィルター
  if (filters.startDate) {
    filtered = filtered.filter((inv) => new Date(inv.issueDate) >= filters.startDate!)
  }

  if (filters.endDate) {
    filtered = filtered.filter((inv) => new Date(inv.issueDate) <= filters.endDate!)
  }

  return filtered
}

// ダッシュボード統計を計算
export function calculateDashboardStats(invoices: Invoice[]): DashboardStats {
  const stats: DashboardStats = {
    totalRevenue: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
  }

  invoices.forEach((invoice) => {
    stats.totalRevenue += invoice.total

    switch (invoice.status) {
      case "paid":
        stats.paidAmount += invoice.total
        stats.paidCount++
        break
      case "pending":
        stats.pendingAmount += invoice.total
        stats.pendingCount++
        break
      case "overdue":
        stats.overdueAmount += invoice.total
        stats.overdueCount++
        break
    }
  })

  return stats
}

// 月別データを集計
export function calculateMonthlyData(invoices: Invoice[]) {
  const monthlyData: { [key: string]: { paid: number; pending: number; overdue: number } } = {}

  invoices.forEach((invoice) => {
    const date = new Date(invoice.issueDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { paid: 0, pending: 0, overdue: 0 }
    }

    switch (invoice.status) {
      case "paid":
        monthlyData[monthKey].paid += invoice.total
        break
      case "pending":
        monthlyData[monthKey].pending += invoice.total
        break
      case "overdue":
        monthlyData[monthKey].overdue += invoice.total
        break
    }
  })

  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month: formatMonthJapanese(month),
      ...data,
    }))
    .slice(-6) // 直近6ヶ月
}

// 月を日本語フォーマットに変換
function formatMonthJapanese(monthKey: string): string {
  const [year, month] = monthKey.split("-")
  return `${parseInt(month)}月`
}

// 消費税を計算
export function calculateTax(amount: number, taxRate: number = 0.1): number {
  return Math.floor(amount * taxRate)
}

// 小計から合計を計算
export function calculateTotal(subtotal: number, taxRate: number = 0.1): number {
  return subtotal + calculateTax(subtotal, taxRate)
}

// IDを生成
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 請求書をソート
export function sortInvoices(invoices: Invoice[], sortBy: "date" | "amount" | "status", order: "asc" | "desc" = "desc"): Invoice[] {
  const sorted = [...invoices].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
      case "amount":
        return b.total - a.total
      case "status":
        const statusOrder: Record<InvoiceStatus, number> = { paid: 0, pending: 1, overdue: 2, draft: 3, imported: 4 }
        return statusOrder[a.status] - statusOrder[b.status]
      default:
        return 0
    }
  })

  return order === "asc" ? sorted.reverse() : sorted
}

/**
 * 適格請求書発行事業者登録番号のバリデーション（改良版）
 * @param value 登録番号（T + 13桁の数字）
 * @returns バリデーション結果とエラーメッセージ
 */
export function validateRegistrationNumber(
  value: string
): { valid: boolean; error?: string } {
  // 空文字チェック（必須化）
  if (!value || value.trim() === '') {
    return {
      valid: false,
      error: '登録番号を入力してください'
    }
  }
  
  const trimmed = value.trim()
  
  // 形式チェック: T + 13桁
  if (!/^T\d{13}$/.test(trimmed)) {
    return {
      valid: false,
      error: '登録番号はT+13桁の数字で入力してください（例: T1234567890123）'
    }
  }
  
  return { valid: true }
}