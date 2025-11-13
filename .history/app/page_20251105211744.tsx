"use client"

import { useState } from "react"
import Dashboard from "@/components/dashboard"
import InvoiceList from "@/components/invoice-list"
import InvoiceDetail from "@/components/invoice-detail"
import InvoiceCreate from "@/components/invoice-create"
import PaymentManagement from "@/components/payment-management"
import SearchFilter from "@/components/search-filter"
import Settings from "@/components/settings"
import Sidebar from "@/components/sidebar"

type Page = "dashboard" | "invoices" | "detail" | "create" | "payments" | "search" | "settings"

export default function Home() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard")

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={setCurrentPage} />
      case "invoices":
        return <InvoiceList onNavigate={setCurrentPage} />
      case "detail":
        return <InvoiceDetail onNavigate={setCurrentPage} />
      case "create":
        return <InvoiceCreate onNavigate={setCurrentPage} />
      case "payments":
        return <PaymentManagement onNavigate={setCurrentPage} />
      case "search":
        return <SearchFilter onNavigate={setCurrentPage} />
      case "settings":
        return <Settings onNavigate={setCurrentPage} />
      default:
        return <Dashboard onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  )
}
