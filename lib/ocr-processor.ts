import Tesseract from "tesseract.js"
import { OCRResult, FieldExtraction } from "./types"

/**
 * OCR処理クラス
 */
export class OCRProcessor {
  private worker: Tesseract.Worker | null = null

  /**
   * OCRワーカーの初期化
   */
  async initialize(): Promise<void> {
    if (this.worker) return

    this.worker = await Tesseract.createWorker("jpn", 1, {
      logger: (m) => console.log("OCR進捗:", m),
    })
  }

  /**
   * OCR認識テキストの正規化
   * - バックスラッシュ付き数値の正規化
   * - ピリオド区切り数値をカンマ区切りに変換
   */
  private normalizeOCRText(text: string): string {
    // バックスラッシュ付き数値を正規化
    // 例: \\204.040 → 204,040
    text = text.replace(/\\(\d+)\.(\d{3})/g, '$1,$2')
    
    // ピリオド区切りの3桁数値をカンマに変換
    // 例: 204.040 → 204,040
    text = text.replace(/(\d{1,3})\.(\d{3})/g, '$1,$2')
    
    // 連続するピリオド区切りも対応
    // 例: 1.234.567 → 1,234,567
    let prevText = ''
    while (prevText !== text) {
      prevText = text
      text = text.replace(/(\d),(\d{3})\.(\d{3})/g, '$1,$2,$3')
    }
    
    return text
  }

  /**
   * 複数行にわたる品名を結合
   * - 括弧の開閉をチェック
   * - 不完全な行を次の行と結合
   */
  private mergeMultilineDescriptions(lines: string[]): string[] {
    const merged: string[] = []
    let pendingLine = ''
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        merged.push(line)
        continue
      }
      
