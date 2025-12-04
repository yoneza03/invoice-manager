// 請求書のステータス
export type InvoiceStatus = "paid" | "unpaid" | "overdue" | "draft"

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
  postalCode?: string
  contactPerson?: string
  memo?: string
  createdAt: Date
  updatedAt: Date
  // 電子帳簿保存法対応フィールド
  dataHash?: string  // 改ざん防止用ハッシュ値
  hashGeneratedAt?: string  // ハッシュ生成日時 (ISO 8601)
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
  isReadonly?: boolean
  originalPdfAttachmentId?: string
  issuerInfo?: IssuerInfo  // 🆕 発行元情報（インポート請求書用）
  pdfStorageLocation?: 'none' | 'indexeddb'  // 🆕 PDFデータの保存場所
  // 電子帳簿保存法対応フィールド
  dataHash?: string  // 改ざん防止用ハッシュ値
  hashGeneratedAt?: string  // ハッシュ生成日時 (ISO 8601)
}

// 添付ファイル
export interface InvoiceAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: Date
  base64Data?: string
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
    taxRate?: FieldExtraction // 🆕 税率を追加
    bankName?: FieldExtraction
    branchName?: FieldExtraction
    accountType?: FieldExtraction
    accountNumber?: FieldExtraction
    accountHolder?: FieldExtraction
    issuerRegistrationNumber?: FieldExtraction  // 🆕 適格請求書発行事業者登録番号
    issuerName?: FieldExtraction  // 🆕 発行元企業名
    issuerAddress?: FieldExtraction  // 🆕 発行元住所
    issuerPostalCode?: FieldExtraction  // 🆕 発行元郵便番号
    issuerPhone?: FieldExtraction  // 🆕 発行元電話番号
    lineItems?: Array<{
      description: FieldExtraction
      quantity?: FieldExtraction
      unitPrice?: FieldExtraction
      amount?: FieldExtraction
    }>
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
  // 電子帳簿保存法対応フィールド
  dataHash?: string  // 改ざん防止用ハッシュ値
  hashGeneratedAt?: string  // ハッシュ生成日時 (ISO 8601)
}

// 発行者情報（インポート相手企業）
export interface IssuerInfo {
  name: string
  address?: string
  phone?: string
  email?: string
  registrationNumber?: string // 適格請求書発行事業者登録番号
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
  registrationNumber?: string
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

/**
 * 適格請求書発行事業者登録番号のバリデーション
 * @param value 登録番号（T + 13桁の数字）
 * @returns バリデーション結果
 */
export function validateRegistrationNumber(value: string): boolean {
  const regex = /^T\d{13}$/
  return regex.test(value)
}
// ========================================
// 請求書データ型定義 v2.0.0
// ========================================

/**
 * 請求書基本情報
 * 
 * 請求書を一意に識別し、取引の時系列を管理するための情報。
 * インボイス制度対応のため、通貨フィールドも含む。
 */
export interface InvoiceBasicInfo {
  /**
   * 請求書番号
   * 形式は発行元により異なる（例: "INV-2023-001", "202311-123"）
   * null の場合はシステムが自動採番
   */
  invoiceNumber: string | null

  /**
   * 発行日
   * ISO 8601形式の日付文字列（例: "2023-11-15"）
   * null の場合は未確定（下書き状態）
   */
  issueDate: string | null

  /**
   * 取引日
   * 実際の商品・サービス提供日
   * null の場合は発行日と同一とみなす
   */
  transactionDate: string | null

  /**
   * 通貨コード
   * ISO 4217形式（例: "JPY", "USD", "EUR"）
   * @default "JPY"
   */
  currency: string

  /**
   * 件名・タイトル
   * 請求書の概要（例: "2023年11月分請求書", "システム開発費用"）
   */
  subject: string | null

