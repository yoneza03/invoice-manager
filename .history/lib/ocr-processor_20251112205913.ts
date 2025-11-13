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

    // 金額を抽出（合計、小計、税） - より柔軟なパターン
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
        if (!isNaN(Number(numValue)) && Number(numValue) > 0) {
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
        if (!isNaN(Number(numValue)) && Number(numValue) > 0) {
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
        if (!isNaN(Number(numValue)) && Number(numValue) > 0) {
          fields.tax = {
            value: numValue,
            confidence: 0.9,
          }
          break
        }
      }
    }

    // 金額が見つからない場合、数値のみの大きな値を探す
    if (!fields.total) {
      const allNumbers = text.match(/([0-9,，]{4,})/g)
      if (allNumbers && allNumbers.length > 0) {
        // 最も大きい数値を合計と仮定
        const numbers = allNumbers.map(n => Number(n.replace(/[,，]/g, ""))).filter(n => !isNaN(n) && n > 0)
        if (numbers.length > 0) {
          const maxNumber = Math.max(...numbers)
          fields.total = {
            value: maxNumber.toString(),
            confidence: 0.5, // 低めの信頼度
          }
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