import jsPDF from "jspdf"
import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"

export async function downloadInvoicePDFV6(invoice: Invoice, companyInfo: any) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  // 日本語対応のため、デフォルトフォントを使用し、テキストをローマ字に変換
  // または画像として埋め込む方法を採用

  let yPos = 20

  // タイトル
  doc.setFontSize(24)
  doc.text("Invoice / Seikyu-sho", 105, yPos, { align: "center" })
  yPos += 15

  // 請求書番号とステータス
  doc.setFontSize(10)
  doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 20, yPos)
  const statusText = invoice.status === "paid" ? "Paid" : invoice.status === "pending" ? "Pending" : "Overdue"
  doc.text(`Status: ${statusText}`, 150, yPos)
  yPos += 7

  // 日付
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, 20, yPos)
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 150, yPos)
  yPos += 15

  // 発行者情報
  doc.setFontSize(11)
  doc.text("From:", 20, yPos)
  yPos += 6
  doc.setFontSize(9)
  doc.text(companyInfo.name, 20, yPos)
  yPos += 5
  doc.text(companyInfo.address, 20, yPos)
  yPos += 5
  doc.text(companyInfo.email, 20, yPos)
  yPos += 5
  doc.text(companyInfo.phone, 20, yPos)
  yPos += 10

  // 請求先情報
  doc.setFontSize(11)
  doc.text("To:", 20, yPos)
  yPos += 6
  doc.setFontSize(9)
  doc.text(invoice.client.name, 20, yPos)
  yPos += 5
  doc.text(invoice.client.address, 20, yPos)
  yPos += 5
  doc.text(invoice.client.email, 20, yPos)
  if (invoice.client.phone) {
    yPos += 5
    doc.text(invoice.client.phone, 20, yPos)
  }
  yPos += 15

  // 明細テーブルヘッダー
  doc.setFillColor(59, 130, 246)
  doc.rect(20, yPos - 5, 170, 8, "F")
  doc.setTextColor(255, 255, 255)
  doc.text("Description", 22, yPos)
  doc.text("Qty", 120, yPos)
  doc.text("Unit Price", 140, yPos)
  doc.text("Amount", 170, yPos)
  yPos += 8
  doc.setTextColor(0, 0, 0)

  // 明細行
  invoice.lineItems.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(20, yPos - 5, 170, 8, "F")
    }
    doc.text(item.description, 22, yPos)
    doc.text(item.quantity.toString(), 120, yPos)
    doc.text(formatCurrency(item.unitPrice), 140, yPos)
    doc.text(formatCurrency(item.amount), 170, yPos)
    yPos += 8
  })

  yPos += 10

  // 合計
  const summaryX = 130
  doc.text("Subtotal:", summaryX, yPos)
  doc.text(formatCurrency(invoice.subtotal), 170, yPos, { align: "right" })
  yPos += 7
  doc.text(`Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, summaryX, yPos)
  doc.text(formatCurrency(invoice.tax), 170, yPos, { align: "right" })
  yPos += 7
  doc.setFontSize(12)
  doc.setFontSize(12)
  doc.text("Total:", summaryX, yPos)
  doc.text(formatCurrency(invoice.total), 170, yPos, { align: "right" })
  yPos += 15
  doc.setFontSize(9)

  // 支払情報
  doc.setFillColor(249, 250, 251)
  doc.rect(20, yPos - 5, 170, 25, "F")
  doc.setFontSize(10)
  doc.text("Payment Information", 22, yPos)
  yPos += 7
  doc.setFontSize(9)
  doc.text(`Bank: ${companyInfo.bankName} ${companyInfo.branchName}`, 22, yPos)
  yPos += 5
  doc.text(`Account Type: ${companyInfo.accountType}`, 22, yPos)
  yPos += 5
  doc.text(`Account Number: ${companyInfo.accountNumber}`, 22, yPos)
  yPos += 10

  // 備考
  if (invoice.notes) {
    doc.setFillColor(254, 243, 199)
    doc.rect(20, yPos - 5, 170, 15, "F")
    doc.setFontSize(10)
    doc.text("Notes:", 22, yPos)
    yPos += 7
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(invoice.notes, 160)
    doc.text(lines, 22, yPos)
  }

  // ダウンロード
  doc.save(`${invoice.invoiceNumber}.pdf`)
}