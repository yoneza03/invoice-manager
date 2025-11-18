import { Invoice, InvoiceAttachment, InvoiceSource, OCRResult, Client, InvoiceLineItem, IssuerInfo } from "./types"
import { ocrProcessor } from "./ocr-processor"
import { createAttachment, pdfToImage, validateFile } from "./file-processor"

/**
 * 請求書インポートサービス
 */
export class InvoiceImportService {
  /**
   * ファイルから請求書データをインポート
   */
  async importFromFile(
    file: File,
    existingClients: Client[]
  ): Promise<{
    invoice: Partial<Invoice>
    attachment: InvoiceAttachment
    ocrData: OCRResult
  }> {
    // ファイル検証
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // 添付ファイルを作成
    const attachment = await createAttachment(file)

    // OCR処理用の画像データを準備
    let imageData: string

    if (file.type === "application/pdf") {
      // PDFを画像に変換
      imageData = await pdfToImage(file)
    } else {
      // 画像ファイルはそのまま使用
      imageData = attachment.base64Data
    }

    // OCR処理を実行
    const ocrData = await ocrProcessor.processInvoice(imageData)

    // OCR結果から請求書データを構築
    const invoice = this.buildInvoiceFromOCR(ocrData, existingClients, file.type)

    return {
      invoice: {
        ...invoice,
        source: file.type === "application/pdf" ? "pdf_import" : "image_import",
        attachments: [attachment],
        ocrData,
        createdAt: new Date(),
        updatedAt: new Date(),
        isReadonly: true,
        originalPdfAttachmentId: attachment.id,
      },
      attachment,
      ocrData,
    }
  }

  /**
   * OCR結果から請求書データを構築
   */
  private buildInvoiceFromOCR(
    ocrData: OCRResult,
    existingClients: Client[],
    fileType: string
  ): Partial<Invoice> {
    const { extractedFields } = ocrData

    // 顧客を検索または新規作成
    let client: Client | undefined

    if (extractedFields.clientName) {
      client = existingClients.find(
        (c) =>
          c.name.toLowerCase() === extractedFields.clientName!.value.toLowerCase()
      )

      if (!client) {
        // 新規顧客を作成
        client = {
          id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: extractedFields.clientName.value,
          email: "",
          address: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    } else {
      // デフォルト顧客
      client = {
        id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: "不明",
        email: "",
        address: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    // 金額の計算
    const total = extractedFields.total
      ? parseFloat(extractedFields.total.value)
      : 0
    
    let subtotal: number
    let tax: number
    let taxRate: number

    // ケース1: 小計と消費税が両方抽出されている
    if (extractedFields.subtotal && extractedFields.tax) {
      subtotal = parseFloat(extractedFields.subtotal.value)
      tax = parseFloat(extractedFields.tax.value)
      taxRate = subtotal > 0 ? tax / subtotal : 0.1
    }
    // ケース2: 小計のみ抽出されている
    else if (extractedFields.subtotal) {
      subtotal = parseFloat(extractedFields.subtotal.value)
      tax = total - subtotal
      taxRate = subtotal > 0 ? tax / subtotal : 0.1
    }
    // ケース3: 消費税のみ抽出されている
    else if (extractedFields.tax) {
      tax = parseFloat(extractedFields.tax.value)
      subtotal = total - tax
      taxRate = subtotal > 0 ? tax / subtotal : 0.1
    }
    // ケース4: どちらも抽出されていない → 合計から逆算（10%税率を仮定）
    else {
      // 合計 = 小計 × 1.1 と仮定
      subtotal = Math.round(total / 1.1)
      tax = total - subtotal
      taxRate = 0.1
    }

    // 日付の解析
    const issueDate = extractedFields.issueDate
      ? new Date(extractedFields.issueDate.value)
      : new Date()
    const dueDate = extractedFields.dueDate
      ? new Date(extractedFields.dueDate.value)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30日後

    // 支払情報の構築
    const paymentInfo = {
      bankName: extractedFields.bankName?.value,
      branchName: extractedFields.branchName?.value,
      accountType: extractedFields.accountType?.value,
      accountNumber: extractedFields.accountNumber?.value,
      accountHolder: extractedFields.accountHolder?.value,
    }

    // すべてのフィールドが未定義の場合はpaymentInfoをundefinedにする
    const hasPaymentInfo = Object.values(paymentInfo).some(value => value !== undefined)

    // 発行者情報の構築（インポート請求書の発行元）
    const issuerInfo = this.buildIssuerInfo(extractedFields)

    return {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber:
        extractedFields.invoiceNumber?.value ||
        `IMP-${Date.now().toString().slice(-6)}`,
      client,
      issueDate,
      dueDate,
      lineItems: this.buildLineItems(extractedFields, subtotal),
      subtotal,
      tax,
      taxRate,
      total,
      status: "imported",
      paymentInfo: hasPaymentInfo ? paymentInfo : undefined,
      issuerInfo: issuerInfo,
    }
  }

  /**
   * 複数ファイルを一括インポート
   */
  async importMultipleFiles(
    files: File[],
    existingClients: Client[]
  ): Promise<
    Array<{
      invoice: Partial<Invoice>
      attachment: InvoiceAttachment
      ocrData: OCRResult
    }>
  > {
    const results = []

    for (const file of files) {
      try {
        const result = await this.importFromFile(file, existingClients)
        results.push(result)
      } catch (error) {
        console.error(`ファイル ${file.name} のインポートに失敗:`, error)
        // エラーは無視して次のファイルへ
      }
    }

    return results
  }

  /**
   * OCRから抽出した明細行を構築
   */
  private buildLineItems(
    extractedFields: OCRResult["extractedFields"],
    subtotal: number
  ): InvoiceLineItem[] {
    // OCRで明細行が抽出されている場合
    if (extractedFields.lineItems && extractedFields.lineItems.length > 0) {
      return extractedFields.lineItems.map((item, index) => {
        const quantity = item.quantity
          ? parseFloat(item.quantity.value)
          : 1
        
        const unitPrice = item.unitPrice
          ? parseFloat(item.unitPrice.value)
          : item.amount
          ? parseFloat(item.amount.value) / quantity
          : 0

        const amount = item.amount
          ? parseFloat(item.amount.value)
          : unitPrice * quantity

        return {
          id: `li_${Date.now()}_${index}`,
          description: item.description.value,
          quantity,
          unitPrice,
          amount,
        }
      })
    }

    // 明細行が抽出されていない場合は従来通りダミーデータ
    return [
      {
        id: `li_${Date.now()}`,
        description: "インポートされた項目（要編集）",
        quantity: 1,
        unitPrice: subtotal,
        amount: subtotal,
      },
    ]
  }

  /**
   * OCR結果から発行元情報を構築
   */
  private buildIssuerInfo(
    extractedFields: OCRResult["extractedFields"]
  ): IssuerInfo | undefined {
    // 登録番号または企業名が抽出されている場合のみIssuerInfoを作成
    if (!extractedFields.issuerRegistrationNumber && !extractedFields.issuerName) {
      return undefined
    }

    const issuerInfo: IssuerInfo = {
      name: extractedFields.issuerName?.value || "インポート元企業",
      registrationNumber: extractedFields.issuerRegistrationNumber?.value,
    }

    return issuerInfo
  }
}

/**
 * シングルトンインスタンス
 */
export const invoiceImportService = new InvoiceImportService()