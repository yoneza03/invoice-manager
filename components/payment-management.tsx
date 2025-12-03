"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ChevronLeft, CheckCircle, Clock, AlertCircle } from "lucide-react";

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

export default function PaymentManagement({ onNavigate }: PaymentManagementProps) {
  const supabase = createSupabaseBrowserClient();
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("due_date", { ascending: true });

      if (!error && data) setPayments(data as Payment[]);
    };

    load();
  }, []);

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

      {/* Payments Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
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
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/50">
                  <Td>{p.invoice_number}</Td>
                  <Td>¥{Number(p.amount).toLocaleString()}</Td>
                  <Td>
                    <StatusBadge status={p.status} />
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
