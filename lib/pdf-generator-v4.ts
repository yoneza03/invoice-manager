import { Invoice } from "./types"
import { formatCurrency, formatDate } from "./api"

export async function downloadInvoicePDFV4(invoice: Invoice, companyInfo: any) {
  // クライアントサイドでのみ動作するように動的インポート
  const html2pdf = (await import("html2pdf.js")).default
  
  // 期限切れ判定: 支払期限が現在日時を過ぎているかチェック
  const isExpired = new Date(invoice.dueDate) < new Date()
  const statusColor = "#ef4444" // 期限切の場合の赤色
  
  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        
        body {
          font-family: 'Noto Sans JP', sans-serif;
          padding: 40px;
          color: #333;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 10px;
        }
        
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .invoice-number {
          font-size: 14px;
        }
        
        .status {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 16px;
          color: white;
          background-color: ${statusColor};
        }
        
        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        
        .party {
          width: 45%;
        }
        
        .party-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 10px;
          color: #6b7280;
        }
        
        .party-name {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 5px;
        }
        
        .party-details {
          font-size: 12px;
          line-height: 1.6;
          color: #6b7280;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        th {
          background-color: #3b82f6;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 700;
          font-size: 12px;
        }
        
        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
        }
        
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .text-right {
          text-align: right;
        }
        
        .summary {
          margin-left: auto;
          width: 300px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 13px;
        }
        
        .summary-row.total {
          background-color: #f3f4f6;
          padding: 12px;
          margin-top: 10px;
          font-weight: 700;
          font-size: 16px;
          color: #3b82f6;
        }
        
        .payment-info {
          background-color: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .payment-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        .payment-details {
          font-size: 11px;
          line-height: 1.8;
        }
        
        .notes {
          margin-top: 20px;
          padding: 15px;
          background-color: #fef3c7;
          border-radius: 8px;
        }
        
        .notes-title {
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 8px;
        }
        
        .notes-content {
          font-size: 11px;
          line-height: 1.6;
        }
        
        .footer {
          text-align: center;
          margin-top: 40px;
          font-size: 10px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">請求書</div>
      </div>
      
      <div class="invoice-info">
        <div>
          <div class="invoice-number">請求書番号: ${invoice.invoiceNumber}</div>
          <div class="invoice-number">発行日: ${formatDate(invoice.issueDate)}</div>
          <div class="invoice-number">期限日: ${formatDate(invoice.dueDate)}</div>
        </div>
        <div>
          ${isExpired ? `<span class="status">期限切</span>` : ''}
        </div>
      </div>
      
      <div class="parties">
        <div class="party">
          <div class="party-title">発行者</div>
          <div class="party-name">${companyInfo.name}</div>
          <div class="party-details">
            ${companyInfo.address}<br>
            ${companyInfo.email}<br>
            ${companyInfo.phone}
          </div>
        </div>
        
        <div class="party">
          <div class="party-title">請求先</div>
          <div class="party-name">${invoice.client.name}</div>
          <div class="party-details">
            ${invoice.client.address}<br>
            ${invoice.client.email}<br>
            ${invoice.client.phone || ''}
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>品目</th>
            <th class="text-right">数量</th>
            <th class="text-right">単価</th>
            <th class="text-right">金額</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.lineItems.map(item => `
            <tr>
              <td>${item.description}</td>
              <td class="text-right">${item.quantity}</td>
              <td class="text-right">${formatCurrency(item.unitPrice)}</td>
              <td class="text-right">${formatCurrency(item.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="summary">
        <div class="summary-row">
          <span>小計:</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div class="summary-row">
          <span>消費税 (${(invoice.taxRate * 100).toFixed(0)}%):</span>
          <span>${formatCurrency(invoice.tax)}</span>
        </div>
        <div class="summary-row total">
          <span>合計:</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>
      
      <div class="payment-info">
        <div class="payment-title">支払情報</div>
        <div class="payment-details">
          銀行: ${companyInfo.bankName} ${companyInfo.branchName}<br>
          口座種別: ${companyInfo.accountType}<br>
          口座番号: ${companyInfo.accountNumber}
        </div>
      </div>
      
      ${invoice.notes ? `
        <div class="notes">
          <div class="notes-title">備考</div>
          <div class="notes-content">${invoice.notes}</div>
        </div>
      ` : ''}
      
      <div class="footer">
        発行日時: ${new Date().toLocaleDateString('ja-JP')} | ${companyInfo.name}
      </div>
    </body>
    </html>
  `
  
  // PDFオプション
  const options = {
    margin: 10,
    filename: `${invoice.invoiceNumber}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  }
  
  // HTMLからPDFを生成してダウンロード
  await html2pdf().set(options).from(html).save()
}