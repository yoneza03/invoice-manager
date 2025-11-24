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
    const clientName = this.extractClient(text, lines)
    if (clientName) {
      fields.clientName = clientName
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

    // 🆕 発行元住所の抽出
    const issuerAddress = this.extractIssuerAddress(text, lines)
    if (issuerAddress) {
      fields.issuerAddress = issuerAddress
    }

    // 🆕 発行元電話番号の抽出
    const issuerPhone = this.extractIssuerPhone(text)
    if (issuerPhone) {
      fields.issuerPhone = issuerPhone
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
    // デバッグログ1: メソッド開始
    console.log('=== 登録番号抽出開始 ===')
    console.log('元のテキスト(最初の500文字):', text.substring(0, 500))
    console.log('元のテキスト長:', text.length)
    
    // スペースを全て削除してから検索
    const normalizedText = text.replace(/\s+/g, '')
    
    // デバッグログ2: スペース削除後
    console.log('スペース削除後(最初の500文字):', normalizedText.substring(0, 500))
    
    // 「登録番号」というキーワードが含まれているかチェック
    const hasRegistrationKeyword = /登録|番号|Registration|Reg/i.test(normalizedText)
    console.log('登録番号キーワードの存在:', hasRegistrationKeyword)
    
    // パターン1: ラベル付き(最も信頼度が高い)
    const labeledPatterns = [
      /(?:適格請求書発行事業者登録番号|登録番号|登録No\.?|登録ナンバー|RegistrationNumber|Reg\.?No\.?|インボイス番号|InvoiceNo)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
      /(?:インボイス|Invoice)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
      /(?:T番号)[:\s：]*([TtＴイ1lLI『｢「]?[\d０-９]{13,})/i,
    ]
    
    console.log('=== ラベル付きパターンでのマッチング開始 ===')
    for (let i = 0; i < labeledPatterns.length; i++) {
      const pattern = labeledPatterns[i]
      console.log(`パターン${i + 1}を試行:`, pattern.source)
      
      const match = normalizedText.match(pattern)
      console.log(`パターン${i + 1}のマッチ結果:`, match ? `成功 - ${JSON.stringify(match)}` : '失敗')
      
      if (match) {
        console.log('  - マッチした全体:', match[0])
        console.log('  - キャプチャグループ[1]:', match[1])
        
        // マッチしたら正規化
        let value = match[1]
        console.log('  - 正規化前の値:', value)
        
        // ステップ1: 先頭の誤認識文字を「T」に置き換え
        const beforeTReplacement = value
        value = value.replace(/^[イ1lLI『｢「]/i, 'T')
        console.log(`  - ステップ1(先頭文字をTに): "${beforeTReplacement}" → "${value}"`)
        
        // ステップ2: 全角数字を半角に変換
        const beforeFullWidthConversion = value
        value = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        console.log(`  - ステップ2(全角→半角): "${beforeFullWidthConversion}" → "${value}"`)
        
        // ステップ3: 数字以外を削除(Tは残す)
        const beforeCleanup = value
        value = value.replace(/[^T0-9]/g, '')
        console.log(`  - ステップ3(T以外の非数字削除): "${beforeCleanup}" → "${value}"`)
        
        // ステップ4: Tがない場合は先頭に追加
        const beforeTAddition = value
        if (!/^T/.test(value) && /^\d{13}$/.test(value)) {
          value = 'T' + value
          console.log(`  - ステップ4(先頭にT追加): "${beforeTAddition}" → "${value}"`)
        } else {
          console.log(`  - ステップ4(T追加スキップ): "${value}" (既にTあり、または13桁でない)`)
        }
        
        // ステップ5: 正しいフォーマットかチェック(T + 13桁の数字)
        const isValid = /^T\d{13}$/.test(value)
        console.log(`  - ステップ5(フォーマット検証): ${isValid ? '✓ 有効' : '✗ 無効'}`)
        console.log(`  - 最終的な値: "${value}" (長さ: ${value.length})`)
        
        if (isValid) {
          console.log(`✓ 登録番号検出成功(ラベル付き): ${value}`)
          console.log('=== 登録番号抽出終了(成功) ===')
          return {
            value: value,
            confidence: 0.95,
          }
        } else {
          console.log(`✗ フォーマット不一致: 期待="T + 13桁", 実際="${value}"`)
        }
      }
    }
    console.log('=== ラベル付きパターンでのマッチング終了(全て失敗) ===')
    
    // パターン2: ラベルなしでT + 13桁を検出
    console.log('=== ラベルなしパターンでのマッチング開始 ===')
    const unlabeledPattern = /\b([TtＳ『｢「]\d{13,})\b/
    console.log('パターン:', unlabeledPattern.source)
    
    const unlabeledMatch = normalizedText.match(unlabeledPattern)
    console.log('マッチ結果:', unlabeledMatch ? `成功 - ${JSON.stringify(unlabeledMatch)}` : '失敗')
    
    if (unlabeledMatch) {
      console.log('  - マッチした全体:', unlabeledMatch[0])
      console.log('  - キャプチャグループ[1]:', unlabeledMatch[1])
      
      // マッチしたら正規化
      let value = unlabeledMatch[1]
      console.log('  - 正規化前:', value)
      
      // 先頭の誤認識文字を「T」に置き換え
      const beforeTReplacement = value
      value = value.replace(/^[イ1lLI『｢「]/i, 'T')
      console.log(`  - 先頭文字をTに: "${beforeTReplacement}" → "${value}"`)
      
      value = value.toUpperCase()
      console.log('  - 大文字化後:', value)
      
      value = value.replace(/[^T0-9]/g, '')
      console.log('  - 非T・非数字削除後:', value)
      
      // Tがない場合は先頭に追加
      const beforeTAddition = value
      if (!/^T/.test(value) && /^\d{13}$/.test(value)) {
        value = 'T' + value
        console.log(`  - 先頭にT追加: "${beforeTAddition}" → "${value}"`)
      }
      
      // 正しいフォーマットかチェック
      const isValid = /^T\d{13}$/.test(value)
      console.log(`  - フォーマット検証: ${isValid ? '✓ 有効' : '✗ 無効'}`)
      
      if (isValid) {
        console.log(`✓ 登録番号検出成功(ラベルなし): ${value}`)
        console.log('=== 登録番号抽出終了(成功) ===')
        return {
          value: value,
          confidence: 0.7,
        }
      }
    }
    console.log('=== ラベルなしパターンでのマッチング終了(失敗) ===')
    
    console.log('✗ 登録番号は検出されませんでした')
    console.log('=== 登録番号抽出終了(失敗) ===')
    return undefined
  }

  /**
   * 発行元企業名の抽出
   *
   * 請求先(御中、様付き)より後に出現する企業名を抽出
   * 「株式会社○○」または「○○株式会社」のパターンに対応
   * スペースが混入している場合にも対応
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
    
    // スペースを全て削除してから検索
    const normalizedText = searchText.replace(/\s+/g, '')
    
    // 企業名パターン: 「株式会社○○」または「○○株式会社」
    const companyPatterns = [
      /株式会社([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})/,
      /([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９]{2,20})株式会社/,
    ]
    
    for (const pattern of companyPatterns) {
      const match = normalizedText.match(pattern)
      if (match) {
        const companyName = match[0]
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
   * 発行元住所の抽出
   */
  private extractIssuerAddress(text: string, lines: string[]): FieldExtraction | undefined {
    // 1. まず発行元企業名を取得
    const issuerName = this.extractIssuerName(text)
    
    // スペースを削除
    const normalizedText = text.replace(/\s+/g, '')
    
    // 2. 企業名が見つかった場合、その位置より後ろを検索対象にする
    let searchText = normalizedText
    if (issuerName) {
      const issuerNameIndex = normalizedText.indexOf(issuerName.value)
      if (issuerNameIndex !== -1) {
        searchText = normalizedText.substring(issuerNameIndex + issuerName.value.length)
        console.log(`企業名「${issuerName.value}」より後ろを検索対象にします`)
      }
    }
    
    // 3. searchText に対して既存の正規表現で住所を検索
    // 〒郵便番号から始まる住所を抽出（TELの前まで）
    const addressWithPostalMark = /〒?\d{3}-?\d{4}([^TEL]+)/
    const match1 = searchText.match(addressWithPostalMark)
    
    if (match1) {
      let address = match1[0]
      // TELを含む場合は除去
      address = address.replace(/TEL.*/g, '').trim()
      console.log(`発行元住所検出: ${address}`)
      return {
        value: address,
        confidence: 0.9,
      }
    }
    // 〒なしで都道府県から始まるパターン
    const prefecturePattern = /(東京都|北海道|(?:京都|大阪)府|.{2,3}県)[^\nTEL]+/
    const match2 = searchText.match(prefecturePattern)
    
    if (match2) {
      let address = match2[0]
      address = address.replace(/TEL.*/g, '').trim()
      console.log(`発行元住所検出: ${address}`)
      return {
        value: address,
        confidence: 0.8,
      }
    }
    console.log('発行元住所は検出されませんでした')
    return undefined
  }

  /**
   * 発行元電話番号の抽出
   */
  private extractIssuerPhone(text: string): FieldExtraction | undefined {
    const clientMatch = text.match(/([^\n]+?)(?:様|御中|宛)/)
    let searchText = text
    if (clientMatch) {
      const idx = text.indexOf(clientMatch[0])
      if (idx !== -1) searchText = text.substring(idx + clientMatch[0].length)
    }

    const phonePatterns = [
      /(?:TEL|Tel|電話)[:\s：]*(\d{2,4}[-−ー]\d{2,4}[-−ー]\d{4})/,
      /(\d{2,4}[-−ー]\d{2,4}[-−ー]\d{4})/,
    ]

    for (const pattern of phonePatterns) {
      const match = searchText.match(pattern)
      if (match) {
        return {
          value: match[1].replace(/[−ー]/g, '-'),
          confidence: 0.8,
        }
      }
    }
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

    console.log('=== 表ヘッダー検出開始 ===')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      // 空行はスキップ
      if (!trimmedLine) continue
      
      // 除外条件1: 「合計」「小計」「税」で始まる行はヘッダーから除外
      if (/^(?:合計|小計|消費税|税額|総額|御請求額|税|Total|Subtotal|Tax)/i.test(trimmedLine)) {
        console.log(`ヘッダー候補除外(合計/小計行): ${i}, "${trimmedLine}"`)
        continue
      }
      
      // 除外条件2: 「件名:」は除外（これは請求書の件名フィールド）
      if (/件\s*名\s*:/.test(trimmedLine)) {
        console.log(`ヘッダー候補除外(件名フィールド): ${i}, "${trimmedLine}"`)
        continue
      }
      
      // 表ヘッダー行の検出
      // パターン1: 「品名/摘要」「数量」「単価」「金額」などが揃っている行
      // OCR誤認識にも対応（「摘要」→「机衣」など）
      const hasItemName = /品\s*名|摘\s*要|商\s*品|品\s*目|科\s*提|下る|机\s*衣|内\s*容|項\s*目/.test(trimmedLine)
      const hasQuantity = /数\s*量|個\s*数|放\s*量|施\s*還/.test(trimmedLine)
      const hasAmount = /金\s*額|単\s*価/.test(trimmedLine)  // 「合計」を削除
      
      // パターン2: パイプ区切りの表形式を検出（OCR誤認識でも検出可能）
      const isPipeTable = /\|/.test(trimmedLine) && trimmedLine.split('|').length >= 4
      
      console.log(`ヘッダー候補行: ${i}, "${trimmedLine}" (品名:${hasItemName}, 数量:${hasQuantity}, 金額:${hasAmount}, パイプ:${isPipeTable})`)
      
      // 3つの要素がある、またはパイプ区切りで4列以上ある場合は表ヘッダーと判断
      if ((hasItemName && hasQuantity && hasAmount) || (isPipeTable && trimmedLine.split('|').length >= 3)){
        headerLineIndex = i
        console.log(`表ヘッダー検出: "${trimmedLine}"`)
        break
      }
    }
    
    console.log(`最終的なヘッダー行: ${headerLineIndex}`)
    console.log('=== 表ヘッダー検出終了 ===')

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
    console.log(`=== processLineItem 開始 ===`)
    console.log(`入力行: "${line}"`)
    
    // スペースを正規化してから処理
    const normalizedLine = line.replace(/\s+/g, ' ').trim()
    console.log(`正規化後: "${normalizedLine}"`)
    
    // 品名を抽出
    let description = ''
    
    // ステップ1: カンマ区切り数値を除去（バックスラッシュ付きも含む）
    // 例: "364,540" や "\364,540" を除去
    let cleanedLine = normalizedLine
      .replace(/\\?\d{1,3}(?:[,，]\d{3})+/g, '')  // カンマ区切り数値
      .replace(/\\?\d{4,}/g, '')  // 4桁以上の連続数値
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log(`数値除去後: "${cleanedLine}"`)
    
    // ステップ2: 品名パターンでマッチング
    // 「Web 制作 (9月 分 )」のような形式に対応
    // 日本語、英字、括弧、1-2桁の数字（月など）を含む文字列
    const descriptionPattern = /^([ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９\s（）()【】・ー\-\/]+)/
    const descMatch = cleanedLine.match(descriptionPattern)
    
    if (descMatch) {
      description = descMatch[1].replace(/\s+/g, ' ').trim()
      // 末尾の不要な括弧を整理
      description = description.replace(/\(\s*\)|\（\s*\）/g, '').trim()
    }
    
    // フォールバック: より緩いパターンで抽出
    if (!description || description.length < 2) {
      // 日本語または英字で始まる部分を抽出
      const fallbackPattern = /^([ぁ-んァ-ヶー一-龠a-zA-Z][ぁ-んァ-ヶー一-龠a-zA-Z0-9０-９\s（）()【】・ー\-\/\u3000]*)/
      const fallbackMatch = cleanedLine.match(fallbackPattern)
      if (fallbackMatch) {
        description = fallbackMatch[1].replace(/\s+/g, ' ').trim()
      }
    }
    
    // さらにフォールバック: 元の行から最初の非数値部分を抽出
    if (!description || description.length < 2) {
      const simplePattern = /^([^0-9\\¥￥]+)/
      const simpleMatch = normalizedLine.match(simplePattern)
      if (simpleMatch) {
        description = simpleMatch[1].replace(/\s+/g, ' ').trim()
      }
    }
    
    // 品名の先頭から番号を削除
    description = description.replace(/^[\d０-９]+[\s　]*/, '')
    
    console.log(`抽出された品名: "${description}"`)

    // 品名が妥当かチェック(2文字以上、100文字以下)
    if (description.length >= 2 && description.length <= 100) {
      // 数量の抽出
      const quantityMatch = normalizedLine.match(/(?:10%|8%|\d+%)\s+(\d+)/)
      
      // 単価・金額の抽出（元の正規化された行から）
      // パターン1: カンマ区切り数値
      const commaNumbers = normalizedLine.match(/\\?\d{1,3}(?:[,，]\d{3})+/g)
      // パターン2: 4桁以上の連続数値
      const largeNumbers = normalizedLine.match(/\\?\d{4,}/g)
      
      let unitPrice: string | undefined
      let amount: string | undefined
      
      // 金額の抽出（優先度: カンマ区切り > 連続数値）
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
          // 既に追加されていない場合のみ追加
          if (!allNumbers.includes(cleaned)) {
            allNumbers.push(cleaned)
          }
        })
      }
      
      console.log(`抽出された数値: ${JSON.stringify(allNumbers)}`)
      
      if (allNumbers.length >= 2) {
        // 2つ以上の数値がある場合、最初を単価、最後を金額とする
        unitPrice = allNumbers[0]
        amount = allNumbers[allNumbers.length - 1]
      } else if (allNumbers.length === 1) {
        // 1つの数値のみの場合は金額とする
        amount = allNumbers[0]
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
    } else {
      console.log(`品名が不正(長さ: ${description.length}): スキップ`)
    }
    
    console.log(`=== processLineItem 終了 ===`)
  }

  /**
   * 請求先企業名の抽出
   * 
   * 「請求先」キーワードの次の行から企業名を抽出
   * - 法人格を含む行を優先
   * - 敬称のみの行はスキップ
   * - 最大3行先まで探索
   */
  private extractClient(text: string, lines: string[]): FieldExtraction | undefined {
    console.log('=== extractClient デバッグ開始 ===')
    console.log('全テキスト行数:', lines.length)
    
    // 「請求先」キーワードを含む行のインデックスを検索
    let billingToIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/\s+/g, '').includes('請求先')) {
        billingToIndex = i
        console.log(`「請求先」キーワード検出: 行${i + 1}, 内容: "${lines[i]}"`)
        break
      }
    }

    // 「請求先」が見つからない場合は従来の方法で抽出
    if (billingToIndex === -1) {
      console.log('「請求先」キーワードが見つかりません。従来の方法を試行します。')
      const clientPattern = /([^\n]+?)(?:様|御中|宛)/
      const clientMatch = text.match(clientPattern)
      if (clientMatch) {
        console.log(`従来の方法で企業名検出: "${clientMatch[1].trim()}"`)
        console.log('=== extractClient デバッグ終了 ===')
        return {
          value: clientMatch[1].trim(),
          confidence: 0.8,
        }
      }
      console.log('従来の方法でも企業名が見つかりませんでした')
      console.log('=== extractClient デバッグ終了 ===')
      return undefined
    }

    // 法人格パターン（スペースを許容）
    const corporatePattern = /株\s*式\s*会\s*社|有\s*限\s*会\s*社|合\s*同\s*会\s*社|合\s*資\s*会\s*社|一\s*般\s*社\s*団\s*法\s*人|財\s*団\s*法\s*人/

    console.log(`「請求先」の次から最大3行を探索します (開始行: ${billingToIndex + 2})`)
    
    // 「請求先」の次の行から最大3行先まで探索
    const maxSearchLines = 3
    for (let offset = 1; offset <= maxSearchLines && billingToIndex + offset < lines.length; offset++) {
      const lineIndex = billingToIndex + offset
      const line = lines[lineIndex].trim()
      
      console.log(`--- 行${lineIndex + 1}を検査 ---`)
      console.log(`  内容: "${line}"`)
      console.log(`  長さ: ${line.length}`)
      
      // 空行はスキップ
      if (!line) {
        console.log('  判定: 空行のためスキップ')
        continue
      }

      // 敬称のみの行はスキップ
      if (/^(様|御中|殿)$/.test(line)) {
        console.log(`  判定: 敬称のみの行をスキップ`)
        continue
      }

      // 法人格パターンのマッチングをテスト
      const hasCorporateType = corporatePattern.test(line)
      console.log(`  法人格パターンマッチ: ${hasCorporateType}`)
      
      if (hasCorporateType) {
        console.log(`  マッチした法人格パターン:`, line.match(corporatePattern))
      }

      // 法人格を含む行を優先
      if (hasCorporateType) {
        // スペースを削除して正規化
        let cleanedLine = line.replace(/\s+/g, '')
        // 敬称が含まれている場合は除去
        cleanedLine = cleanedLine.replace(/(?:様|御中|殿)$/, '').trim()
        console.log(`  スペース削除後: "${cleanedLine}"`)
        console.log(`✓ 法人格を含む企業名を検出: "${cleanedLine}"`)
        console.log('=== extractClient デバッグ終了 ===')
        return {
          value: cleanedLine,
          confidence: 0.9,
        }
      }
    }

    console.log('法人格パターンが見つかりませんでした。敬称以外の最初の行を探します。')

    // 法人格が見つからない場合、敬称以外の最初の行を返す
    for (let offset = 1; offset <= maxSearchLines && billingToIndex + offset < lines.length; offset++) {
      const lineIndex = billingToIndex + offset
      const line = lines[lineIndex].trim()
      
      console.log(`--- フォールバック: 行${lineIndex + 1}を検査 ---`)
      console.log(`  内容: "${line}"`)
      
      // 空行はスキップ
      if (!line) {
        console.log('  判定: 空行のためスキップ')
        continue
      }

      // 敬称のみの行はスキップ
      if (/^(様|御中|殿)$/.test(line)) {
        console.log('  判定: 敬称のみのためスキップ')
        continue
      }

      // スペースを削除して正規化
      let cleanedLine = line.replace(/\s+/g, '')
      // 敬称が含まれている場合は除去
      cleanedLine = cleanedLine.replace(/(?:様|御中|殿)$/, '').trim()
      
      console.log(`  スペース削除後: "${cleanedLine}"`)
      console.log(`  長さ: ${cleanedLine.length}`)
      
      // 有効な企業名かチェック（最低2文字以上）
      if (cleanedLine.length >= 2) {
        console.log(`✓ 企業名を検出(法人格なし): "${cleanedLine}"`)
        console.log('=== extractClient デバッグ終了 ===')
        return {
          value: cleanedLine,
          confidence: 0.7,
        }
      }
    }

    console.log('✗ 「請求先」の後に有効な企業名が見つかりませんでした')
    console.log('=== extractClient デバッグ終了 ===')
    return undefined
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