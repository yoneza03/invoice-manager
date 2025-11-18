import React from "react"
import { pdf, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"
import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"

// Noto Sans JPフォントを登録（ローカルフォントを使用）
// Variable Fontを使用してすべてのウェイトに対応
Font.register({
  family: "NotoSansJP",
  src: "/fonts/NotoSansJP-Regular.ttf",
})

// スタイル定義（日本語フォント適用）
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "NotoSansJP",
  },
  header: {
    textAlign: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#1e40af",
    marginBottom: 10,
  },
  invoiceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: "2px solid #e5e7eb",
  },
  invoiceInfoLeft: {
    flexDirection: "column",
  },
  invoiceInfoRight: {
    alignItems: "flex-end",
  },
  invoiceNumber: {
    fontSize: 10,
    marginBottom: 5,
  },
  status: {
    padding: "8px 16px",
    borderRadius: 20,
    fontWeight: 700,
    fontSize: 14,
    color: "white",
  },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  party: {
    width: "45%",
  },
  partyTitle: {
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 8,
    color: "#6b7280",
  },
  partyName: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 5,
  },
  partyDetails: {
    fontSize: 9,
    lineHeight: 1.6,
    color: "#6b7280",
  },
  registrationNumber: {
    fontSize: 9,
    color: "#374151",
    marginTop: 4,
    marginBottom: 4,
    fontFamily: "NotoSansJP",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#3b82f6",
    padding: 10,
    color: "white",
    fontWeight: 700,
    fontSize: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e7eb",
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: "#f9fafb",
  },
  col1: { width: "45%" },
  col2: { width: "15%", textAlign: "right" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  summary: {
    marginLeft: "auto",
    width: "40%",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 11,
  },
  summaryTotal: {
    backgroundColor: "#f3f4f6",
    padding: 10,
    marginTop: 8,
    fontWeight: 700,
    fontSize: 14,
    color: "#3b82f6",
  },
  paymentInfo: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  paymentTitle: {
    fontWeight: 700,
    fontSize: 12,
    marginBottom: 8,
  },
  paymentDetails: {
    fontSize: 9,
    lineHeight: 1.8,
  },
  notes: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
  },
  notesTitle: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 6,
  },
  notesContent: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  footer: {
    textAlign: "center",
    marginTop: 30,
    fontSize: 8,
    color: "#9ca3af",
  },
})

// PDFドキュメントコンポーネント
const InvoicePDF = ({ invoice, companyInfo }: { invoice: Invoice; companyInfo: any }) => {
  const statusText = invoice.status === "paid" ? "支払済" : invoice.status === "pending" ? "未払" : "期限切"
  const statusColor = invoice.status === "paid" ? "#22c55e" : invoice.status === "overdue" ? "#ef4444" : "#f59e0b"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>請求書</Text>
        </View>

        {/* 請求書情報 */}
        <View style={styles.invoiceInfo}>
          <View style={styles.invoiceInfoLeft}>
            <Text style={styles.invoiceNumber}>請求書番号: {invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceNumber}>発行日: {formatDate(invoice.issueDate)}</Text>
            <Text style={styles.invoiceNumber}>支払期限: {formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={styles.invoiceInfoRight}>
            <Text style={[styles.status, { backgroundColor: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* 発行者・請求先 */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyTitle}>発行者</Text>
            <Text style={styles.partyName}>{companyInfo.name}</Text>
            {companyInfo.registrationNumber && (
              <Text style={styles.registrationNumber}>
                登録番号: {companyInfo.registrationNumber}
              </Text>
            )}
            <Text style={styles.partyDetails}>{companyInfo.address}</Text>
            <Text style={styles.partyDetails}>{companyInfo.email}</Text>
            <Text style={styles.partyDetails}>{companyInfo.phone}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.partyTitle}>請求先</Text>
            <Text style={styles.partyName}>{invoice.client.name}</Text>
            <Text style={styles.partyDetails}>{invoice.client.address}</Text>
            <Text style={styles.partyDetails}>{invoice.client.email}</Text>
            {invoice.client.phone && <Text style={styles.partyDetails}>{invoice.client.phone}</Text>}
          </View>
        </View>

        {/* 明細テーブル */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>品目</Text>
            <Text style={styles.col2}>数量</Text>
            <Text style={styles.col3}>単価</Text>
            <Text style={styles.col4}>金額</Text>
          </View>
          {invoice.lineItems.map((item, index) => (
            <View key={item.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.col4}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* 合計 */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>小計:</Text>
            <Text>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>消費税 ({(invoice.taxRate * 100).toFixed(0)}%):</Text>
            <Text>{formatCurrency(invoice.tax)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text>合計:</Text>
            <Text>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* 支払情報 */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>お支払い情報</Text>
          <Text style={styles.paymentDetails}>銀行: {companyInfo.bankName}</Text>
          <Text style={styles.paymentDetails}>支店: {companyInfo.branchName}</Text>
          <Text style={styles.paymentDetails}>口座種別: {companyInfo.accountType}</Text>
          <Text style={styles.paymentDetails}>口座番号: {companyInfo.accountNumber}</Text>
        </View>

        {/* 備考 */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>備考</Text>
            <Text style={styles.notesContent}>{invoice.notes}</Text>
          </View>
        )}

        {/* フッター */}
        <Text style={styles.footer}>
          発行日時: {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })} | {companyInfo.name}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * 日本語対応PDF生成・ダウンロード関数
 * @param invoice 請求書データ
 * @param companyInfo 会社情報
 */
export async function downloadInvoicePDFJapanese(invoice: Invoice, companyInfo: any) {
  try {
    const blob = await pdf(<InvoicePDF invoice={invoice} companyInfo={companyInfo} />).toBlob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `請求書_${invoice.invoiceNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("PDF生成エラー:", error)
    throw new Error("PDFの生成に失敗しました")
  }
}