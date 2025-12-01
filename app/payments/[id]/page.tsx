"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useToast } from "@/hooks/use-toast";
import type { PaymentInvoice } from "../../../lib/payment-types";

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // 🔥 ここが重要！ Promise を await する
      const { id } = await params;

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        toast({
          title: "エラー",
          description: "支払データを読み込めませんでした。",
          variant: "destructive",
        });
        router.push("/payments");
        return;
      }

      setInvoice(data as PaymentInvoice);
      setLoading(false);
    };

    load();
  }, [params, router, supabase, toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (!invoice) return null;

  const statusColor =
    invoice.status === "paid"
      ? "text-green-600 bg-green-100"
      : invoice.status === "pending"
      ? "text-yellow-600 bg-yellow-100"
      : "text-red-600 bg-red-100";

  // --- 支払済みに更新する処理 ---
  const markAsPaid = async () => {
    if (!invoice) return;

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_date: new Date().toISOString().split("T")[0], // 今日の日付（YYYY-MM-DD）
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "エラー",
        description: "支払済みに更新できませんでした。",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "更新完了",
      description: "ステータスを「支払済み」に変更しました。",
    });

    // 最新データを反映
    setInvoice({
      ...invoice,
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
  };

  // --- 支払済みを未払いに戻す処理 ---
  const markAsUnpaid = async () => {
    if (!invoice) return;

    const { error } = await supabase
      .from("invoices")
      .update({
        status: "pending",
        paid_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) {
      toast({
        title: "エラー",
        description: "未払いに戻せませんでした。",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "更新完了",
      description: "ステータスを「未払い」に戻しました。",
    });

    // 最新データを反映
    setInvoice({
      ...invoice,
      status: "pending",
      paid_date: null,
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => router.push("/payments")}
        className="text-blue-600 hover:underline text-sm"
      >
        ← 支払い一覧に戻る
      </button>

      <h1 className="text-3xl font-bold text-foreground">支払詳細</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow">
        <div className="grid grid-cols-2 gap-4 text-sm">

          <div>
            <p className="text-gray-500">請求書番号</p>
            <p className="font-medium">{invoice.invoice_number}</p>
          </div>

          <div>
            <p className="text-gray-500">取引先</p>
            <p className="font-medium">{invoice.client_name}</p>
          </div>

          <div>
            <p className="text-gray-500">金額</p>
            <p className="font-bold text-lg">
              ¥{Number(invoice.amount).toLocaleString()}
            </p>
          </div>

          <div>
            <p className="text-gray-500">ステータス</p>
            <span
              className={`px-3 py-1 text-xs rounded-full font-semibold ${statusColor}`}
            >
              {invoice.status === "paid"
                ? "支払済み"
                : invoice.status === "pending"
                ? "未払い"
                : "期限切れ"}
            </span>
          </div>

          <div>
            <p className="text-gray-500">期限日</p>
            <p>{invoice.due_date}</p>
          </div>

          <div>
            <p className="text-gray-500">支払日</p>
            <p>{invoice.paid_date ?? "-"}</p>
          </div>

          {/* 支払済みに更新 or 未払いに戻すボタン */}
          <div className="mt-6">
            {invoice.status !== "paid" ? (
              <button
                onClick={markAsPaid}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow"
              >
                支払済みに更新する
              </button>
            ) : (
              <button
                onClick={markAsUnpaid}
                className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow"
              >
                未払いに戻す
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
