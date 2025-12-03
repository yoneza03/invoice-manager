"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/lib/store"
import Dashboard from "@/components/dashboard"
import InvoiceListEnhanced from "@/components/invoice-list-enhanced"
import InvoiceDetailEnhanced from "@/components/invoice-detail-enhanced"
import InvoiceCreateEnhanced from "@/components/invoice-create-enhanced"
import InvoiceImport from "@/components/invoice-import"
import PaymentManagement from "@/components/payment-management"
import SearchFilterEnhanced from "@/components/search-filter-enhanced"
import SettingsEnhanced from "@/components/settings-enhanced"
import ClientManagement from "@/components/client-management"
import Sidebar from "@/components/sidebar"

type Page = "dashboard" | "invoices" | "detail" | "create" | "import" | "payments" | "search" | "settings" | "clients" | "templates" | "admin-users"

export default function Home() {
  const router = useRouter()
  const { authState } = useStore()
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)

  useEffect(() => {
    if (!authState.loading && !authState.isAuthenticated) {
      router.push("/login")
    }
  }, [authState.isAuthenticated, authState.loading, router])

  if (authState.loading) {
    return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>
  }

  if (!authState.isAuthenticated) {
    return null
  }

  const handleNavigate = (page: string, invoiceId?: string) => {
    if (page === "invoice-edit") {
      // 編集モードの場合はcreateページに遷移してinvoiceIdを渡す
      setCurrentPage("create")
      setEditingInvoiceId(invoiceId || null)
    } else if (page === "templates") {
      // テンプレート管理ページへ遷移（App Routerを使用）
      router.push("/templates")
    } else if (page === "payments") {
      // 支払管理ページへ遷移（App Routerを使用）
      router.push("/payments")
    } else {
      setCurrentPage(page as Page)
      setEditingInvoiceId(null)
      if (invoiceId) {
        setSelectedInvoiceId(invoiceId)
      }
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />
      case "invoices":
        return <InvoiceListEnhanced onNavigate={handleNavigate} />
      case "detail":
        return <InvoiceDetailEnhanced onNavigate={handleNavigate} invoiceId={selectedInvoiceId} />
      case "create":
        return <InvoiceCreateEnhanced onNavigate={handleNavigate} invoiceId={editingInvoiceId} />
      case "import":
        return <InvoiceImport />
      case "clients":
        return <ClientManagement onNavigate={handleNavigate} />
      case "payments":
        return <PaymentManagement onNavigate={handleNavigate} />
      case "search":
        return <SearchFilterEnhanced onNavigate={handleNavigate} />
      case "settings":
        return <SettingsEnhanced onNavigate={handleNavigate} />
      case "admin-users":
        return <AdminUserList onNavigate={handleNavigate} />

      default:
        return <Dashboard onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}
