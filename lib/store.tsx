"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { Invoice, Client, Settings, Payment, InvoiceStatus } from "./types"
import { mockInvoices, mockClients, mockSettings, mockPayments } from "./mock-data"

interface StoreContextType {
  invoices: Invoice[]
  clients: Client[]
  settings: Settings
  payments: Payment[]
  addInvoice: (invoice: Invoice) => void
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void
  deleteInvoice: (id: string) => void
  addClient: (client: Client) => void
  updateClient: (id: string, client: Partial<Client>) => void
  deleteClient: (id: string) => void
  updateSettings: (settings: Partial<Settings>) => void
  addPayment: (payment: Payment) => void
  getInvoiceById: (id: string) => Invoice | undefined
  getClientById: (id: string) => Client | undefined
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [clients, setClients] = useState<Client[]>(mockClients)
  const [settings, setSettings] = useState<Settings>(mockSettings)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)

  // LocalStorageからデータを読み込む
  useEffect(() => {
    const savedInvoices = localStorage.getItem("invoices")
    const savedClients = localStorage.getItem("clients")
    const savedSettings = localStorage.getItem("settings")
    const savedPayments = localStorage.getItem("payments")

    if (savedInvoices) setInvoices(JSON.parse(savedInvoices))
    if (savedClients) setClients(JSON.parse(savedClients))
    if (savedSettings) setSettings(JSON.parse(savedSettings))
    if (savedPayments) setPayments(JSON.parse(savedPayments))
  }, [])

  // LocalStorageにデータを保存
  useEffect(() => {
    localStorage.setItem("invoices", JSON.stringify(invoices))
  }, [invoices])

  useEffect(() => {
    localStorage.setItem("clients", JSON.stringify(clients))
  }, [clients])

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem("payments", JSON.stringify(payments))
  }, [payments])

  const addInvoice = (invoice: Invoice) => {
    setInvoices([...invoices, invoice])
  }

  const updateInvoice = (id: string, updatedInvoice: Partial<Invoice>) => {
    setInvoices(invoices.map((inv: Invoice) => (inv.id === id ? { ...inv, ...updatedInvoice } : inv)))
  }

  const deleteInvoice = (id: string) => {
    setInvoices(invoices.filter((inv: Invoice) => inv.id !== id))
  }

  const addClient = (client: Client) => {
    setClients([...clients, client])
  }

  const updateClient = (id: string, updatedClient: Partial<Client>) => {
    setClients(clients.map((client: Client) => (client.id === id ? { ...client, ...updatedClient, updatedAt: new Date() } : client)))
  }

  const deleteClient = (id: string) => {
    setClients(clients.filter((client: Client) => client.id !== id))
  }

  const updateSettings = (updatedSettings: Partial<Settings>) => {
    setSettings({ ...settings, ...updatedSettings })
  }

  const addPayment = (payment: Payment) => {
    setPayments([...payments, payment])
    // 支払いがあった請求書のステータスを更新
    updateInvoice(payment.invoiceId, {
      status: "paid" as InvoiceStatus,
      paidDate: payment.paymentDate,
    })
  }

  const getInvoiceById = (id: string) => {
    return invoices.find((inv: Invoice) => inv.id === id)
  }

  const getClientById = (id: string) => {
    return clients.find((client: Client) => client.id === id)
  }

  return (
    <StoreContext.Provider
      value={{
        invoices,
        clients,
        settings,
        payments,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        addClient,
        updateClient,
        deleteClient,
        updateSettings,
        addPayment,
        getInvoiceById,
        getClientById,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider")
  }
  return context
}