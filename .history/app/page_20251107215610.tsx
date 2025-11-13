"use client"

import { useState } from "react"
import Dashboard from "@/components/dashboard"
import InvoiceList from "@/components/invoice-list"
import InvoiceDetail from "@/components/invoice-detail"
import InvoiceCreateEnhanced from "@/components/invoice-create-enhanced"
import PaymentManagement from "@/components/payment-management"
import SearchFilter from "@/components/search-filter"
import Settings from "@/components/settings"
import Sidebar from "@/components/sidebar"

type Page = "dashboard" | "invoices" | "detail" | "create" | "payments" | "search" | "settings"

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

  const handleNavigate = (page: Page, invoiceId?: string) => {
    setCurrentPage(page)
    if (invoiceId) {
      setSelectedInvoiceId(invoiceId)
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />
      case "invoices":
        return <InvoiceList onNavigate={handleNavigate} />
      case "detail":
        return <InvoiceDetail onNavigate={handleNavigate} invoiceId={selectedInvoiceId} />
      case "create":
        return <InvoiceCreateEnhanced onNavigate={handleNavigate} />
      case "payments":
        return <PaymentManagement onNavigate={handleNavigate} />
      case "search":
        return <SearchFilter onNavigate={handleNavigate} />
      case "settings":
        return <Settings onNavigate={handleNavigate} />
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