  /**
   * 発注番号・注文番号
   * 照合用の参照番号
   */
  orderNumber: string | null
}

/**
 * 請求先情報
 * 
 * 請求書の宛先。既存の Client 型と連携するが、
 * より軽量な構造で請求書データに埋め込む。
 */
export interface BillingTo {
  /**
   * 請求先企業名・個人名（必須）
   */
  companyName: string

  /**
   * 部署名
   * 例: "経理部", "総務課"
   */
  department: string | null

  /**
   * 担当者名
   * 例: "山田太郎様", "田中花子 御中"
   */
  contactPerson: string | null
}

/**
 * 税額内訳
 * 複数税率対応のための詳細情報
 */
export interface TaxBreakdown {
  /**
   * 税率（%）
   * 例: 10, 8, 0
   */
  rate: number

  /**
   * その税率での税額
   */
  amount: number

  /**
   * その税率が適用される課税対象額（オプション）
   */
  taxableAmount?: number
}

/**
 * 金額情報
 * 
 * 請求書の金額計算結果。
 * 小計、税額、合計の3つの基本値と、詳細な税額内訳を保持。
 */
export interface AmountInfo {
  /**
   * 小計（税抜金額）
   */
  subtotal: number

  /**
   * 消費税額
   */
  taxAmount: number

  /**
   * 合計金額（税込）
   * subtotal + taxAmount と一致する必要がある
   */
  totalAmount: number

  /**
   * 税額内訳（複数税率対応）
   * 例: [{ rate: 10, amount: 1000 }, { rate: 8, amount: 80 }]
   */
  taxBreakdown: TaxBreakdown[]

  /**
   * 免税取引フラグ
   * true の場合、taxAmount は 0 である必要がある
   */
  taxExempt: boolean
}

/**
 * 明細行
 * 
 * 請求書の個別項目。
 * 既存の InvoiceLineItem を拡張し、税率・税額を追加。
 */
export interface LineItem {
  /**
   * 明細ID
   * システム内で一意に識別するための ID
   */
  id: string

  /**
   * 品名・サービス名（必須）
   * 例: "Webサイト制作", "SNS運用(10月分)"
   */
  description: string

  /**
   * 数量
   * null の場合は「一式」として扱う
   */
  quantity: number | null

  /**
   * 単位
   * 例: "個", "時間", "式", "月"
   */
  unit: string | null

  /**
   * 単価
   * null の場合は amount のみで計算
   */
  unitPrice: number | null

  /**
   * 金額（税抜）
   * quantity * unitPrice と一致する必要がある
   * （quantity または unitPrice が null の場合は直接設定）
   */
  amount: number

  /**
   * 適用税率（%）
   * 例: 10, 8, 0
   * null の場合はデフォルト税率を適用
   */
  taxRate: number | null

  /**
   * 税額
   * amount * (taxRate / 100) と一致する必要がある
   */
  taxAmount: number | null

  /**
   * 備考
   * この明細行に関する追加情報
   */
  remarks: string | null
}

/**
 * 支払条件
 * 
 * 支払期限と振込先口座情報。
 * 既存の PaymentInfo を拡張し、支払条件も含める。
 */
export interface PaymentTerms {
  /**
   * 支払期日
   * ISO 8601形式の日付文字列（例: "2023-12-31"）
   */
  dueDate: string | null

  /**
   * 支払条件
   * 例: "翌月末払い", "NET30", "現金払い"
   */
  paymentCondition: string | null

  /**
   * 銀行名
   * 例: "三菱UFJ銀行"
   */
  bankName: string | null

  /**
   * 支店名
   * 例: "渋谷支店"
   */
  branchName: string | null

  /**
   * 口座種別
   * 例: "普通預金", "当座預金"
   */
  accountType: string | null

  /**
   * 口座番号
   * 例: "1234567"
   */
  accountNumber: string | null

  /**
   * 口座名義
   * 例: "カ)サンプルカイシャ"
   */
  accountHolder: string | null

