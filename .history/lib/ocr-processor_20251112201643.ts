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
    const extractedFields = this.parseInvoiceFields(text, result.data.words)

    return {
      confidence,
      processingTime,
      extractedFields,
    }
  }

  /**
   * テキストから請求書フィールドを解析
   */
  private parseInvoiceFields(
    text: string,
    words: Tesseract.Word[]
  ): OCRResult["extractedFields"] {
    const lines = text.split("\n")
    const fields: OCRResult["extractedFields"] = {}

    // 請求書番号を抽出
    const invoiceNumberPattern = /(?:請求書|請求書番号|Invoice|No)[:\s#]*([A-Z0-9\-]+)/i
    const invoiceMatch = text.match(invoiceNumberPattern)
    if (invoiceMatch) {
      fields.invoiceNumber = {
        value: invoiceMatch[1],
        confidence: this.calculateFieldConfidence(words, invoiceMatch[1]),
      }
    }

    // 顧客名を抽出（"宛" "様" "御中" などのキーワード付近）
    const clientPattern = /([^\n]+?)(?:様|御中|宛)/
    const clientMatch = text.match(clientPattern)
    if (clientMatch) {
      fields.clientName = {
        value: clientMatch[1].trim(),
        confidence: this.calculateFieldConfidence(words, clientMatch[1]),
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

    // 金額を抽出（合計、小計、税）
    const totalPattern = /(?:合計|総額|Total)[:\s¥\\]*([0-9,]+)/i
    const totalMatch = text.match(totalPattern)
    if (totalMatch) {
      fields.total = {
        value: totalMatch[1].replace(/,/g, ""),
        confidence: this.calculateFieldConfidence(words, totalMatch[1]),
      }
    }

    const subtotalPattern = /(?:小計|Subtotal)[:\s¥\\]*([0-9,]+)/i
    const subtotalMatch = text.match(subtotalPattern)
    if (subtotalMatch) {
      fields.subtotal = {
        value: subtotalMatch[1].replace(/,/g, ""),
        confidence: this.calculateFieldConfidence(words, subtotalMatch[1]),
      }
    }

    const taxPattern = /(?:消費税|税|Tax)[:\s¥\\]*([0-9,]+)/i
    const taxMatch = text.match(taxPattern)
    if (taxMatch) {
      fields.tax = {
        value: taxMatch[1].replace(/,/g, ""),
        confidence: this.calculateFieldConfidence(words, taxMatch[1]),
      }
    }

    return fields
  }

  /**
   * フィールドの信頼度を計算
   */
  private calculateFieldConfidence(words: Tesseract.Word[], value: string): number {
    // マッチする単語の信頼度を平均化
    const matchingWords = words.filter((w) => value.includes(w.text))
    if (matchingWords.length === 0) return 0.5

    const avgConfidence =
      matchingWords.reduce((sum, w) => sum + w.confidence, 0) / matchingWords.length
    return avgConfidence / 100
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