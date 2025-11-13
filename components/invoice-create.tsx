"use client"

import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

interface InvoiceCreateProps {
  onNavigate: (page: string) => void
}

export default function InvoiceCreate({ onNavigate }: InvoiceCreateProps) {
  const [items, setItems] = useState([{ id: 1, description: "", quantity: 1, price: 0 }])

  const addItem = () => {
    setItems([...items, { id: Date.now(), description: "", quantity: 1, price: 0 }])
  }

  const removeItem = (id: number) => {
    setItems(items.filter((item) => item.id !== id))
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("invoices")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">新規請求書作成</h1>
          <p className="text-muted-foreground">請求書を作成します</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">請求先情報</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">顧客名</label>
                <input
                  type="text"
                  placeholder="株式会社◯◯"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">メールアドレス</label>
                <input
                  type="email"
                  placeholder="contact@example.com"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">住所</label>
                <input
                  type="text"
                  placeholder="東京都渋谷区..."
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">請求詳細</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">請求日</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">期限日</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">請求項目</h3>
              <button
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus size={18} />
                項目追加
              </button>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                  <input
                    type="text"
                    placeholder="品目説明"
                    className="col-span-6 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="数量"
                    className="col-span-2 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="単価"
                    className="col-span-3 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="col-span-1 p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-card border border-border rounded-lg p-6">
            <label className="block text-sm font-medium text-foreground mb-2">備考</label>
            <textarea
              placeholder="請求書に追加する備考をここに入力してください"
              rows={4}
              className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">請求額サマリー</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <p className="text-muted-foreground">小計</p>
                <p className="font-semibold text-foreground">¥0</p>
              </div>
              <div className="flex justify-between text-sm pb-3 border-b border-border">
                <p className="text-muted-foreground">消費税（10%）</p>
                <p className="font-semibold text-foreground">¥0</p>
              </div>
              <div className="flex justify-between">
                <p className="font-bold text-foreground">請求総額</p>
                <p className="text-2xl font-bold text-primary">¥0</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button className="w-full px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              請求書作成
            </button>
            <button
              onClick={() => onNavigate("invoices")}
              className="w-full px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
