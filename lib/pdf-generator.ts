import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"

// 日本語対応のため、ラベルは英語にして内容を日本語で表示
export function generateInvoicePDF(invoice: Invoice, companyInfo: any) {
  const doc = new jsPDF()
  
  // PDFのタイトル
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", 105, 20, { align: "center" })
  
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text("請求書", 105, 28, { align: "center" })
  
  // 請求書番号と日付
  doc.setFontSize(10)
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 20, 45)
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, 20, 52)
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 20, 59)
  
  // 期限切れ判定: 支払期限が現在日時を過ぎている場合のみステータス表示
  const isPaid = invoice.paidDate != null
  const isExpired = !isPaid && new Date(invoice.dueDate) < new Date()

  if (isPaid) {
    doc.setTextColor(22, 163, 74)
    doc.text("PAID (支払済)", 170, 45)
  } else if (isExpired) {
    doc.setTextColor(239, 68, 68)
    doc.text("OVERDUE (期限切)", 170, 45)
  } else {
    doc.setTextColor(0, 0, 0)
    doc.text("UNPAID (未払い)", 170, 45)
  }

  doc.setTextColor(0, 0, 0)
  
  // 発行者情報
  doc.setFontSize(10)
  doc.text("FROM:", 20, 75)
  doc.setFont("helvetica", "bold")
  doc.text(companyInfo.name, 20, 82)
  doc.setFont("helvetica", "normal")
  // 日本語テキストをそのまま使用
  const fromLines = [
    companyInfo.address,
    companyInfo.email,
    companyInfo.phone
  ]
  let yPos = 89
  fromLines.forEach(line => {
    doc.text(line, 20, yPos)
    yPos += 7
  })
  
  // 請求先情報
  doc.text("BILL TO:", 120, 75)
  doc.setFont("helvetica", "bold")
  doc.text(invoice.client.name, 120, 82)
  doc.setFont("helvetica", "normal")
  // 日本語テキストをそのまま使用
  const toLines = [
    invoice.client.address,
    invoice.client.email,
  ]
  if (invoice.client.phone) {
    toLines.push(invoice.client.phone)
  }
  yPos = 89
  toLines.forEach(line => {
    doc.text(line, 120, yPos)
    yPos += 7
  })
  
  // 明細テーブル
  const tableData = invoice.lineItems.map((item) => [
    item.description, // 日本語のまま
    item.quantity.toString(),
    formatCurrency(item.unitPrice),
    formatCurrency(item.amount),
  ])
  
  autoTable(doc, {
    startY: 120,
    head: [["Description / 品目", "Qty / 数量", "Unit Price / 単価", "Amount / 金額"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      font: "helvetica",
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 45, halign: "right" },
      3: { cellWidth: 45, halign: "right" },
    },
  })
  
  // 合計金額セクション
  const finalY = (doc as any).lastAutoTable.finalY || 120
  const summaryX = 110
  let summaryY = finalY + 15
  
  doc.setFontSize(10)
  doc.text("Subtotal:", summaryX, summaryY)
  doc.text("(小計)", summaryX + 30, summaryY)
  doc.text(formatCurrency(invoice.subtotal), 185, summaryY, { align: "right" })
  
  summaryY += 8
  doc.text(`Tax (${(invoice.taxRate * 100).toFixed(0)}%):`, summaryX, summaryY)
  doc.text("(消費税)", summaryX + 30, summaryY)
  doc.text(formatCurrency(invoice.tax), 185, summaryY, { align: "right" })
  
  summaryY += 12
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("TOTAL:", summaryX, summaryY)
  doc.text("(合計)", summaryX + 25, summaryY)
  doc.setTextColor(59, 130, 246)
  doc.text(formatCurrency(invoice.total), 185, summaryY, { align: "right" })
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  
  // 支払情報
  summaryY += 15
  doc.setFont("helvetica", "bold")
  doc.text("PAYMENT INFORMATION / 支払情報", 20, summaryY)
  doc.setFont("helvetica", "normal")
  summaryY += 8
  doc.setFontSize(9)
  
  const paymentLines = [
    `Bank: ${companyInfo.bankName} ${companyInfo.branchName}`,
    `Account Type: ${companyInfo.accountType}`,
    `Account No: ${companyInfo.accountNumber}`
  ]
  
  paymentLines.forEach(line => {
    doc.text(line, 20, summaryY)
    summaryY += 6
  })
  
  // 備考
  if (invoice.notes) {
    summaryY += 8
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.text("NOTES / 備考:", 20, summaryY)
    doc.setFont("helvetica", "normal")
    summaryY += 7
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(invoice.notes, 170)
    doc.text(splitNotes, 20, summaryY)
  }
  
  // フッター
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  const footerText = `Generated on ${new Date().toLocaleDateString("ja-JP", { year: 'numeric', month: '2-digit', day: '2-digit' })}`
  doc.text(footerText, 105, pageHeight - 10, { align: "center" })
  
  // 右下に会社名
  doc.text(companyInfo.name, 190, pageHeight - 10, { align: "right" })
  
  return doc
}

export function downloadInvoicePDF(invoice: Invoice, companyInfo: any) {
  const doc = generateInvoicePDF(invoice, companyInfo)
  doc.save(`${invoice.invoiceNumber}.pdf`)
}