import { InvoiceData, InvoiceBasicInfo, BillingTo, AmountInfo, LineItem, PaymentTerms, ReconciliationKeys, InvoiceMetadata, IssuerInfo, TaxBreakdown } from "../types"

// ==================== Exported Utility Functions ====================

/**
 * 日付文字列をYYYY-MM-DD形式に正規化
 *
 * @param dateStr - 日付文字列（YYYY/MM/DD、YYYY.MM.DD、和暦など）
 * @returns 正規化された日付文字列（YYYY-MM-DD形式）、無効な場合はnull
 *
 * @example
 * normalizeDate("2024/11/24") // "2024-11-24"
 * normalizeDate("2024.11.24") // "2024-11-24"
 * normalizeDate("令和6年11月24日") // "2024-11-24"
 */
export function normalizeDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') {
    return null
  }

  const trimmed = dateStr.trim()
  
  // YYYY-MM-DD形式（既に正規化済み）
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  // YYYY/MM/DD または YYYY-MM-DD 形式
  const slashPattern = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/
  const slashMatch = trimmed.match(slashPattern)
  if (slashMatch) {
    const [, year, month, day] = slashMatch
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    if (isValidDate(normalized)) {
      return normalized
    }
  }

  // YYYY.MM.DD 形式
  const dotPattern = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/
  const dotMatch = trimmed.match(dotPattern)
  if (dotMatch) {
    const [, year, month, day] = dotMatch
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    if (isValidDate(normalized)) {
      return normalized
    }
  }

  // 和暦形式（令和、平成、昭和、大正）
  const eraPattern = /^(令和|平成|昭和|大正)(\d{1,2})年(\d{1,2})月(\d{1,2})日?$/
  const eraMatch = trimmed.match(eraPattern)
  if (eraMatch) {
    const [, era, eraYear, month, day] = eraMatch
    const westernYear = convertEraToWestern(era, parseInt(eraYear, 10))
    if (westernYear) {
      const normalized = `${westernYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      if (isValidDate(normalized)) {
        return normalized
      }
    }
  }

  // 日本語形式: YYYY年MM月DD日
  const japanesePattern = /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/
  const japaneseMatch = trimmed.match(japanesePattern)
  if (japaneseMatch) {
    const [, year, month, day] = japaneseMatch
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    if (isValidDate(normalized)) {
      return normalized
    }
  }

  return null
}

/**
 * 和暦を西暦に変換
 */
function convertEraToWestern(era: string, eraYear: number): number | null {
  const eraStartYears: { [key: string]: number } = {
    '令和': 2019,
    '平成': 1989,
    '昭和': 1926,
    '大正': 1912,
  }
  
  const startYear = eraStartYears[era]
  if (!startYear) {
    return null
  }
  
  // 元年は1年として扱う
  const year = startYear + eraYear - 1
  
  // 妥当な範囲チェック（1900年～2100年）
  if (year < 1900 || year > 2100) {
    return null
  }
  
  return year
}

/**
 * 日付の妥当性チェック
 */
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date instanceof Date && !isNaN(date.getTime())
}

/**
 * 金額文字列を数値に変換
 *
 * @param amountStr - 金額文字列（「¥」「,」「円」などの文字を含む）
 * @returns 数値、無効な場合はnull
 *
 * @example
 * parseAmount("¥1,234,567") // 1234567
 * parseAmount("1,234円") // 1234
 * parseAmount("\\1234") // 1234
 */
export function parseAmount(amountStr: string): number | null {
  if (!amountStr || typeof amountStr !== 'string') {
    return null
  }

  // 文字列から不要な文字を除去
  let cleaned = amountStr.trim()
  
  // 全角数字を半角に変換
  cleaned = cleaned.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
  
  // 通貨記号、カンマ、円記号などを除去
  cleaned = cleaned.replace(/[¥\\￥,，円]/g, '')
  
  // スペースを除去
  cleaned = cleaned.replace(/\s+/g, '')
  
  // 数値のみが残っているかチェック
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return null
  }
  
  const amount = Number(cleaned)
  
  // NaNチェック
  if (isNaN(amount)) {
    return null
  }
  
  // 妥当な範囲チェック（-1億～1億）
  if (amount < -100000000 || amount > 100000000) {
    return null
  }
  
  return amount
}

/**
 * 企業名を正規化
 *
 * @param name - 企業名
 * @param options - オプション
 * @param options.abbreviate - 法人格を省略形に変換するか（デフォルト: false）
 * @returns 正規化された企業名
 *
 * @example
 * normalizeCompanyName("株式会社 テスト") // "株式会社テスト"
 * normalizeCompanyName("株式会社テスト", { abbreviate: true }) // "(株)テスト"
 * normalizeCompanyName("テスト株式会社") // "テスト株式会社"
 */
export function normalizeCompanyName(
  name: string,
  options: { abbreviate?: boolean } = {}
): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  let normalized = name.trim()
  
  // スペース、タブ、全角スペースを除去
  normalized = normalized.replace(/[\s\u3000]+/g, '')
  
  // 省略形への変換
  if (options.abbreviate) {
    normalized = normalized
      .replace(/株式会社/g, '(株)')
      .replace(/有限会社/g, '(有)')
      .replace(/合同会社/g, '(同)')
      .replace(/合資会社/g, '(資)')
      .replace(/一般社団法人/g, '(一社)')
      .replace(/一般財団法人/g, '(一財)')
      .replace(/公益社団法人/g, '(公社)')
      .replace(/公益財団法人/g, '(公財)')
  }
  
  return normalized
}

/**
 * T+13桁の適格請求書発行事業者登録番号を抽出
 *
 * @param text - 抽出元テキスト
 * @returns 登録番号（T + 13桁の数字）、見つからない場合はnull
 *
 * @example
 * extractRegistrationNumber("登録番号: T1234567890123") // "T1234567890123"
 * extractRegistrationNumber("T1234567890123") // "T1234567890123"
 */
export function extractRegistrationNumber(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null
  }

  const normalizedText = text.replace(/\s+/g, '')
  
  // ラベル付きパターン
  const labeledPatterns = [
    /(?:適格請求書発行事業者登録番号|登録番号|登録No\.?|登録ナンバー|RegistrationNumber|Reg\.?No\.?|インボイス番号|InvoiceNo)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
    /(?:インボイス|Invoice)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
    /(?:T番号)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
  ]
  
  for (const pattern of labeledPatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      let value = match[1]
      
      // 先頭の誤認識文字を「T」に置き換え
      value = value.replace(/^[イ1lLI『｢「]/i, 'T')
      
      // 全角数字を半角に変換
      value = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      
      // 数字以外を削除(Tは残す)
      value = value.replace(/[^T0-9]/g, '')
      
      // Tがない場合は先頭に追加
      if (!/^T/.test(value) && /^\d{13}$/.test(value)) {
        value = 'T' + value
      }
      
      // 正しいフォーマットかチェック
      if (/^T\d{13}$/.test(value)) {
        return value
      }
    }
  }
  
  // ラベルなしパターン
  const unlabeledPattern = /\b([TtＳ『｢「]\d{13,})\b/
  const unlabeledMatch = normalizedText.match(unlabeledPattern)
  
  if (unlabeledMatch) {
    let value = unlabeledMatch[1]
    value = value.replace(/^[イ1lLI『｢「]/i, 'T')
    value = value.toUpperCase()
    value = value.replace(/[^T0-9]/g, '')
    
    if (!/^T/.test(value) && /^\d{13}$/.test(value)) {
      value = 'T' + value
    }
    
    if (/^T\d{13}$/.test(value)) {
      return value
    }
  }
  
  return null
}

/**
 * テキストから電話番号を抽出・正規化
 *
 * @param text - 抽出元テキスト
 * @returns 正規化された電話番号、見つからない場合はnull
 *
 * @example
 * extractPhoneNumber("TEL: 03-1234-5678") // "03-1234-5678"
 * extractPhoneNumber("電話 0312345678") // "03-1234-5678"
 */
export function extractPhoneNumber(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null
  }

  const phonePatterns = [
    // ラベル付きパターン
    /(?:TEL|Tel|電話|tel|℡)[:\s：]*(\d{2,4}[-−ー\s()（）]\d{2,4}[-−ー\s()（）]\d{4})/,
    /(?:TEL|Tel|電話|tel|℡)[:\s：]*(\d{10,11})/,
    // カッコ付き市外局番
    /\((\d{2,4})\)\s*(\d{2,4})[-−ー]\s*(\d{4})/,
    // 標準的なハイフン区切り
    /(\d{2,4}[-−ー]\d{2,4}[-−ー]\d{4})/,
  ]

  for (const pattern of phonePatterns) {
    const match = text.match(pattern)
    if (match) {
      let phone = match[0]
      // ラベルを除去
      phone = phone.replace(/^(?:TEL|Tel|電話|tel|℡)[:\s：]*/, '')
      // カッコを除去してハイフンに統一
      phone = phone.replace(/[()（）]/g, '').replace(/[−ー\s]/g, '-')
      // 連続するハイフンを1つに
      phone = phone.replace(/-+/g, '-')
      
      // 電話番号の妥当性チェック（10-11桁の数字）
      const digitsOnly = phone.replace(/-/g, '')
      if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
        // ハイフンなしの場合、適切な位置にハイフンを挿入
        if (!phone.includes('-')) {
          phone = formatPhoneNumber(digitsOnly)
        }
        return phone
      }
    }
  }
  
  return null
}

/**
 * 電話番号を適切にフォーマット
 */
function formatPhoneNumber(digits: string): string {
  // 11桁の場合（携帯電話など）
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  
  // 10桁の場合（固定電話など）
  if (digits.length === 10) {
    // 市外局番が2桁の場合
    if (digits.startsWith('03') || digits.startsWith('06')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
    // 市外局番が3桁の場合
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  return digits
}

/**
 * テキストからメールアドレスを抽出
 *
 * @param text - 抽出元テキスト
 * @returns メールアドレス、見つからない場合はnull
 *
 * @example
 * extractEmail("Email: test@example.com") // "test@example.com"
 * extractEmail("contact: info@company.co.jp") // "info@company.co.jp"
 */
export function extractEmail(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null
  }

  const emailPatterns = [
    /(?:Email|E-mail|E-Mail|mail|メール)[:\s：]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  ]

  for (const pattern of emailPatterns) {
    const match = text.match(pattern)
    if (match) {
      const email = match[1] || match[0]
      // メールアドレスの妥当性チェック
      if (/@/.test(email) && /\.[a-zA-Z]{2,}$/.test(email)) {
        return email.trim().toLowerCase()
      }
    }
  }
  
  return null
}

// ==================== Main Extraction Function ====================

/**
 * OCR抽出結果の信頼度スコアを計算
 * @param data 抽出されたInvoiceData
 * @returns 0.0〜1.0の信頼度スコア
 */
function calculateConfidenceScore(data: Partial<InvoiceData>): number {
  let successCount = 0
  let totalCount = 0

  // 基本情報 (4項目)
  totalCount += 4
  if (data.basicInfo?.invoiceNumber) successCount++
  if (data.basicInfo?.issueDate) successCount++
  if (data.basicInfo?.transactionDate) successCount++
  if (data.basicInfo?.subject) successCount++

  // 請求先 (3項目)
  totalCount += 3
  if (data.billingTo?.companyName && data.billingTo.companyName !== "不明" && data.billingTo.companyName !== "株式会社NEWGATE") successCount++
  if (data.billingTo?.department) successCount++
  if (data.billingTo?.contactPerson) successCount++

  // 発行元 (5項目)
  totalCount += 5
  if (data.issuerInfo?.name && data.issuerInfo.name !== "インポート元企業") successCount++
  if (data.issuerInfo?.address) successCount++
  if (data.issuerInfo?.phone) successCount++
  if (data.issuerInfo?.email) successCount++
  if (data.issuerInfo?.registrationNumber) successCount++

  // 金額 (3項目)
  totalCount += 3
  if (data.amountInfo?.subtotal && data.amountInfo.subtotal > 0) successCount++
  if (data.amountInfo?.taxAmount !== undefined && data.amountInfo.taxAmount >= 0) successCount++
  if (data.amountInfo?.totalAmount && data.amountInfo.totalAmount > 0) successCount++

  // 明細 (1項目)
  totalCount += 1
  if (data.lineItems && data.lineItems.length > 0) successCount++

  // 支払条件 (1項目 - dueDateまたはbankInfoのいずれか)
  totalCount += 1
  const hasPaymentTerms = data.paymentTerms?.dueDate ||
    data.paymentTerms?.bankName ||
    data.paymentTerms?.branchName ||
    data.paymentTerms?.accountNumber
  if (hasPaymentTerms) successCount++

  // 信頼度スコアを計算
  const confidence = totalCount > 0 ? successCount / totalCount : 0
  return Math.round(confidence * 100) / 100
}

/**
 * PDFから抽出されたテキストをInvoiceData型に変換するOCR抽出関数
 *
 * @param text - OCRで抽出されたテキスト
 * @param fileName - 元のファイル名
 * @param fileHash - ファイルのSHA-256ハッシュ値
 * @returns InvoiceData型の請求書データ
 */
export function extractInvoiceData(
  text: string,
  fileName: string,
  fileHash: string
): InvoiceData {
  // テキストの正規化
  const normalizedText = normalizeOCRText(text)
  const lines = normalizedText.split("\n")

  // 各フィールドを抽出
  const invoiceNumber = extractInvoiceNumber(normalizedText)
  const issueDate = extractIssueDate(normalizedText)
  const dueDate = extractDueDate(normalizedText)
  const clientName = extractClientName(normalizedText, lines)
  const issuerInfo = extractIssuerInfo(normalizedText, lines)
  const amounts = extractAmounts(normalizedText)
  const lineItems = extractLineItems(normalizedText, lines)
  const paymentInfo = extractPaymentInfo(normalizedText)

  // 現在のタイムスタンプ
  const now = new Date().toISOString()

  // InvoiceBasicInfo の構築
  const basicInfo: InvoiceBasicInfo = {
    invoiceNumber: invoiceNumber || null,
    issueDate: issueDate || null,
    transactionDate: issueDate || null,
    currency: "JPY",
    subject: null,
    orderNumber: null,
  }

  // BillingTo の構築
  const billingTo: BillingTo = {
    companyName: clientName || "不明",
    department: null,
    contactPerson: null,
  }

  // TaxBreakdown の構築
  const taxBreakdown: TaxBreakdown[] = amounts.taxAmount > 0 ? [{
    rate: amounts.taxRate,
    amount: amounts.taxAmount,
    taxableAmount: amounts.subtotal,
  }] : []

  // AmountInfo の構築
  const amountInfo: AmountInfo = {
    subtotal: amounts.subtotal,
    taxAmount: amounts.taxAmount,
    totalAmount: amounts.totalAmount,
    taxBreakdown,
    taxExempt: amounts.taxAmount === 0,
  }

  // PaymentTerms の構築
  const paymentTerms: PaymentTerms = {
    dueDate: dueDate || null,
    paymentCondition: null,
    bankName: paymentInfo.bankName || null,
    branchName: paymentInfo.branchName || null,
    accountType: paymentInfo.accountType || null,
    accountNumber: paymentInfo.accountNumber || null,
    accountHolder: paymentInfo.accountHolder || null,
    feeBearer: null,
  }

  // ReconciliationKeys の構築
  const reconciliationKeys: ReconciliationKeys = {
    normalizedIssuerName: normalizeCompanyName(issuerInfo?.name || ""),
    orderNumber: null,
    billingPeriod: {
      start: null,
      end: null,
    },
    totalAmount: amounts.totalAmount,
    projectName: null,
    contactPerson: null,
  }

  // InvoiceMetadata の構築（仮の信頼度）
  const metadata: InvoiceMetadata = {
    receiptMethod: "upload",
    source: fileName.toLowerCase().endsWith(".pdf") ? "pdf_import" : "image_import",
    receiptDateTime: now,
    registeredBy: "system",
    sourceEmail: null,
    fileHash,
    storagePath: `invoices/${fileHash}`,
    ocrConfidence: 0.75, // 仮の値、後で更新
    version: 1,
    createdAt: now,
    updatedAt: now,
    isReadonly: true,
    pdfStorageLocation: "none",
    status: "draft",
  }

  // InvoiceData の構築
  const invoiceData: InvoiceData = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    basicInfo,
    issuerInfo,
    billingTo,
    amountInfo,
    lineItems,
    paymentTerms,
    reconciliationKeys,
    metadata,
  }

  // 必須項目のバリデーションと警告
  const companyName = issuerInfo?.name
  const totalAmount = amounts.totalAmount

  if (!companyName || companyName === "インポート元企業") {
    console.warn('[OCR] 必須項目が抽出できませんでした: companyName')
  }

  if (!totalAmount || totalAmount === 0) {
    console.warn('[OCR] 必須項目が抽出できませんでした: totalAmount')
  }

  // 信頼度スコアを計算して設定
  const confidenceScore = calculateConfidenceScore(invoiceData)
  invoiceData.metadata.ocrConfidence = confidenceScore

  return invoiceData
}

/**
 * OCR認識テキストの正規化
 */
function normalizeOCRText(text: string): string {
  // バックスラッシュ付き数値を正規化
  text = text.replace(/\\(\d+)\.(\d{3})/g, '$1,$2')
  
  // ピリオド区切りの3桁数値をカンマに変換
  text = text.replace(/(\d{1,3})\.(\d{3})/g, '$1,$2')
  
  // 連続するピリオド区切りも対応
  let prevText = ''
  while (prevText !== text) {
    prevText = text
    text = text.replace(/(\d),(\d{3})\.(\d{3})/g, '$1,$2,$3')
  }
  
  return text
}

/**
 * 請求書番号の抽出
 * Phase 1強化: より多様なパターンに対応
 */
function extractInvoiceNumber(text: string): string | null {
  const patterns = [
    /(?:請求書番号|請求No|Invoice\s*No\.?|Invoice\s*Number|請求書\s*No\.?)[:\s：#]*([A-Z0-9\-_]+)/i,
    /(?:No\.?|番号)[:\s：]*([A-Z0-9\-_]+)/i,
    /(?:請求書)[:\s：]+([A-Z0-9\-_]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const number = match[1].trim()
      // 最低3文字以上、かつ英数字とハイフンのみ
      if (number.length >= 3 && /^[A-Z0-9\-_]+$/i.test(number)) {
        return number
      }
    }
  }
  
  return null
}

/**
 * 発行日の抽出
 * Phase 1強化: 請求日、発行日、請求書日付などのキーワードに対応
 */
function extractIssueDate(text: string): string | null {
  // ラベル付き日付パターン
  const labeledPatterns = [
    /(?:請求日|発行日|請求書日付|作成日|発行年月日)[:\s：]*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/,
    /(?:請求日|発行日|請求書日付|作成日|発行年月日)[:\s：]*(\d{4})\.(\d{1,2})\.(\d{1,2})/,
  ]
  
  for (const pattern of labeledPatterns) {
    const match = text.match(pattern)
    if (match) {
      const [, year, month, day] = match
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }
  }
  
  // ラベルなし日付パターン（最初の日付を使用）
  const datePattern = /(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/
  const match = text.match(datePattern)
  
  if (match) {
    const [, year, month, day] = match
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  
  return null
}

/**
 * 支払期日/取引日の抽出
 * Phase 1強化: お支払期限、役務提供日、納品日などのキーワードに対応
 */
function extractDueDate(text: string): string | null {
  // ラベル付き日付パターン（優先度順）
  const labeledPatterns = [
    /(?:お支払期限|支払期限|お支払い期限|支払い期限|期限|Due\s*Date)[:\s：]*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/i,
    /(?:役務提供日|納品日|取引日|お取引日)[:\s：]*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/,
    /(?:お支払期限|支払期限|お支払い期限|支払い期限|期限|Due\s*Date)[:\s：]*(\d{4})\.(\d{1,2})\.(\d{1,2})/i,
  ]
  
  for (const pattern of labeledPatterns) {
    const match = text.match(pattern)
    if (match) {
      const [, year, month, day] = match
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    }
  }
  
  // フォールバック: 2番目の日付を期限日と仮定
  const datePattern = /(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/g
  const dates = Array.from(text.matchAll(datePattern))
  
  if (dates.length > 1) {
    const [, year, month, day] = dates[1]
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }
  
  return null
}

/**
 * 請求先企業名の抽出
 * Phase 2強化: 「御中」「様」が付いた行を検索、デフォルト値の設定
 */
function extractClientName(text: string, lines: string[]): string | null {
  // 「請求先」キーワードを含む行のインデックスを検索
  let billingToIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/\s+/g, '').includes('請求先')) {
      billingToIndex = i
      break
    }
  }

  // 拡張された法人格パターン
  const corporatePattern = /株\s*式\s*会\s*社|有\s*限\s*会\s*社|合\s*同\s*会\s*社|合\s*資\s*会\s*社|一\s*般\s*社\s*団\s*法\s*人|一\s*般\s*財\s*団\s*法\s*人|公\s*益\s*社\s*団\s*法\s*人|公\s*益\s*財\s*団\s*法\s*人/

  // 「請求先」の次の行から最大3行先まで探索
  if (billingToIndex !== -1) {
    const maxSearchLines = 3
    for (let offset = 1; offset <= maxSearchLines && billingToIndex + offset < lines.length; offset++) {
      const line = lines[billingToIndex + offset].trim()
      
      if (!line || /^(様|御中|殿)$/.test(line)) {
        continue
      }

      if (corporatePattern.test(line)) {
        let cleanedLine = line.replace(/\s+/g, '')
        cleanedLine = cleanedLine.replace(/(?:様|御中|殿)$/, '').trim()
        return cleanedLine
      }
    }

    // 法人格が見つからない場合、敬称以外の最初の行を返す
    for (let offset = 1; offset <= maxSearchLines && billingToIndex + offset < lines.length; offset++) {
      const line = lines[billingToIndex + offset].trim()
      
      if (!line || /^(様|御中|殿)$/.test(line)) {
        continue
      }

      let cleanedLine = line.replace(/\s+/g, '')
      cleanedLine = cleanedLine.replace(/(?:様|御中|殿)$/, '').trim()
      
      if (cleanedLine.length >= 2) {
        return cleanedLine
      }
    }
  }

  // Phase 2: 「御中」「様」が付いた行を検索
  const honorificsPatterns = [
    /([^\n]+?)(?:御中)/,
    /([^\n]+?)(?:様)/,
    /([^\n]+?)(?:殿)/,
  ]
  
  for (const pattern of honorificsPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let clientName = match[1].trim()
      // 「請求先:」などのラベルを除去
      clientName = clientName.replace(/^(?:請求先|宛先|TO|To)[:\s：]*/, '')
      clientName = clientName.replace(/\s+/g, '')
      
      if (clientName.length >= 2 && clientName.length <= 50) {
        return clientName
      }
    }
  }

  // Phase 2: デフォルト値として「株式会社NEWGATE」を設定
  return "株式会社NEWGATE"
}

/**
 * 発行元情報の抽出
 * Phase 1強化: メールアドレスフィールドを追加
 */
function extractIssuerInfo(text: string, lines: string[]): IssuerInfo | undefined {
  const registrationNumber = extractRegistrationNumber(text)
  const issuerName = extractIssuerName(text)
  const issuerAddress = extractIssuerAddress(text)
  const issuerPhone = extractIssuerPhone(text)
  const issuerEmail = extractIssuerEmail(text)

  if (!registrationNumber && !issuerName) {
    return undefined
  }

  return {
    name: issuerName || "インポート元企業",
    address: issuerAddress,
    phone: issuerPhone,
    email: issuerEmail,
    registrationNumber: registrationNumber || undefined,
  }
}

/**
 * 発行元メールアドレスの抽出（内部関数）
 */
function extractIssuerEmail(text: string): string | undefined {
  const result = extractEmail(text)
  return result || undefined
}

/**
 * 発行元企業名の抽出
 * Phase 1強化: 多様な法人格に対応、最初の数行から企業名を抽出
 */
function extractIssuerName(text: string): string | null {
  const clientPattern = /([^\n]+?)(?:様|御中|宛)/
  const clientMatch = text.match(clientPattern)
  
  let searchText = text
  if (clientMatch) {
    const clientIndex = text.indexOf(clientMatch[0])
    if (clientIndex !== -1) {
      searchText = text.substring(clientIndex + clientMatch[0].length)
    }
  }
  
  const normalizedText = searchText.replace(/\s+/g, '')
  
  // 拡張された法人格パターン
  const companyPatterns = [
    // 前株
    /株式会社([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /合同会社([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /合資会社([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /有限会社([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /一般社団法人([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /一般財団法人([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /公益社団法人([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    /公益財団法人([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
    // 後株
    /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})株式会社/,
    /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})合同会社/,
    /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})合資会社/,
    /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})有限会社/,
  ]
  
  for (const pattern of companyPatterns) {
    const match = normalizedText.match(pattern)
    if (match) {
      const companyName = match[0]
      if (companyName.length >= 4 && companyName.length <= 40) {
        return companyName
      }
    }
  }
  
  return null
}

/**
 * 発行元住所の抽出
 * Phase 1強化: 〒や郵便番号パターンの改善
 */
function extractIssuerAddress(text: string): string | undefined {
  const issuerName = extractIssuerName(text)
  const normalizedText = text.replace(/\s+/g, '')
  
  let searchText = normalizedText
  if (issuerName) {
    const issuerNameIndex = normalizedText.indexOf(issuerName)
    if (issuerNameIndex !== -1) {
      searchText = normalizedText.substring(issuerNameIndex + issuerName.length)
    }
  }
  
  // 〒郵便番号から始まる住所を抽出（改善版）
  const postalPatterns = [
    /〒\s*(\d{3}[-−ー]?\d{4})\s*([^TEL電話]+)/,
    /郵便番号[:\s：]*(\d{3}[-−ー]?\d{4})\s*([^TEL電話]+)/,
    /〒?\d{3}[-−ー]?\d{4}([^TEL電話]+)/,
  ]
  
  for (const pattern of postalPatterns) {
    const match = searchText.match(pattern)
    if (match) {
      let address = match[0]
      address = address.replace(/TEL.*/g, '').replace(/電話.*/g, '').trim()
      if (address.length > 5) {
        return address
      }
    }
  }
  
  // 都道府県から始まるパターン
  const prefecturePattern = /(東京都|北海道|(?:京都|大阪)府|.{2,3}県)[^\nTEL電話]+/
  const match2 = searchText.match(prefecturePattern)
  
  if (match2) {
    let address = match2[0]
    address = address.replace(/TEL.*/g, '').replace(/電話.*/g, '').trim()
    if (address.length > 3) {
      return address
    }
  }
  
  return undefined
}

/**
 * 発行元電話番号の抽出
 * Phase 1強化: ハイフンやカッコ付きに対応、より柔軟なパターン
 */
/**
 * 発行元電話番号の抽出（内部関数）
 */
function extractIssuerPhone(text: string): string | undefined {
  const result = extractPhoneNumber(text)
  return result || undefined
}

/**
 * 金額情報の抽出
 * Phase 3強化: 小計、消費税、合計、税率別内訳のパターン改善
 */
function extractAmounts(text: string): {
  subtotal: number
  taxAmount: number
  totalAmount: number
  taxRate: number
} {
  const isValidAmount = (num: number) => num >= 100 && num <= 100000000

  // Phase 3: 合計金額の抽出（拡張パターン）
  let total = 0
  const totalPatterns = [
    /(?:合計金額|合計|総額|御請求額|ご請求額|請求金額|請求額|Total|TOTAL)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /(?:金額|Amount)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /¥\s*([0-9,，]+)\s*(?:円|JPY|yen)/i,
  ]
  
  for (const pattern of totalPatterns) {
    const match = text.match(pattern)
    if (match) {
      const numValue = match[1].replace(/[,，]/g, "")
      const amount = Number(numValue)
      if (!isNaN(amount) && isValidAmount(amount)) {
        total = amount
        break
      }
    }
  }

  // Phase 3: 小計の抽出（拡張パターン）
  let subtotal = 0
  const subtotalPatterns = [
    /(?:小計金額|小計|Subtotal|SUBTOTAL)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /(?:税抜金額|税抜き金額|税抜|税抜き|税別金額|税別)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /(?:課税対象額)[:\s：¥\\￥円]*([0-9,，]+)/i,
  ]
  
  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern)
    if (match) {
      const numValue = match[1].replace(/[,，]/g, "")
      const amount = Number(numValue)
      if (!isNaN(amount) && isValidAmount(amount)) {
        subtotal = amount
        break
      }
    }
  }

  // Phase 3: 消費税の抽出（拡張パターン）
  let tax = 0
  const taxPatterns = [
    /(?:消費税額|消費税|税額|Tax|TAX|VAT)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /(?:税金|内税|外税)[:\s：¥\\￥円]*([0-9,，]+)/i,
    /(?:10%消費税|8%消費税)[:\s：¥\\￥円]*([0-9,，]+)/i,
  ]
  
  for (const pattern of taxPatterns) {
    const match = text.match(pattern)
    if (match) {
      const numValue = match[1].replace(/[,，]/g, "")
      const amount = Number(numValue)
      if (!isNaN(amount) && isValidAmount(amount)) {
        tax = amount
        break
      }
    }
  }

  // Phase 3: 税率別内訳の抽出（正規化処理を追加）
  const taxBreakdownPattern = /(?:10%|8%)(?:対象|税率|消費税)[:\s：¥\\￥円]*([0-9,，]+)/gi
  const taxBreakdowns = Array.from(text.matchAll(taxBreakdownPattern))
  
  let detectedTaxRate = 10 // デフォルト税率
  if (taxBreakdowns.length > 0) {
    for (const breakdown of taxBreakdowns) {
      const rateMatch = breakdown[0].match(/(\d+)%/)
      if (rateMatch) {
        // 税率テキストを正規化: 「10%」→ 数値10
        const normalized = rateMatch[1].replace("%", "").trim()
        detectedTaxRate = Number(normalized)
        break
      }
    }
  }

  // 金額が見つからない場合のフォールバック
  if (total === 0) {
    const commaNumbers = text.match(/([0-9]{1,3}(?:[,，][0-9]{3})+)/g)
    if (commaNumbers && commaNumbers.length > 0) {
      const validNumbers = commaNumbers
        .map(n => Number(n.replace(/[,，]/g, "")))
        .filter(n => !isNaN(n) && isValidAmount(n))
      
      if (validNumbers.length > 0) {
        total = Math.max(...validNumbers)
      }
    }
  }

  // 金額の計算と税率の推定（正規化済み税率を使用）
  let finalSubtotal: number
  let finalTax: number
  let taxRate: number

  if (subtotal > 0 && tax > 0) {
    finalSubtotal = subtotal
    finalTax = tax
    // 税率を数値（10や8など）として計算
    taxRate = subtotal > 0 ? (tax / subtotal) * 100 : detectedTaxRate
  } else if (subtotal > 0) {
    finalSubtotal = subtotal
    finalTax = total - subtotal
    taxRate = subtotal > 0 ? ((total - subtotal) / subtotal) * 100 : detectedTaxRate
  } else if (tax > 0) {
    finalTax = tax
    finalSubtotal = total - tax
    taxRate = (total - tax) > 0 ? (tax / (total - tax)) * 100 : detectedTaxRate
  } else {
    // 検出された税率を使用（既に数値10として正規化済み）
    const taxMultiplier = 1 + (detectedTaxRate / 100)
    finalSubtotal = Math.round(total / taxMultiplier)
    finalTax = total - finalSubtotal
    taxRate = detectedTaxRate
  }

  return {
    subtotal: finalSubtotal,
    taxAmount: finalTax,
    totalAmount: total,
    // taxRateは10や8などの数値として返す（画面表示では「10%」になる）
    taxRate: Math.round(taxRate * 10) / 10,
  }
}

/**
 * 明細行の抽出
 * Phase 4強化: 表形式データの検出と解析、品目・数量・単価・金額のパターン改善
 */
function extractLineItems(text: string, lines: string[]): LineItem[] {
  const items: LineItem[] = []
  
  // Phase 4: ヘッダー行を検出（拡張パターン）
  let headerLineIndex = -1
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    if (!trimmedLine) continue
    
    // 合計行などはスキップ
    if (/^(?:合計|小計|消費税|税額|総額|御請求額|税|Total|Subtotal|Tax)/i.test(trimmedLine)) {
      continue
    }
    
    if (/件\s*名\s*:/.test(trimmedLine)) {
      continue
    }
    
    // Phase 4: 拡張されたヘッダー検出パターン
    const hasItemName = /品\s*名|摘\s*要|商\s*品|品\s*目|科\s*目|項\s*目|内\s*容|Description|Item/.test(trimmedLine)
    const hasQuantity = /数\s*量|個\s*数|Quantity|Qty|数/.test(trimmedLine)
    const hasUnitPrice = /単\s*価|Unit\s*Price|Price/.test(trimmedLine)
    const hasAmount = /金\s*額|合計|小計|Amount/.test(trimmedLine)
    
    // パイプ区切りテーブル
    const isPipeTable = /\|/.test(trimmedLine) && trimmedLine.split('|').length >= 4
    
    // タブ区切りテーブル
    const isTabTable = /\t/.test(trimmedLine) && trimmedLine.split('\t').length >= 3
    
    // スペース区切りで複数カラムがある
    const hasMultipleColumns = trimmedLine.split(/\s{2,}/).length >= 3
    
    if ((hasItemName && (hasQuantity || hasAmount)) ||
        (isPipeTable && trimmedLine.split('|').length >= 3) ||
        (isTabTable) ||
        (hasItemName && hasMultipleColumns)) {
      headerLineIndex = i
      break
    }
  }
  
  if (headerLineIndex === -1) {
    return []
  }

  // Phase 4: ヘッダーの次の行から明細データを抽出（改善版）
  for (let i = headerLineIndex + 1; i < lines.length && items.length < 20; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    // 合計・小計行で終了
    if (/^(?:合計|小計|消費税|税|総額|御請求額|Total|Subtotal|Tax|は\s*\||油\s*生|時\s*トト)/i.test(line)) {
      break
    }

    // 支払情報などの行はスキップ
    if (/(?:支払|振込|振込先|支払期限|期限|お支払|銀行|支店|口座|名義|登録番号|TEL|FAX|担当|〒|住所|※)/i.test(line)) {
      continue
    }

    // 空白やパイプのみの行はスキップ
    if (/^[\s\|]+$/.test(line)) {
      continue
    }

    // 数字と記号のみの行はスキップ（ただし品名がある可能性も考慮）
    if (/^[¥\\￥,，0-9\s\|]+$/.test(line) && !/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(line)) {
      continue
    }

    // Phase 4: 価格パターンの拡張検出
    const hasPrice = /[¥\\￥]\s*[\d,，]+|\d{1,3}[,，]\d{3}/.test(line)
    const hasLargeNumber = /\d{4,}/.test(line)
    
    if (hasPrice || hasLargeNumber) {
      const item = processLineItem(line)
      if (item) {
        items.push(item)
      }
    }
  }
  
  return items
}

/**
 * 行から明細データを抽出
 * Phase 4強化: 品目、数量、単価、金額のパターンマッチング改善
 */
function processLineItem(line: string): LineItem | null {
  const normalizedLine = line.replace(/\s+/g, ' ').trim()
  
  // Phase 4: パイプ区切りやタブ区切りの処理
  let parts: string[] = []
  if (/\|/.test(normalizedLine)) {
    parts = normalizedLine.split('|').map(p => p.trim()).filter(p => p)
  } else if (/\t/.test(normalizedLine)) {
    parts = normalizedLine.split('\t').map(p => p.trim()).filter(p => p)
  } else {
    // スペース区切りの場合
    parts = normalizedLine.split(/\s{2,}/).map(p => p.trim()).filter(p => p)
  }

  // Phase 4: 品名を抽出（改善版）
  let description = ''
  
  // パイプ/タブ区切りの場合、最初の要素を品名とする
  if (parts.length >= 2) {
    description = parts[0]
    // 先頭の番号を削除
    description = description.replace(/^[\d０-９]+[\s　.．)\)）]*/, '')
  } else {
    // スペース区切りの場合、従来の方法
    let cleanedLine = normalizedLine
      .replace(/\\?\d{1,3}(?:[,，]\d{3})+/g, '')
      .replace(/\\?\d{4,}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    
    const descriptionPattern = /^([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９\s（）()【】・ー\-\/]+)/
    const descMatch = cleanedLine.match(descriptionPattern)
    
    if (descMatch) {
      description = descMatch[1].replace(/\s+/g, ' ').trim()
      description = description.replace(/\(\s*\)|（\s*）/g, '').trim()
      // 先頭の番号を削除
      description = description.replace(/^[\d０-９]+[\s　.．)\)）]*/, '')
    }
  }
  
  if (!description || description.length < 2) {
    return null
  }

  // Phase 4: 数量の抽出（改善版）
  let quantity: number | null = null
  
  // パターン1: 明示的な数量パターン
  const quantityPatterns = [
    /(?:数量|個数|Qty|Quantity)[:\s：]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:個|本|枚|台|式|件|回|時間|日)/,
    /(?:10%|8%|\d+%)\s+(\d+)/,
  ]
  
  for (const pattern of quantityPatterns) {
    const match = normalizedLine.match(pattern)
    if (match) {
      quantity = parseFloat(match[1])
      break
    }
  }
  
  // パイプ/タブ区切りの場合、2番目の要素を数量として試す
  if (!quantity && parts.length >= 3) {
    const potentialQty = parseFloat(parts[1])
    if (!isNaN(potentialQty) && potentialQty > 0 && potentialQty < 10000) {
      quantity = potentialQty
    }
  }

  // Phase 4: 金額の抽出（改善版）
  const commaNumbers = normalizedLine.match(/\\?\d{1,3}(?:[,，]\d{3})+/g)
  const largeNumbers = normalizedLine.match(/\\?\d{4,}/g)
  
  const allNumbers: string[] = []
  
  if (commaNumbers) {
    commaNumbers.forEach(n => {
      const cleaned = n.replace(/[\\,，]/g, '')
      if (cleaned.length >= 3) {
        allNumbers.push(cleaned)
      }
    })
  }
  
  if (largeNumbers) {
    largeNumbers.forEach(n => {
      const cleaned = n.replace(/\\/g, '')
      // 数量として使われた数値は除外
      const numValue = parseFloat(cleaned)
      if (numValue === quantity) return
      
      if (!allNumbers.includes(cleaned) && cleaned.length >= 3) {
        allNumbers.push(cleaned)
      }
    })
  }

  // Phase 4: 単価と金額の判定
  let unitPrice: number | null = null
  let amount: number = 0
  
  if (allNumbers.length >= 2) {
    // 最初の数値を単価、最後の数値を金額とする
    unitPrice = parseFloat(allNumbers[0])
    amount = parseFloat(allNumbers[allNumbers.length - 1])
  } else if (allNumbers.length === 1) {
    amount = parseFloat(allNumbers[0])
    // 数量がある場合、単価を計算
    if (quantity && quantity > 0) {
      unitPrice = Math.round(amount / quantity)
    }
  }

  // Phase 4: 税率の抽出
  let taxRate: number | null = null
  const taxRateMatch = normalizedLine.match(/(10|8)%/)
  if (taxRateMatch) {
    taxRate = parseFloat(taxRateMatch[1])
  }

  return {
    id: `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description,
    quantity,
    unit: null,
    unitPrice,
    amount,
    taxRate,
    taxAmount: null,
    remarks: null,
  }
}

