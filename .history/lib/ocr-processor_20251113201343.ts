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
    const text = result.data.text
    const confidence = result.data.confidence / 100

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
    const lines = text.split("\n")
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
    // クリーニング関数
    const cleanBankName = (text: string): string => {
      return text
        .replace(/振込.*?[::：]\s*/g, "") // 「振込先:」などを削除
        .replace(/[振込先:：\s]/g, "") // 個別の不要文字を削除
        .replace(/\s+/g, "") // すべての空白を削除
        .trim()
    }
    
    const cleanBranchName = (text: string): string => {
      return text
        .replace(/\s+/g, "") // すべての空白を削除
        .trim()
    }

    // 銀行名の抽出
    const bankPatterns = [
      /([^\n]*?(?:銀行|Bank|bank))/i,
      /(?:振込先|お振込先|振込先銀行)[:\s]*([^\n]+)/i,
    ]
    
    for (const pattern of bankPatterns) {
      const match = text.match(pattern)
      if (match) {
        const rawBankName = match[1] || match[0]
        const cleanedBankName = cleanBankName(rawBankName)
        
        // 銀行名として妥当性チェック（「銀行」を含み、長さが適切）
        if (cleanedBankName.includes('銀行') && cleanedBankName.length >= 3 && cleanedBankName.length < 20) {
          fields.bankName = {
            value: cleanedBankName,
            confidence: 0.8,
          }
          break
        }
      }
    }

    // 支店名の抽出
    const branchPatterns = [
      /([^\n]*?(?:支店|支所))/i,
      /(?:店名|支店名)[:\s]*([^\n]+)/i,
    ]
    
    for (const pattern of branchPatterns) {
      const match = text.match(pattern)
      if (match) {
        const rawBranchName = match[1] || match[0]
        const cleanedBranchName = cleanBranchName(rawBranchName)
        
        // 支店名として妥当性チェック（「支店」または「支所」を含み、長さが適切）
        if ((cleanedBranchName.includes('支店') || cleanedBranchName.includes('支所')) &&
            cleanedBranchName.length >= 3 && cleanedBranchName.length < 20) {
          fields.branchName = {
            value: cleanedBranchName,
            confidence: 0.8,
          }
          break
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

    return fields
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