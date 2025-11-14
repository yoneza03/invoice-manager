"use client"

import { useState } from "react"
import { FileText, Home, DollarSign, Search, Settings, Menu, X, ChevronRight, Upload, Users } from "lucide-react"

type Page = "dashboard" | "invoices" | "detail" | "create" | "import" | "payments" | "search" | "settings" | "clients"

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  const menuItems = [
    { id: "dashboard", label: "ダッシュボード", icon: Home },
    { id: "invoices", label: "請求書一覧", icon: FileText },
    { id: "create", label: "請求書作成", icon: FileText },
    { id: "import", label: "請求書インポート", icon: Upload },
    { id: "clients", label: "取引先管理", icon: Users },
    { id: "payments", label: "支払管理", icon: DollarSign },
    { id: "search", label: "検索・フィルター", icon: Search },
    { id: "settings", label: "設定", icon: Settings },
  ]

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 lg:hidden p-2 hover:bg-muted rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
          isOpen ? "w-64" : "w-0"
        } overflow-hidden lg:relative lg:w-64 z-40`}
      >
        <div className="p-6 pt-16 lg:pt-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-sidebar-primary">請求書管理</h1>
            <p className="text-sidebar-foreground/60 text-sm mt-1">Invoice System</p>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id as Page)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <ChevronRight size={18} className="ml-auto" />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-sidebar-border bg-gradient-to-t from-sidebar to-transparent">
          <div className="text-xs text-sidebar-foreground/60">
            <p className="font-semibold">企業情報</p>
            <p className="mt-1">v0 Inc.</p>
            <p className="text-10px">2024</p>
          </div>
        </div>
      </div>

      {/* Overlay on mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
