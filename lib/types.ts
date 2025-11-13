// 請求書のステータス
export type InvoiceStatus = "paid" | "pending" | "overdue" | "draft"

// 請求書のデータソース
export type InvoiceSource = "manual" | "pdf_import" | "image_import"

// 請求書の明細行
export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
}

// 顧客情報
export interface Client {
  id: string
  name: string
  email: string
  address: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}

// 請求書
export interface Invoice {
  id: string
  invoiceNumber: string
  client: Client
  issueDate: Date
  dueDate: Date
  lineItems: InvoiceLineItem[]
  subtotal: number
  tax: number
  taxRate: number
  total: number
  status: InvoiceStatus
  paidDate?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
  source?: InvoiceSource
  attachments?: InvoiceAttachment[]
  ocrData?: OCRResult
  paymentInfo?: PaymentInfo
}

// 添付ファイル
export interface InvoiceAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  base64Data: string
  uploadedAt: Date
}

// OCR結果
export interface OCRResult {
  confidence: number
  processingTime: number
  extractedFields: {
    invoiceNumber?: FieldExtraction
    clientName?: FieldExtraction
    issueDate?: FieldExtraction
    dueDate?: FieldExtraction
    total?: FieldExtraction
    subtotal?: FieldExtraction
    tax?: FieldExtraction
    bankName?: FieldExtraction
    branchName?: FieldExtraction
    accountType?: FieldExtraction
    accountNumber?: FieldExtraction
    accountHolder?: FieldExtraction
  }
}

// フィールド抽出結果
export interface FieldExtraction {
  value: string
  confidence: number
}

// 振込先情報
export interface PaymentInfo {
  bankName?: string
  branchName?: string
  accountType?: string
  accountNumber?: string
  accountHolder?: string
}

// 支払い情報
export interface Payment {
  id: string
  invoiceId: string
  amount: number
  paymentDate: Date
  paymentMethod?: string
  notes?: string
  createdAt: Date
}

// 企業設定
export interface CompanySettings {
  name: string
  address: string
  phone: string
  email: string
  bankName: string
  branchName: string
  accountType: "普通預金" | "当座預金"
  accountNumber: string
  taxRate: number
}

// 通知設定
export interface NotificationSettings {
  dueDateReminder: boolean
  paymentConfirmation: boolean
  invoiceCreation: boolean
}

// システム設定
export interface Settings {
  company: CompanySettings
  notifications: NotificationSettings
}

// 検索フィルター
export interface SearchFilters {
  keyword?: string
  status?: InvoiceStatus[]
  source?: InvoiceSource
  minAmount?: number
  maxAmount?: number
  startDate?: Date
  endDate?: Date
}

// ダッシュボード統計
export interface DashboardStats {
  totalRevenue: number
  paidAmount: number
  pendingAmount: number
  overdueAmount: number
  paidCount: number
  pendingCount: number
  overdueCount: number
}