"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ChevronLeft, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";

interface PaymentManagementProps {
  onNavigate: (page: string) => void;
}

interface Payment {
  id: string;
  invoice_number: string;
  amount: number | string;
  status: "paid" | "pending" | "overdue";
  due_date: string;
  paid_date?: string | null;
}

interface MonthlyGroup {
  month: string; // YYYY-MM 形式
  payments: Payment[];
  totalPaid: number;
  totalUnpaid: number;
  paidCount: number;
  unpaidCount: number;
}

export default function PaymentManagement({ onNavigate }: PaymentManagementProps) {
  const supabase = createSupabaseBrowserClient();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { updateInvoiceStatus } = useStore();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("due_date", { ascending: true });

      if (!error && data) {
        setPayments(data as Payment[]);

        // 最新月を自動的に展開
        if (data.length > 0) {
          const latestMonth = getLatestMonth(data as Payment[]);
          setExpandedMonths(new Set([latestMonth]));
        }
      }
    };

    load();
  }, []);

  // 支払日または期限日を基準に月を取得
  const getMonthFromPayment = (payment: Payment): string => {
    const dateStr = payment.paid_date || payment.due_date;
    return dateStr.substring(0, 7); // YYYY-MM
  };

  // 最新月を取得
  const getLatestMonth = (payments: Payment[]): string => {
    if (payments.length === 0) return "";
    const months = payments.map(getMonthFromPayment);
    return months.sort().reverse()[0];
  };

  // 月別にグルーピング
  const groupByMonth = (): MonthlyGroup[] => {
    const groups = new Map<string, Payment[]>();

    payments.forEach((payment) => {
      const month = getMonthFromPayment(payment);
      if (!groups.has(month)) {
        groups.set(month, []);
      }
      groups.get(month)!.push(payment);
    });

    const monthlyGroups: MonthlyGroup[] = Array.from(groups.entries()).map(([month, payments]) => {
      const paidPayments = payments.filter(p => p.status === "paid");
      const unpaidPayments = payments.filter(p => p.status === "pending" || p.status === "overdue");

      return {
        month,
        payments,
        totalPaid: paidPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        totalUnpaid: unpaidPayments.reduce((sum, p) => sum + Number(p.amount), 0),
        paidCount: paidPayments.length,
        unpaidCount: unpaidPayments.length,
      };
    });

    // 新しい月から古い月へソート
    return monthlyGroups.sort((a, b) => b.month.localeCompare(a.month));
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(month)) {
        newSet.delete(month);
      } else {
        newSet.add(month);
      }
      return newSet;
    });
  };

  const monthlyGroups = groupByMonth();

  // ステータス更新処理
  const handleStatusChange = async (paymentId: string, newStatus: "paid" | "pending" | "overdue", invoiceNumber: string) => {
    try {
      // Supabase を更新
      const { error } = await supabase
        .from("invoices")
        .update({
          status: newStatus,
          paid_date: newStatus === "paid" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) {
        console.error('[handleStatusChange] Supabase更新エラー:', error);
        toast({
          title: "更新エラー",
          description: `ステータスを更新できませんでした: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      // LocalStorage (useStore) も更新
      // "pending" → "unpaid" に変換して updateInvoiceStatus を呼び出す
      const mappedStatus = newStatus === "pending" ? "unpaid" : newStatus;
      updateInvoiceStatus(paymentId, mappedStatus as any);

      // ローカルの状態を更新
      setPayments(prev => prev.map(p =>
        p.id === paymentId
          ? { ...p, status: newStatus, paid_date: newStatus === "paid" ? new Date().toISOString() : null }
          : p
      ));

      toast({
        title: "ステータス更新",
        description: `請求書 ${invoiceNumber} のステータスを更新しました`,
      });

      console.log(`[handleStatusChange] 請求書 ${invoiceNumber} を ${newStatus} に更新しました`);
    } catch (err) {
      console.error('[handleStatusChange] エラー:', err);
      toast({
        title: "更新エラー",
        description: "ステータスの更新中にエラーが発生しました",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: "paid" | "pending" | "overdue") => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
    }
  };

  return (
    <div className="p-8 lg:p-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => onNavigate("dashboard")}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">支払管理</h1>
          <p className="text-muted-foreground">支払状況の確認と管理</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          icon={<CheckCircle size={24} className="text-green-500" />}
          label="支払済み"
          value={payments.filter(p => p.status === "paid").reduce((a,b) => a + Number(b.amount), 0)}
          count={payments.filter(p => p.status === "paid").length}
        />

        <SummaryCard
          icon={<Clock size={24} className="text-yellow-500" />}
          label="未払い"
          value={payments.filter(p => p.status === "pending").reduce((a,b) => a + Number(b.amount), 0)}
          count={payments.filter(p => p.status === "pending").length}
        />

        <SummaryCard
          icon={<AlertCircle size={24} className="text-red-500" />}
          label="期限切れ"
          value={payments.filter(p => p.status === "overdue").reduce((a,b) => a + Number(b.amount), 0)}
          count={payments.filter(p => p.status === "overdue").length}
        />
      </div>

      {/* Payments Table - Monthly Grouped */}
      <div className="space-y-4">
        {monthlyGroups.map((group) => {
          const isExpanded = expandedMonths.has(group.month);

          return (
            <div key={group.month} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Month Header - Collapsible */}
              <button
                onClick={() => toggleMonth(group.month)}
                className="w-full px-6 py-4 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  <h3 className="text-lg font-semibold text-foreground">
                    {group.month} ({group.payments.length}件)
                  </h3>
                </div>

                {/* Month Summary */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">支払済み:</span>
                    <span className="font-semibold text-green-600">
                      ¥{group.totalPaid.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">({group.paidCount}件)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">未払い:</span>
                    <span className="font-semibold text-yellow-600">
                      ¥{group.totalUnpaid.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">({group.unpaidCount}件)</span>
                  </div>
                </div>
              </button>

              {/* Payments Table for this month */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <Th>請求書ID</Th>
                        <Th>金額</Th>
                        <Th>ステータス</Th>
                        <Th>期限日</Th>
                        <Th>支払日</Th>
                        <Th>アクション</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.payments.map((p) => (
                        <tr key={p.id} className="border-b border-border hover:bg-muted/50">
                          <Td>{p.invoice_number}</Td>
                          <Td>¥{Number(p.amount).toLocaleString()}</Td>
                          <Td>
                            <Select
                              value={p.status}
                              onValueChange={(value) => handleStatusChange(p.id, value as "paid" | "pending" | "overdue", p.invoice_number)}
                            >
                              <SelectTrigger className={`w-[140px] ${getStatusBadgeColor(p.status)} border-0 font-semibold`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">未払い</SelectItem>
                                <SelectItem value="paid">支払済み</SelectItem>
                                <SelectItem value="overdue">期限切れ</SelectItem>
                              </SelectContent>
                            </Select>
                          </Td>
                          <Td>{p.due_date}</Td>
                          <Td>{p.paid_date || "-"}</Td>
                          <Td>
                            <Link href={`/payments/${p.id}`}>
                              <button className="px-3 py-1 border border-primary text-primary font-medium rounded-lg text-xs">
                                詳細
                              </button>
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, count }: { icon: React.ReactNode; label: string; value: number; count: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <p className="text-muted-foreground text-sm">{label}</p>
      </div>
      <p className="text-3xl font-bold text-foreground">¥{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-2">{count}件</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="py-4 px-6 text-sm text-foreground">
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  const style =
    status === "paid"
      ? "bg-green-100 text-green-800"
      : status === "pending"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style}`}>
      {status === "paid" ? "支払済み" : status === "pending" ? "未払い" : "期限切れ"}
    </span>
  );
}
