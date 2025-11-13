"use client"

import { useState } from "react"
import Dashboard from "@/components/dashboard"
import InvoiceListEnhanced from "@/components/invoice-list-enhanced"
import InvoiceDetailEnhanced from "@/components/invoice-detail-enhanced"
import InvoiceCreateEnhanced from "@/components/invoice-create-enhanced"
import InvoiceImport from "@/components/invoice-import"
import PaymentManagement from "@/components/payment-management"
import SearchFilter from "@/components/search-filter"
import SettingsEnhanced from "@/components/settings-enhanced"
import Sidebar from "@/components/sidebar"

type Page = "dashboard" | "invoices" | "detail" | "create" | "import" | "payments" | "search" | "settings"

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const handleNavigate = (page: string, invoiceId?: string) => {
    setCurrentPage(page as Page)
    if (invoiceId) {
      setSelectedInvoiceId(invoiceId)
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
        return <InvoiceCreateEnhanced onNavigate={handleNavigate} />
      case "import":
        return <InvoiceImport />
      case "payments":
        return <PaymentManagement onNavigate={handleNavigate} />
      case "search":
        return <SearchFilter onNavigate={handleNavigate} />
      case "settings":
        return <SettingsEnhanced onNavigate={handleNavigate} />
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