/**
 * 支払情報の抽出
 */
function extractPaymentInfo(text: string): {
  bankName?: string
  branchName?: string
  accountType?: string
  accountNumber?: string
  accountHolder?: string
} {
  const paymentInfo: {
    bankName?: string
    branchName?: string
    accountType?: string
    accountNumber?: string
    accountHolder?: string
  } = {}

  // 銀行名の抽出
  const bankNamePattern = /([ぁ-んァ-ヶー一-龠\s]{3,20}銀\s*行)/
  const bankMatch = text.match(bankNamePattern)
  
  if (bankMatch) {
    const bankName = bankMatch[1].replace(/\s+/g, "").trim()
    if (bankName.length >= 3 && bankName.length <= 15 && bankName.includes('銀行')) {
      paymentInfo.bankName = bankName
    }
  }

  // 支店名の抽出
  const branchNamePattern = /([ぁ-んァ-ヶー一-龠\s]{3,20}(?:支\s*店|支\s*所))/
  const branchMatch = text.match(branchNamePattern)
  
  if (branchMatch) {
    const branchName = branchMatch[1].replace(/\s+/g, "").trim()
    if (branchName.length >= 3 && branchName.length <= 15 &&
        (branchName.includes('支店') || branchName.includes('支所'))) {
      paymentInfo.branchName = branchName
    }
  }

  // 口座種別の抽出
  const accountTypePatterns = [
    /(?:普通|普通預金|Savings|savings)/,
    /(?:当座|当座預金|Checking|checking)/,
  ]
  
  for (const pattern of accountTypePatterns) {
    const match = text.match(pattern)
    if (match) {
      const accountType = match[0].trim()
      const normalizedType = accountType.includes('当座') || accountType.toLowerCase().includes('checking')
        ? '当座預金'
        : '普通預金'
      paymentInfo.accountType = normalizedType
      break
    }
  }

  // 口座番号の抽出
  const accountNumberPatterns = [
    /(?:口座番号|口座No|Account|account)[:\s#]*([0-9]{5,8})/i,
    /(?:No|NO)[:\s]*([0-9]{7})/,
  ]
  
  for (const pattern of accountNumberPatterns) {
    const match = text.match(pattern)
    if (match) {
      const accountNumber = match[1].trim()
      if (accountNumber.length >= 5 && accountNumber.length <= 8) {
        paymentInfo.accountNumber = accountNumber
        break
      }
    }
  }

  // 口座名義の抽出
  const accountHolderPatterns = [
    /(?:口座名義|名義|名義人)[:\s]*([ァ-ヴー\s]+)/,
    /(?:カナ|カナ氏名)[:\s]*([ァ-ヴー\s]+)/,
  ]
  
  for (const pattern of accountHolderPatterns) {
    const match = text.match(pattern)
    if (match) {
      const accountHolder = match[1].trim().replace(/\s+/g, ' ')
      if (accountHolder.length > 0 && accountHolder.length < 50) {
        paymentInfo.accountHolder = accountHolder
        break
      }
    }
  }

  return paymentInfo
}
