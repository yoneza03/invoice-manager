"use client";

import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useToast } from "@/hooks/use-toast";

interface InvoiceCreateProps {
  onNavigate: (page: string) => void;
}

export default function InvoiceCreate({ onNavigate }: InvoiceCreateProps) {
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  // ---------------------
  // 入力値の State
  // ---------------------
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [items, setItems] = useState([
    { id: 1, description: "", quantity: 1, price: 0 },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now(), description: "", quantity: 1, price: 0 },
    ]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // ---------------------
  // 請求書保存処理
  // ---------------------
  const handleCreateInvoice = async () => {
    // ▼ログイン中のユーザー取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "エラー",
        description: "ログインユーザーが確認できません。",
        variant: "destructive",
      });
      return;
    }

    // ▼請求額合計
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;

    // ▼請求書番号（例：INV-2024-001）
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now()}`;

    // ▼DB へ保存
    const { error } = await supabase.from("invoices").insert({
      id: crypto.randomUUID(),
      user_id: user.id, // ★最重要：ユーザー紐づけ
      invoice_number: invoiceNumber,
      client_name: clientName,
      amount: total,
      status: "pending",
      due_date: dueDate,
      paid_date: null,
    });

    if (error) {
      toast({
        title: "保存エラー",
        description: "請求書を保存できませんでした。",
        variant: "destructive",
      });
      console.error(error);
      return;
    }

    toast({
      title: "保存完了",
      description: "請求書が作成されました！",
    });

    onNavigate("payments"); // ← 支払管理へ移動
  };

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => onNavigate("invoices")}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">新規請求書作成</h1>
          <p className="text-muted-foreground">請求書を作成します</p>
        </div>
      </div>

      {/* 略：フォーム部分はすべて元のまま */}
      {/* --- ここでは input に onChange を追加 --- */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              請求先情報
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">顧客名</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">住所</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">請求詳細</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm mb-2">請求日</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">期限日</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* ... items の処理も元のまま ... */}

        </div>

        {/* Summary */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">請求額サマリー</h3>
            {/* 小計・税込みはここでは0表示のまま */}
          </div>

          <div className="space-y-2">
            <button
              onClick={handleCreateInvoice}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg"
            >
              請求書作成
            </button>
            <button
              onClick={() => onNavigate("invoices")}
              className="w-full px-6 py-3 border rounded-lg"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