      if (pendingLine) {
        // 保留中の行がある場合は結合
        pendingLine += trimmedLine
        
        // 括弧が閉じたかチェック
        const openParens = (pendingLine.match(/[（(]/g) || []).length
        const closeParens = (pendingLine.match(/[）)]/g) || []).length
        
        if (openParens === closeParens) {
          merged.push(pendingLine)
          pendingLine = ''
        }
      } else {
        // 括弧が開いているが閉じていない
        const openParens = (trimmedLine.match(/[（(]/g) || []).length
        const closeParens = (trimmedLine.match(/[）)]/g) || []).length
        
        if (openParens > closeParens) {
          pendingLine = trimmedLine
        } else {
          merged.push(line)
        }
      }
    }
    
    // 未処理の保留行があれば追加
    if (pendingLine) {
      merged.push(pendingLine)
    }
    
    return merged
  }

  /**
   * 画像からテキストを抽出
   */
  async extractText(imageData: string | HTMLImageElement): Promise<string> {
    if (!this.worker) {
      await this.initialize()
    }

    const result = await this.worker!.recognize(imageData)
    return result.data.text
  }

  /**
   * 画像からOCR処理を実行し、請求書データを抽出
   */
  async processInvoice(imageData: string | HTMLImageElement): Promise<OCRResult> {
    const startTime = performance.now()

    if (!this.worker) {
      await this.initialize()
    }

    const result = await this.worker!.recognize(imageData)
    let text = result.data.text
    const confidence = result.data.confidence / 100

    // テキストの正規化を適用
    text = this.normalizeOCRText(text)

    const processingTime = performance.now() - startTime

    // テキストから請求書情報を抽出
    const extractedFields = this.parseInvoiceFields(text)

    return {
      confidence,
      processingTime,
      extractedFields,
    }
  }

  /**
   * テキストから請求書フィールドを解析
   */
  private parseInvoiceFields(text: string): OCRResult["extractedFields"] {
    console.log('=== OCR認識テキスト（正規化後） ===');
    console.log(text);
    console.log('====================');
    
    let lines = text.split("\n")
    
    // 複数行にわたる品名を結合
    lines = this.mergeMultilineDescriptions(lines)
    
    const fields: OCRResult["extractedFields"] = {}

    // 請求書番号を抽出
    const invoiceNumberPattern = /(?:請求書|請求書番号|Invoice|No)[:\s#]*([A-Z0-9\-]+)/i
    const invoiceMatch = text.match(invoiceNumberPattern)
    if (invoiceMatch) {
      fields.invoiceNumber = {
        value: invoiceMatch[1],
        confidence: 0.85,
      }
    }

    // 顧客名を抽出（"宛" "様" "御中" などのキーワード付近）
    const clientPattern = /([^\n]+?)(?:様|御中|宛)/
    const clientMatch = text.match(clientPattern)
    if (clientMatch) {
      fields.clientName = {
        value: clientMatch[1].trim(),
        confidence: 0.8,
      }
    }

    // 日付を抽出
    const datePattern = /(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})[日]?/g
    const dates = Array.from(text.matchAll(datePattern))
    if (dates.length > 0) {
      // 最初の日付を発行日と仮定
      const [, year, month, day] = dates[0]
      fields.issueDate = {
        value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
        confidence: 0.8,
      }

      // 2番目の日付を期限日と仮定
      if (dates.length > 1) {
        const [, year2, month2, day2] = dates[1]
        fields.dueDate = {
          value: `${year2}-${month2.padStart(2, "0")}-${day2.padStart(2, "0")}`,
          confidence: 0.8,
        }
      }
    }

    // 妥当な金額範囲チェック関数（100円〜1億円）
    const isValidAmount = (num: number) => num >= 100 && num <= 100000000

    // 金額を抽出（合計、小計、税） - 改善版
    // 合計金額の抽出
    const totalPatterns = [
      /(?:合計|総額|御請求額|請求額|Total)[:\s¥\\￥円]*([0-9,，]+)/i,
      /(?:金額|Amount)[:\s¥\\￥円]*([0-9,，]+)/i,
      /¥\s*([0-9,，]+)\s*(?:円|JPY|yen)/i,
    ]
    
    for (const pattern of totalPatterns) {
      const match = text.match(pattern)
      if (match) {
        const numValue = match[1].replace(/[,，]/g, "")
        const amount = Number(numValue)
        if (!isNaN(amount) && isValidAmount(amount)) {
          fields.total = {
            value: numValue,
            confidence: 0.9,
          }
          break
        }
      }
    }

    // 小計の抽出
    const subtotalPatterns = [
      /(?:小計|Subtotal)[:\s¥\\￥円]*([0-9,，]+)/i,
      /(?:税抜|税抜き|税別)[:\s¥\\￥円]*([0-9,，]+)/i,
    ]
    
    for (const pattern of subtotalPatterns) {
      const match = text.match(pattern)
      if (match) {
        const numValue = match[1].replace(/[,，]/g, "")
        const amount = Number(numValue)
        if (!isNaN(amount) && isValidAmount(amount)) {
          fields.subtotal = {
            value: numValue,
            confidence: 0.9,
          }
          break
        }
      }
    }

    // 消費税の抽出
    const taxPatterns = [
      /(?:消費税|税額|Tax)[:\s¥\\￥円]*([0-9,，]+)/i,
      /(?:税|VAT)[:\s¥\\￥円]*([0-9,，]+)/i,
    ]
    
    for (const pattern of taxPatterns) {
      const match = text.match(pattern)
      if (match) {
        const numValue = match[1].replace(/[,，]/g, "")
        const amount = Number(numValue)
        if (!isNaN(amount) && isValidAmount(amount)) {
          fields.tax = {
            value: numValue,
            confidence: 0.9,
          }
          break
        }
      }
    }

    // 金額が見つからない場合のフォールバック処理（改善版）
    if (!fields.total) {
      // 1. カンマ区切り数値を優先的に探す
      const commaNumbers = text.match(/([0-9]{1,3}(?:[,，][0-9]{3})+)/g)
      if (commaNumbers && commaNumbers.length > 0) {
        const validNumbers = commaNumbers
          .map(n => Number(n.replace(/[,，]/g, "")))
          .filter(n => !isNaN(n) && isValidAmount(n))
        
        if (validNumbers.length > 0) {
          const maxNumber = Math.max(...validNumbers)
          fields.total = {
            value: maxNumber.toString(),
            confidence: 0.6,
          }
        }
      }

      // 2. カンマ区切りが見つからない場合、4-8桁の数値を探す
      if (!fields.total) {
        const plainNumbers = text.match(/\b([0-9]{4,8})\b/g)
        if (plainNumbers && plainNumbers.length > 0) {
          const validNumbers = plainNumbers
            .map(n => Number(n))
            .filter(n => !isNaN(n) && isValidAmount(n))
          
          if (validNumbers.length > 0) {
            const maxNumber = Math.max(...validNumbers)
            fields.total = {
              value: maxNumber.toString(),
              confidence: 0.4,
            }
          }
        }
      }
    }

    // 支払情報の抽出
    // 銀行名の抽出（改善版 - 空白を許容）
    // パターン: 「○○銀行」（空白が混じっていても可）
    const bankNamePattern = /([ぁ-んァ-ヶー一-龠\s]{3,20}銀\s*行)/
    const bankMatch = text.match(bankNamePattern)
    
    if (bankMatch) {
      const bankName = bankMatch[1].replace(/\s+/g, "").trim()
      if (bankName.length >= 3 && bankName.length <= 15 && bankName.includes('銀行')) {
        fields.bankName = {
          value: bankName,
          confidence: 0.85,
        }
      }
    }

    // 支店名の抽出（改善版 - 空白を許容）
    // パターン: 「○○支店」または「○○支所」（空白が混じっていても可）
    const branchNamePattern = /([ぁ-んァ-ヶー一-龠\s]{3,20}(?:支\s*店|支\s*所))/
    
    // 銀行名が見つかった場合、その後ろから支店名を探す
    if (fields.bankName) {
      // 元のテキストから銀行名（空白あり）を探す
      const bankNameWithSpaces = text.match(bankNamePattern)
      if (bankNameWithSpaces) {
        const bankNameIndex = text.indexOf(bankNameWithSpaces[0])
        if (bankNameIndex !== -1) {
          const textAfterBank = text.substring(bankNameIndex + bankNameWithSpaces[0].length)
          const branchMatch = textAfterBank.match(branchNamePattern)
          if (branchMatch) {
            const branchName = branchMatch[1].replace(/\s+/g, "").trim()
            if (branchName.length >= 3 && branchName.length <= 15 &&
                (branchName.includes('支店') || branchName.includes('支所'))) {
              fields.branchName = {
                value: branchName,
                confidence: 0.85,
              }
            }
          }
        }
      }
    }
    
    // 銀行名が見つからなかった場合、テキスト全体から支店名を探す
    if (!fields.branchName) {
      const branchMatch = text.match(branchNamePattern)
      if (branchMatch) {
        const branchName = branchMatch[1].replace(/\s+/g, "").trim()
        if (branchName.length >= 3 && branchName.length <= 15 &&
            (branchName.includes('支店') || branchName.includes('支所'))) {
          fields.branchName = {
            value: branchName,
            confidence: 0.7,
          }
        }
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
        fields.accountType = {
          value: normalizedType,
          confidence: 0.85,
        }
        break
      }
    }

    // 口座番号の抽出（7桁程度の数字）
    const accountNumberPatterns = [
      /(?:口座番号|口座No|Account|account)[:\s#]*([0-9]{5,8})/i,
      /(?:No|NO)[:\s]*([0-9]{7})/,
    ]
    
    for (const pattern of accountNumberPatterns) {
      const match = text.match(pattern)
      if (match) {
        const accountNumber = match[1].trim()
        if (accountNumber.length >= 5 && accountNumber.length <= 8) {
          fields.accountNumber = {
            value: accountNumber,
            confidence: 0.85,
          }
          break
        }
      }
    }

    // 口座番号が見つからない場合、7桁の数字を探す
    if (!fields.accountNumber) {
      const sevenDigitPattern = /\b([0-9]{7})\b/
      const match = text.match(sevenDigitPattern)
      if (match) {
        fields.accountNumber = {
          value: match[1],
          confidence: 0.6,
        }
      }
    }

    // 口座名義の抽出（カタカナ表記）
    const accountHolderPatterns = [
      /(?:口座名義|名義|名義人)[:\s]*([ァ-ヴー\s]+)/,
      /(?:カナ|カナ氏名)[:\s]*([ァ-ヴー\s]+)/,
    ]
    
    for (const pattern of accountHolderPatterns) {
      const match = text.match(pattern)
      if (match) {
        const accountHolder = match[1].trim().replace(/\s+/g, ' ')
        if (accountHolder.length > 0 && accountHolder.length < 50) {
          fields.accountHolder = {
            value: accountHolder,
            confidence: 0.8,
          }
          break
        }
      }
    }

    // 口座名義が見つからない場合、カタカナのみの行を探す
    if (!fields.accountHolder) {
      const katakanaPattern = /^([ァ-ヴー\s]{3,30})$/m
      const match = text.match(katakanaPattern)
      if (match) {
        fields.accountHolder = {
          value: match[1].trim(),
          confidence: 0.5,
        }
      }
    }

    // 🆕 適格請求書発行事業者登録番号の抽出
    const registrationNumber = this.extractRegistrationNumber(text)
    if (registrationNumber) {
      fields.issuerRegistrationNumber = registrationNumber
    }

    // 🆕 発行元企業名の抽出
    const issuerName = this.extractIssuerName(text)
    if (issuerName) {
      fields.issuerName = issuerName
    }

    // 明細行(品名)の抽出
    const lineItems = this.extractLineItems(text, lines, fields)
    if (lineItems.length > 0) {
      fields.lineItems = lineItems
    }

    return fields
  }

  /**
   * 適格請求書発行事業者登録番号の抽出
   *
   * フォーマット: T + 13桁の数字
   * 例: T1234567890123
   */
  private extractRegistrationNumber(text: string): FieldExtraction | undefined {
    // パターン1: ラベル付き（最も信頼度が高い）
    // OCR誤認識対応: 空白が入る可能性を考慮
    const labeledPatterns = [
      /(?:適格請求書発行事業者登録番号|登録\s*番\s*号|登録\s*No\.?|登録\s*ナンバー|Registration\s*Number|Reg\.?\s*No\.?|インボイス番号|Invoice\s*No)[:\s：]*\n?\s*([TtＴ][Il1l]?\s*\d[\s\d]{12,})/i,
      /(?:インボイス|Invoice)[:\s：]*\n?\s*([TtＴ][Il1l]?\s*\d[\s\d]{12,})/i,
      /(?:T番号)[:\s：]*\n?\s*([TtＴ][Il1l]?\s*\d[\s\d]{12,})/i,
    ]
    
    for (const pattern of labeledPatterns) {
      const match = text.match(pattern)
      if (match) {
        const value = this.normalizeRegistrationNumber(match[1])
        // 正規化後に正しいフォーマットかチェック
        if (/^T\d{13}$/.test(value)) {
          console.log(`登録番号検出(ラベル付き): ${value}`)
          return {
            value: value,
            confidence: 0.95,
          }
        }
      }
    }
    
    // パターン2: ラベルなしでT + 13桁を検出（空白混入対応）
    const unlabeledPattern = /\b([TtＴ][Il1l]?\s*\d[\s\d]{12,})\b/
    const unlabeledMatch = text.match(unlabeledPattern)
    
    if (unlabeledMatch) {
      const value = this.normalizeRegistrationNumber(unlabeledMatch[1])
      // 正規化後に正しいフォーマットかチェック
      if (/^T\d{13}$/.test(value)) {
        console.log(`登録番号検出(ラベルなし): ${value}`)
        return {
          value: value,
          confidence: 0.7,
        }
      }
    }
    
    console.log('登録番号は検出されませんでした')
    return undefined
  }

  /**
   * 登録番号の正規化
   * OCR誤認識を補正
   */
  private normalizeRegistrationNumber(value: string): string {
    // 空白を除去
    let normalized = value.replace(/\s+/g, '')
    
    // 全角文字を半角に変換
    normalized = normalized.replace(/[Ｔ]/g, 'T')
    normalized = normalized.replace(/[０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    )
    
    // 先頭のI, 1, l, t を T に変換（OCR誤認識対策）
    if (/^[Il1lt]/.test(normalized)) {
      normalized = 'T' + normalized.substring(1)
    }
    
    // 大文字に統一
    normalized = normalized.toUpperCase()
    
    return normalized
  }

  /**
   * 発行元企業名の抽出
   *
   * 請求先(御中、様付き)より後に出現する企業名を抽出
   * 「株式会社○○」または「○○株式会社」のパターンに対応
   */
  private extractIssuerName(text: string): FieldExtraction | undefined {
    // 請求先(御中、様付き)の位置を特定
    const clientPattern = /([^\n]+?)(?:様|御中|宛)/
    const clientMatch = text.match(clientPattern)
    
    let searchText = text
    if (clientMatch) {
      // 請求先より後のテキストを検索対象にする
      const clientIndex = text.indexOf(clientMatch[0])
      if (clientIndex !== -1) {
        searchText = text.substring(clientIndex + clientMatch[0].length)
      }
    }
    
    // 企業名パターン: 「株式会社○○」または「○○株式会社」
    const companyPatterns = [
      /株式会社\s*([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
      /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})\s*株式会社/,
    ]
    
    for (const pattern of companyPatterns) {
      const match = searchText.match(pattern)
      if (match) {
        const companyName = match[0].replace(/\s+/g, '').trim()
        if (companyName.length >= 4 && companyName.length <= 30) {
          console.log(`発行元企業名検出: ${companyName}`)
          return {
            value: companyName,
            confidence: 0.8,
          }
        }
      }
    }
    
    console.log('発行元企業名は検出されませんでした')
    return undefined
  }

  /**
   * 表形式の明細行を抽出
   */
  private extractLineItems(
    text: string,
    lines: string[],
    fields: OCRResult["extractedFields"]
  ): Array<{
    description: FieldExtraction
    quantity?: FieldExtraction
    unitPrice?: FieldExtraction
    amount?: FieldExtraction
  }> {
    const items: Array<{
      description: FieldExtraction
      quantity?: FieldExtraction
      unitPrice?: FieldExtraction
      amount?: FieldExtraction
    }> = []

    // ヘッダー行のパターン（品名、数量、単価、金額などを含む行）
    const headerPatterns = [
      /品\s*名|摘\s*要|件\s*名|商\s*品\s*名|内\s*容/,
      /数\s*量|個\s*数|qty|quantity/i,
      /単\s*価|unit|price/i,
      /金\s*額|小\s*計|amount/i,
    ]

    // ヘッダー行を検出
    let headerLineIndex = -1
    let descriptionColumnIndex = -1

    // デバッグ: 全行を表示
    console.log('=== 全テキスト行 ===')
    lines.forEach((line, index) => {
      if (line.trim()) {
        console.log(`${index}: "${line}"`)
      }
    })
    console.log('==================')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 表ヘッダー行の検出
      // パターン1: 「品名/摘要」「数量」「単価」「金額」などが揃っている行
      // OCR誤認識にも対応（「摘要」→「机衣」など）
      const hasItemName = /品\s*名|摘\s*要|商\s*品|品\s*目|科\s*提|下る|机\s*衣|内\s*容|項\s*目/.test(line)
      const hasQuantity = /数\s*量|個\s*数|放\s*量|施\s*還/.test(line)
      const hasAmount = /金\s*額|合\s*計|単\s*価/.test(line)
      
      // パターン2: パイプ区切りの表形式を検出（OCR誤認識でも検出可能）
      const isPipeTable = /\|/.test(line) && line.split('|').length >= 4
      
      // 3つの要素がある、またはパイプ区切りで4列以上ある場合は表ヘッダーと判断
      if ((hasItemName && hasQuantity && hasAmount) || (isPipeTable && (hasItemName || hasQuantity || hasAmount))) {
        headerLineIndex = i
        console.log(`表ヘッダー検出: "${line}"`)
        break
      }
      
      // パターン3: 「件名:」は除外（これは請求書の件名フィールド）
      if (/件\s*名\s*:/.test(line)) {
        console.log(`スキップ(件名フィールド): "${line}"`)
        continue
      }
    }

    // ヘッダー行が見つからない場合は終了
    if (headerLineIndex === -1) {
      console.log('品名ヘッダーが見つかりませんでした')
      return items
    }

    console.log(`品名ヘッダー検出: 行${headerLineIndex + 1}`)

    // ヘッダーの次の行から明細データを抽出
    let pendingDescription = ''  // 品名を一時保存
    
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 空行はスキップ
      if (!line) continue
      
      // 合計・小計・税などの行で終了
      if (/^(?:合計|小計|消費税|税|総額|御請求額|Total|Subtotal|Tax|は\s*\||油\s*生|時\s*トト)/i.test(line)) {
        break
      }

      // 除外すべきキーワードを含む行をスキップ
      if (/(?:支払|振込|振込先|支払期限|期限|お支払|銀行|支店|口座|名義|登録番号|TEL|FAX|担当|〒|住所|※)/i.test(line)) {
        continue
      }

      // パイプ区切りのみの行はスキップ
      if (/^[\s\|]+$/.test(line)) {
        continue
      }

      // 数値・記号のみの行はスキップ（正規化後のカンマ区切り数値を含む）
      if (/^[¥\\￥,，0-9\s\|]+$/.test(line)) {
        continue
      }

      // 金額を含む行かチェック
      const hasPrice = /[¥\\￥]\s*[\d,，]+|\d{3,}[,，]\d{3}/.test(line)
      
      if (hasPrice) {
        // 金額がある場合
        if (pendingDescription) {
          // 保留中の品名と結合して処理
          const combinedLine = `${pendingDescription} ${line}`
          console.log(`明細行処理(結合): "${combinedLine}"`)
          this.processLineItem(combinedLine, items)
          pendingDescription = ''
        } else {
          // 通常処理
          console.log(`明細行処理: "${line}"`)
          this.processLineItem(line, items)
        }
      } else {
        // 金額がない場合は品名候補として保留
        // ただし、日本語または英語を含む場合のみ
        if (/[ぁ-んァ-ヶー一-龠a-zA-Z]/.test(line)) {
          if (pendingDescription) {
            // すでに保留中の品名がある場合は結合
            pendingDescription += ` ${line}`
          } else {
            pendingDescription = line
          }
          console.log(`品名候補保留: "${pendingDescription}"`)
        }
      }

      // 最大10件まで
      if (items.length >= 10) {
        break
      }
    }
    
    // ループ終了後、保留中の品名があり明細が抽出されていない場合
    if (pendingDescription && items.length === 0) {
      // 小計または合計から金額を取得
      const amount = fields.subtotal?.value || fields.total?.value
      
      if (amount) {
        const fallbackLine = `${pendingDescription} ${amount} ${amount}`
        console.log(`明細行処理(フォールバック): "${fallbackLine}"`)
        this.processLineItem(fallbackLine, items)
      } else {
        console.log(`警告: 保留中の品名がありますが金額情報が見つかりません: "${pendingDescription}"`)
      }
    }

    console.log(`抽出された明細数: ${items.length}`)
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.description.value}`)
    })

    return items
  }

  /**
   * 行から品名データを抽出してitemsに追加
   */
  private processLineItem(
    line: string,
    items: Array<{
      description: FieldExtraction
      quantity?: FieldExtraction
      unitPrice?: FieldExtraction
      amount?: FieldExtraction
    }>
  ): void {
    // 品名を抽出（正規化後のテキスト対応）
    // 例: "Web 制作 (9 364,540 \364,540月 分 )"
    let description = ''
    
    // 大きな数値（3桁以上の連続した数字、またはカンマ/バックスラッシュ付き）のみを除去
    // 1〜2桁の数値（月の数字など）は保持
    const withoutNumbers = line
      .replace(/\s*\\\d{3,}[,，]?\d*\s*/g, ' ')  // バックスラッシュ付き数値
      .replace(/\s+\d{3,}\s*/g, ' ')  // 3桁以上の連続数値（空白で区切られている）
      .replace(/\s*[\d,，]{5,}\s*/g, ' ')  // カンマ区切りの大きな数値
      .trim()
    
    // 品名パターン: 日本語、英字、括弧を含む文字列
    const descriptionPattern = /^([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９\s（）()【】・ー\-\/\u3000]+)/
    const descMatch = withoutNumbers.match(descriptionPattern)
    
    if (descMatch) {
      description = descMatch[1].trim()
    } else {
      // フォールバック: 最初の非数値部分
      const simplePattern = /^([^0-9\\]+)/
      const simpleMatch = line.match(simplePattern)
      if (simpleMatch) {
        description = simpleMatch[1].trim()
      }
    }

    // 品名が妥当かチェック(2文字以上、100文字以下)
    if (description.length >= 2 && description.length <= 100) {
      // 数量の抽出
      const quantityMatch = line.match(/(?:10%|8%|\d+%)\s+(\d+)/)
      
      // 単価・金額の抽出（正規化後のカンマ区切り数値とバックスラッシュ付き数値）
      // パターン1: カンマ区切り数値（5桁以上）
      const commaNumbers = line.match(/[\d,，]{5,}/g)
      // パターン2: 3桁以上の連続数値
      const largeNumbers = line.match(/\b\d{3,}\b/g)
      // パターン3: バックスラッシュ付き数値
      const backslashNumbers = line.match(/\\(\d+)/g)
      
      let unitPrice: string | undefined
      let amount: string | undefined
      
      if (commaNumbers && commaNumbers.length > 0) {
        // カンマ区切り数値がある場合
        const firstPrice = commaNumbers[0].replace(/[,，]/g, '')
        const lastPrice = commaNumbers[commaNumbers.length - 1].replace(/[,，]/g, '')
        
        unitPrice = firstPrice
        amount = lastPrice
      } else if (largeNumbers && largeNumbers.length > 0) {
        // 3桁以上の数値がある場合
        const firstPrice = largeNumbers[0]
        const lastPrice = largeNumbers[largeNumbers.length - 1]
        
        unitPrice = firstPrice
        amount = lastPrice
      } else if (backslashNumbers && backslashNumbers.length > 0) {
        // バックスラッシュ付き数値のみの場合
        const firstPrice = backslashNumbers[0].replace(/\\/g, '')
        const lastPrice = backslashNumbers[backslashNumbers.length - 1].replace(/\\/g, '')
        
        unitPrice = firstPrice
        amount = lastPrice
      }

      console.log(`品名: "${description}", 単価: ${unitPrice}, 金額: ${amount}`)

      items.push({
        description: {
          value: description,
          confidence: 0.8,
        },
        quantity: quantityMatch ? {
          value: quantityMatch[1],
          confidence: 0.7,
        } : undefined,
        unitPrice: unitPrice ? {
          value: unitPrice,
          confidence: 0.7,
        } : undefined,
        amount: amount ? {
          value: amount,
          confidence: 0.7,
        } : undefined,
      })
    }
  }

  /**
   * 行から品名のみを抽出(金額などを除く)
   */
  private extractDescriptionOnly(line: string): string {
    const descriptionPattern = /^([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９\\s（）()【】・ー\\-\\/\\u3000]+?)(?:\\s*(?:\\\\\\d+|[¥\\\\￥]|\\d{3,}))/
    const match = line.match(descriptionPattern)
    return match ? match[1].trim() : line
  }

  /**
   * ワーカーの終了
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}

/**
 * シングルトンインスタンス
 */
export const ocrProcessor = new OCRProcessor()