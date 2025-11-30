// 支払い詳細ページで使う Invoice 型

export type PaymentStatus = "paid" | "pending" | "overdue";

export interface PaymentInvoice {
  id: string;
  invoice_number: string; // 請求書番号
  client_name: string; // 取引先名
  amount: number; // 金額
  status: PaymentStatus; // paid / pending / overdue
  due_date: string; // 期限日
  paid_date?: string | null; // 支払日
}
