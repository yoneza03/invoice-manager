"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { Invoice, Client, Settings, Payment, InvoiceStatus, User, LoginCredentials, AuthState } from "./types"
import { mockInvoices, mockClients, mockSettings, mockPayments } from "./mock-data"
import { migrateInvoiceStorage } from "./migration"
import { updateInvoiceStatus as apiUpdateInvoiceStatus } from "./api"

interface StoreContextType {
  invoices: Invoice[]
  clients: Client[]
  settings: Settings
  payments: Payment[]
  authState: AuthState
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
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: () => void
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [clients, setClients] = useState<Client[]>(mockClients)
  const [settings, setSettings] = useState<Settings>(mockSettings)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
  })

  // LocalStorageからデータを読み込む
  useEffect(() => {
    // 認証状態を復元
    const savedUser = localStorage.getItem("user")
    if (savedUser) {
      setAuthState({
        isAuthenticated: true,
        user: JSON.parse(savedUser),
        loading: false,
      })
    } else {
      setAuthState(prev => ({ ...prev, loading: false }))
    }
    // マイグレーション処理を実行
    const migrated = localStorage.getItem('storage_migrated_v1')
    if (!migrated) {
      migrateInvoiceStorage().then(() => {
        localStorage.setItem('storage_migrated_v1', 'true')
      })
    }

    const savedInvoices = localStorage.getItem("invoices")
    const savedClients = localStorage.getItem("clients")
    const savedSettings = localStorage.getItem("settings")
    const savedPayments = localStorage.getItem("payments")

    if (savedInvoices) {
      let invoiceList: Invoice[] = JSON.parse(savedInvoices)
      
      // 自動的にoverdueステータスを判定・更新
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      let hasUpdates = false
      invoiceList = invoiceList.map(invoice => {
        // dueDate < 今日 かつ status === "unpaid" の場合、自動的に "overdue" に更新
        const dueDate = new Date(invoice.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        
        if (dueDate < today && invoice.status === "unpaid") {
          hasUpdates = true
          console.log(`[Store] 請求書 ${invoice.invoiceNumber} を自動的に overdue に更新`)
          return {
            ...invoice,
            status: "overdue" as InvoiceStatus,
            updatedAt: new Date(),
          }
        }
        return invoice
      })
      
      // 更新があった場合はLocalStorageに保存
      if (hasUpdates) {
        localStorage.setItem("invoices", JSON.stringify(invoiceList))
      }
      
      setInvoices(invoiceList)
    }
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

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    // デモ用の認証ロジック（実際はバックエンドAPIを呼び出す）
    // デモユーザー: email: demo@example.com, password: demo123
    if (credentials.email === "demo@example.com" && credentials.password === "demo123") {
      const user: User = {
        id: "user-1",
        email: credentials.email,
        name: "デモユーザー",
        createdAt: new Date(),
        lastLogin: new Date(),
      }
      
      localStorage.setItem("user", JSON.stringify(user))
      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
      })
      return true
    }
    
    setAuthState(prev => ({ ...prev, loading: false }))
    return false
  }

  const logout = () => {
    localStorage.removeItem("user")
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false,
    })
  }

  const updateInvoiceStatus = (id: string, status: InvoiceStatus) => {
    const updatedInvoice = apiUpdateInvoiceStatus(id, status)
    if (updatedInvoice) {
      // ストアの状態を更新
      setInvoices(invoices.map((inv: Invoice) => (inv.id === id ? updatedInvoice : inv)))
    }
  }

  return (
    <StoreContext.Provider
      value={{
        invoices,
        clients,
        settings,
        payments,
        authState,
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
        login,
        logout,
        updateInvoiceStatus,
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