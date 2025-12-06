import { PDFDocument, rgb } from "pdf-lib"
import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"
import fontkit from "@pdf-lib/fontkit"

// Google FontsからNoto Sans JPフォントを取得する関数
async function fetchFont() {
  const url = 'https://fonts.gstatic.com/s/notosansjp/v42/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEi75vY0rw-oME.ttf'
  const fontBytes = await fetch(url).then(res => res.arrayBuffer())
  return fontBytes
}

export async function generateInvoicePDFV3(invoice: Invoice, companyInfo: any) {
  // 新しいPDFドキュメントを作成
  const pdfDoc = await PDFDocument.create()
  
  // フォントキットを登録
  pdfDoc.registerFontkit(fontkit)
  
  // 日本語フォントを埋め込む
  const fontBytes = await fetchFont()
  const font = await pdfDoc.embedFont(fontBytes)
  
  const page = pdfDoc.addPage([595.28, 841.89]) // A4サイズ
  
  const { width, height } = page.getSize()
  const margin = 50
  let yPosition = height - margin

  // タイトル
  page.drawText('請求書', {
    x: width / 2 - 60,
    y: yPosition,
    size: 28,
    font: font,
    color: rgb(0.2, 0.2, 0.2),
  })
  yPosition -= 50

  // 請求書番号と日付
  page.drawText(`請求書番号: ${invoice.invoiceNumber}`, {
    x: margin,
    y: yPosition,
    size: 11,
    font: font,
  })
  yPosition -= 20
  
  page.drawText(`発行日: ${formatDate(invoice.issueDate)}`, {
    x: margin,
    y: yPosition,
    size: 11,
    font: font,
  })
  yPosition -= 20
  
  page.drawText(`期限日: ${formatDate(invoice.dueDate)}`, {
    x: margin,
    y: yPosition,
    size: 11,
    font: font,
  })

  // 期限切れ判定: 支払期限が現在日時を過ぎている場合のみステータス表示
  const isExpired = new Date(invoice.dueDate) < new Date()
  
  if (isExpired) {
    const statusColor = rgb(0.94, 0.27, 0.27) // 赤色
    page.drawText(`ステータス: 期限切`, {
      x: width - margin - 150,
      y: yPosition + 40,
      size: 14,
      font: font,
      color: statusColor,
    })
  }

  yPosition -= 40

  // 区切り線
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 2,
    color: rgb(0.8, 0.8, 0.8),
  })
  yPosition -= 30

  // 発行者情報
  page.drawText('発行者:', {
    x: margin,
    y: yPosition,
    size: 12,
    font: font,
  })
  yPosition -= 20
  
  page.drawText(companyInfo.name, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
  })
  yPosition -= 15
  
  page.drawText(companyInfo.address, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
  })
  yPosition -= 15
  
  page.drawText(companyInfo.email, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
  })
  yPosition -= 15
  
  page.drawText(companyInfo.phone, {
    x: margin,
    y: yPosition,
    size: 10,
    font: font,
  })

  // 請求先情報（右側）
  let rightY = height - margin - 170
  page.drawText('請求先:', {
    x: width - margin - 200,
    y: rightY,
    size: 12,
    font: font,
  })
  rightY -= 20
  
  page.drawText(invoice.client.name, {
    x: width - margin - 200,
    y: rightY,
    size: 10,
    font: font,
  })
  rightY -= 15
  
  page.drawText(invoice.client.address, {
    x: width - margin - 200,
    y: rightY,
    size: 10,
    font: font,
  })
  rightY -= 15
  
  page.drawText(invoice.client.email, {
    x: width - margin - 200,
    y: rightY,
    size: 10,
    font: font,
  })
  
  if (invoice.client.phone) {
    rightY -= 15
    page.drawText(invoice.client.phone, {
      x: width - margin - 200,
      y: rightY,
      size: 10,
      font: font,
    })
  }

  yPosition -= 60

  // 明細テーブルのヘッダー
  const tableHeaders = ['品目', '数量', '単価', '金額']
  const columnWidths = [250, 80, 100, 100]
  let xPos = margin

  // ヘッダー背景
  page.drawRectangle({
    x: margin,
    y: yPosition - 20,
    width: width - margin * 2,
    height: 25,
    color: rgb(0.23, 0.51, 0.97),
  })

  // ヘッダーテキスト
  tableHeaders.forEach((header, index) => {
    page.drawText(header, {
      x: xPos + 5,
      y: yPosition - 15,
      size: 10,
      font: font,
      color: rgb(1, 1, 1),
    })
    xPos += columnWidths[index]
  })

  yPosition -= 25

  // 明細行
  invoice.lineItems.forEach((item, index) => {
    // 背景色（ストライプ）
    if (index % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: yPosition - 18,
        width: width - margin * 2,
        height: 20,
        color: rgb(0.97, 0.97, 0.97),
      })
    }

    xPos = margin
    const rowData = [
      item.description,
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.amount)
    ]

    rowData.forEach((data, colIndex) => {
      const align = colIndex === 0 ? 'left' : 'right'
      const textWidth = font.widthOfTextAtSize(data, 9)
      const textX = align === 'right' ? xPos + columnWidths[colIndex] - textWidth - 5 : xPos + 5
      
      page.drawText(data, {
        x: textX,
        y: yPosition - 14,
        size: 9,
        font: font,
      })
      xPos += columnWidths[colIndex]
    })

    yPosition -= 20
  })

  // 罫線
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })

  yPosition -= 30

  // 合計セクション
  const summaryX = width - margin - 200
  
  const subtotalText = '小計:'
  const subtotalValue = formatCurrency(invoice.subtotal)
  const subtotalValueWidth = font.widthOfTextAtSize(subtotalValue, 11)
  
  page.drawText(subtotalText, {
    x: summaryX,
    y: yPosition,
    size: 11,
    font: font,
  })
  page.drawText(subtotalValue, {
    x: width - margin - subtotalValueWidth - 10,
    y: yPosition,
    size: 11,
    font: font,
  })
  yPosition -= 20

  const taxText = `消費税 (${(invoice.taxRate * 100).toFixed(0)}%):`
  const taxValue = formatCurrency(invoice.tax)
  const taxValueWidth = font.widthOfTextAtSize(taxValue, 11)
  
  page.drawText(taxText, {
    x: summaryX,
    y: yPosition,
    size: 11,
    font: font,
  })
  page.drawText(taxValue, {
    x: width - margin - taxValueWidth - 10,
    y: yPosition,
    size: 11,
    font: font,
  })
  yPosition -= 25

  // 合計額の背景
  page.drawRectangle({
    x: summaryX - 10,
    y: yPosition - 15,
    width: 210,
    height: 25,
    color: rgb(0.95, 0.95, 0.95),
  })

  const totalText = '合計:'
  const totalValue = formatCurrency(invoice.total)
  const totalValueWidth = font.widthOfTextAtSize(totalValue, 14)
  
  page.drawText(totalText, {
    x: summaryX,
    y: yPosition,
    size: 14,
    font: font,
  })
  page.drawText(totalValue, {
    x: width - margin - totalValueWidth - 10,
    y: yPosition,
    size: 14,
    font: font,
    color: rgb(0.23, 0.51, 0.97),
  })

  yPosition -= 40

  // 支払情報
  page.drawText('支払情報:', {
    x: margin,
    y: yPosition,
    size: 12,
    font: font,
  })
  yPosition -= 20

  page.drawText(`銀行: ${companyInfo.bankName} ${companyInfo.branchName}`, {
    x: margin,
    y: yPosition,
    size: 9,
    font: font,
  })
  yPosition -= 15

  page.drawText(`口座種別: ${companyInfo.accountType}`, {
    x: margin,
    y: yPosition,
    size: 9,
    font: font,
  })
  yPosition -= 15

  page.drawText(`口座番号: ${companyInfo.accountNumber}`, {
    x: margin,
    y: yPosition,
    size: 9,
    font: font,
  })
  yPosition -= 25

  // 備考
  if (invoice.notes) {
    page.drawText('備考:', {
      x: margin,
      y: yPosition,
      size: 11,
      font: font,
    })
    yPosition -= 18

    page.drawText(invoice.notes, {
      x: margin,
      y: yPosition,
      size: 9,
      font: font,
    })
  }

  // フッター
  const footerText = `発行日時: ${new Date().toLocaleDateString('ja-JP')}`
  const footerWidth = font.widthOfTextAtSize(footerText, 8)
  page.drawText(footerText, {
    x: width / 2 - footerWidth / 2,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  })

  return pdfDoc
}

export async function downloadInvoicePDFV3(invoice: Invoice, companyInfo: any) {
  const pdfDoc = await generateInvoicePDFV3(invoice, companyInfo)
  const pdfBytes = await pdfDoc.save()
  
  // ブラウザでダウンロード
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.invoiceNumber}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}