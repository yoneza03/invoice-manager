"use client"

import { ChevronLeft, Search } from "lucide-react"

interface SearchFilterProps {
  onNavigate: (page: string) => void
}

export default function SearchFilter({ onNavigate }: SearchFilterProps) {
  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">検索・フィルター</h1>
          <p className="text-muted-foreground">請求書の詳細検索</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium text-foreground mb-2">キーワード検索</label>
          <div className="relative">
            <Search className="absolute left-4 top-3 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="請求書IDまたは顧客名で検索..."
              className="w-full pl-12 pr-4 py-3 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">ステータス</label>
            <div className="space-y-2">
              {["支払済み", "未払い", "期限切れ"].map((status) => (
                <label key={status} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border" />
                  <span className="text-foreground">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <label className="block text-sm font-medium text-foreground mb-3">金額範囲</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="最小額"
                className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                placeholder="最大額"
                className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <label className="block text-sm font-medium text-foreground mb-3">期間</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="date"
                className="px-4 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-border">
            <button className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              検索
            </button>
            <button className="flex-1 px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors">
              リセット
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
