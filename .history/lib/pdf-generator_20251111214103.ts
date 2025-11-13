import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"

// NotoSansJPフォントを埋め込む必要がありますが、今回は英数字と基本的な日本語対応とします
export function generateInvoicePDF(invoice: Invoice, companyInfo: any) {
  const doc = new jsPDF()
  
  // PDFのタイトル
  doc.setFontSize(20)
  doc.text("請求書 / INVOICE", 105, 20, { align: "center" })
  
  // 請求書番号と日付
  doc.setFontSize(10)
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 20, 35)
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, 20, 42)
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 20, 49)
  
  // ステータス
  const statusText = invoice.status === "paid" ? "PAID" : invoice.status === "pending" ? "PENDING" : "OVERDUE"
  doc.setFontSize(12)
  doc.setTextColor(invoice.status === "paid" ? 0 : invoice.status === "overdue" ? 255 : 200, 
                   invoice.status === "paid" ? 150 : 0, 
                   0)
  doc.text(statusText, 170, 35)
  doc.setTextColor(0, 0, 0)
  
  // 発行者情報
  doc.setFontSize(10)
  doc.text("From:", 20, 65)
  doc.setFont(undefined, "bold")
  doc.text(companyInfo.name, 20, 72)
  doc.setFont(undefined, "normal")
  doc.text(companyInfo.address, 20, 79)
  doc.text(companyInfo.email, 20, 86)
  doc.text(companyInfo.phone, 20, 93)
  
  // 請求先情報
  doc.text("Bill To:", 120, 65)
  doc.setFont(undefined, "bold")
  doc.text(invoice.client.name, 120, 72)
  doc.setFont(undefined, "normal")
  doc.text(invoice.client.address, 120, 79)
  doc.text(invoice.client.email, 120, 86)
  if (invoice.client.phone) {
    doc.text(invoice.client.phone, 120, 93)
  }
  
  // 明細テーブル
  const tableData = invoice.lineItems.map((item) => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unitPrice),
    formatCurrency(item.amount),
  ])
  
  autoTable(doc, {
    startY: 105,
    head: [["Description", "Quantity", "Unit Price", "Amount"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 40, halign: "right" },
    },
  })
  
  // 合計金額セクション
  const finalY = (doc as any).lastAutoTable.finalY || 105
  const summaryX = 120
  let summaryY = finalY + 15
  
  doc.setFontSize(10)
  doc.text("Subtotal:", summaryX, summaryY)
  doc.text(formatCurrency(invoice.subtotal), 180, summaryY, { align: "right" })
  
  summaryY += 7
  doc.text(`Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, summaryX, summaryY)
  doc.text(formatCurrency(invoice.tax), 180, summaryY, { align: "right" })
  
  summaryY += 10
  doc.setFont(undefined, "bold")
  doc.setFontSize(12)
  doc.text("Total:", summaryX, summaryY)
  doc.text(formatCurrency(invoice.total), 180, summaryY, { align: "right" })
  doc.setFont(undefined, "normal")
  doc.setFontSize(10)
  
  // 支払情報
  summaryY += 15
  doc.text("Payment Information:", 20, summaryY)
  summaryY += 7
  doc.setFontSize(9)
  doc.text(`Bank: ${companyInfo.bankName} ${companyInfo.branchName}`, 20, summaryY)
  summaryY += 5
  doc.text(`Account Type: ${companyInfo.accountType}`, 20, summaryY)
  summaryY += 5
  doc.text(`Account Number: ${companyInfo.accountNumber}`, 20, summaryY)
  
  // 備考
  if (invoice.notes) {
    summaryY += 10
    doc.setFontSize(10)
    doc.text("Notes:", 20, summaryY)
    summaryY += 7
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(invoice.notes, 170)
    doc.text(splitNotes, 20, summaryY)
  }
  
  // フッター
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleDateString("ja-JP")}`, 105, pageHeight - 10, { align: "center" })
  
  return doc
}

export function downloadInvoicePDF(invoice: Invoice, companyInfo: any) {
  const doc = generateInvoicePDF(invoice, companyInfo)
  doc.save(`${invoice.invoiceNumber}.pdf`)
}