  /**
   * 振込手数料負担
   * 例: "振込手数料は貴社負担でお願いします"
   */
  feeBearer: string | null
}

/**
 * 請求期間
 */
export interface BillingPeriod {
  /**
   * 期間開始日
   * ISO 8601形式（例: "2023-11-01"）
   */
  start: string | null

  /**
   * 期間終了日
   * ISO 8601形式（例: "2023-11-30"）
   */
  end: string | null
}

/**
 * 照合キー
 * 
 * 請求書の重複チェックと自動マッチングのための情報。
 * 同一の請求書を複数回インポートした場合の検出や、
 * 発注書との突合に使用。
 */
export interface ReconciliationKeys {
  /**
   * 正規化された発行元名
   * 
   * 株式会社、スペース等を除去した標準形式。
   * 例: "サンプル" ← "株式会社サンプル", "サンプル　株式会社"
   */
  normalizedIssuerName: string

  /**
   * 発注番号・注文番号
   * InvoiceBasicInfo.orderNumber と同じ値
   */
  orderNumber: string | null

  /**
   * 請求期間
   * 例: { start: "2023-11-01", end: "2023-11-30" }
   */
  billingPeriod: BillingPeriod

  /**
   * 合計金額
   * 照合時の金額チェック用
   */
  totalAmount: number

  /**
   * プロジェクト名・案件名
   * OCRまたは手動で設定
   */
  projectName: string | null

  /**
   * 担当者名
   * 発行元側の担当者
   */
  contactPerson: string | null
}

/**
 * 受領方法
 */
export type ReceiptMethod = 'email' | 'upload'

/**
 * 請求書メタデータ
 * 
 * システム管理用の情報。
 * 監査証跡、データの出所、ファイル管理に関する情報を保持。
 */
export interface InvoiceMetadata {
  /**
   * 受領方法
   * - email: メール経由で受領
   * - upload: 手動アップロード
   */
  receiptMethod: ReceiptMethod

  /**
   * データソース
   * - manual: 手動作成
   * - pdf_import: PDFインポート
   * - image_import: 画像インポート
   */
  source: InvoiceSource

  /**
   * 受領日時
   * ISO 8601形式（例: "2023-11-15T10:30:00+09:00"）
   */
  receiptDateTime: string

  /**
   * 登録者
   * ユーザー識別子またはメールアドレス
   */
  registeredBy: string

  /**
   * 送信元メールアドレス
   * receiptMethod が 'email' の場合のみ設定
   */
  sourceEmail: string | null

  /**
   * ファイルハッシュ値
   * 元ファイルのSHA-256ハッシュ（重複検出用）
   */
  fileHash: string

  /**
   * ストレージパス
   * IndexedDB または LocalStorage のキー
   */
  storagePath: string

  /**
   * OCR信頼度
   * 0-1の範囲（インポートデータの場合のみ）
   */
  ocrConfidence: number

  /**
   * データバージョン
   * スキーマのバージョン番号
   * @default 2
   */
  version: number

  /**
   * 作成日時
   * ISO 8601形式
   */
  createdAt: string

  /**
   * 更新日時
   * ISO 8601形式
   */
  updatedAt: string

  /**
   * 読み取り専用フラグ
   * true の場合、編集不可（インポートデータ）
   */
  isReadonly: boolean

  /**
   * PDFストレージの場所
   * - 'indexeddb': IndexedDBに保存
   * - 'none': 保存なし
   */
  pdfStorageLocation?: 'indexeddb' | 'none'

  /**
   * 元のPDF添付ファイルID
   * InvoiceAttachment の id への参照
   */
  originalPdfAttachmentId?: string

  /**
   * 請求書ステータス
   */
  status: InvoiceStatus

  /**
   * 支払日
   * status が 'paid' の場合のみ設定
   */
  paidDate?: string

  /**
   * 備考・メモ
   */
  notes?: string

  /**
   * Client型へのID参照
   * BillingTo と紐づく Client レコードの ID
   */
  clientId?: string
}

/**
 * 請求書データ（統合型）
 * 
 * 8つのカテゴリーで構成される包括的な請求書データモデル。
 * 既存の Invoice 型を置き換える新しい型定義。
 * 
 * @version 2.0.0
 */
export interface InvoiceData {
  /**
   * システム内部ID
   * UUID v4 形式
   */
  id: string

  /**
   * 基本情報
   */
  basicInfo: InvoiceBasicInfo

  /**
   * 発行元情報（インポートデータの場合のみ）
   * 手動作成の場合は undefined で、settings.company を使用
   */
  issuerInfo?: IssuerInfo

  /**
   * 請求先情報
   */
  billingTo: BillingTo

  /**
   * 金額情報
   */
  amountInfo: AmountInfo

  /**
   * 明細行
   */
  lineItems: LineItem[]

  /**
   * 支払条件
   */
  paymentTerms: PaymentTerms

  /**
   * 照合キー
   */
  reconciliationKeys: ReconciliationKeys

  /**
   * メタデータ
   */
  metadata: InvoiceMetadata

  /**
   * 添付ファイル
   */
  attachments?: InvoiceAttachment[]

  /**
   * OCR抽出結果（インポートデータの場合のみ）
   */
  ocrData?: OCRResult
}

// ========================================
// ユーザー認証型定義
// ========================================

/**
 * ユーザー情報
 */
export interface User {
  id: string
  email: string
  name: string
  createdAt: Date
  lastLogin?: Date
}

/**
 * ログイン情報
 */
export interface LoginCredentials {
  email: string
  password: string
}

/**
 * 新規登録情報
 */
export interface RegisterCredentials {
  email: string
  password: string
  name?: string
}

/**
 * ユーザー権限
 */
export interface UserPermissions {
  role: "admin" | "accounting" | "sales" | "viewer"
  canEditInvoices: boolean
  canEditClients: boolean
  canAccessPayments: boolean
  canSendEmails: boolean
  canAccessSettings: boolean
}

/**
 * 認証状態
 */
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  permissions: UserPermissions | null
}

// ========================================
// 請求書テンプレート型定義
// ========================================

/**
 * 請求書テンプレート
 *
 * 頻繁に使用する請求書の雛形を保存するための型定義。
 * 明細行、税率、金額計算をテンプレート化し、
 * 請求書作成時に素早く適用できるようにする。
 */
export interface InvoiceTemplate {
  /**
   * テンプレートID
   * UUID v4 形式
   */
  id: string

  /**
   * ユーザーID
   * このテンプレートの所有者
   */
  userId: string

  /**
   * テンプレート名（必須）
   * 例: "月次定額サービス", "Web制作標準プラン"
   */
  name: string

  /**
   * 説明文（任意）
   * テンプレートの用途や注意事項
   */
  description?: string

  /**
   * 請求書明細（配列）
   * テンプレート化する明細行
   */
  items: InvoiceLineItem[]

  /**
   * 小計（税抜金額）
   */
  subtotal: number

  /**
   * 税率（%）
   */
  taxRate: number

  /**
   * 税額
   */
  taxAmount: number

  /**
   * 合計金額（税込）
   */
  totalAmount: number

  /**
   * 作成日時
   */
  createdAt: Date

  /**
   * 更新日時
   */
  updatedAt: Date
}

/**
 * テンプレート作成リクエスト
 */
export interface CreateInvoiceTemplateRequest {
  name: string
  description?: string
  items: InvoiceLineItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
}

/**
 * テンプレート更新リクエスト
 */
export interface UpdateInvoiceTemplateRequest {
  name?: string
  description?: string
  items?: InvoiceLineItem[]
  subtotal?: number
  taxRate?: number
  taxAmount?: number
  totalAmount?: number
}