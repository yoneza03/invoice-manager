"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { Invoice, Client, Settings, Payment, InvoiceStatus, User, LoginCredentials, AuthState, RegisterCredentials } from "./types"
import { mockInvoices, mockClients, mockSettings, mockPayments } from "./mock-data"
import { migrateInvoiceStorage } from "./migration"
import { updateInvoiceStatus as apiUpdateInvoiceStatus } from "./api"
import { createSupabaseBrowserClient } from "./supabase-browser"
import { addHashToData, verifyDataHash, createAuditLog, saveAuditLog } from "./audit-utils"


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
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; error?: string }>
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
    permissions: null,
  })

  // 初期化処理
  useEffect(() => {
    // Supabase セッションから認証状態を復元
    const supabase = createSupabaseBrowserClient()
    
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // 権限読み込み
        const { data: permData } = await supabase
          .from("permissions")
          .select("*")
          .eq("user_id", session.user.id)
          .single()

        setAuthState({
          isAuthenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || session.user.email || "ユーザー",
            createdAt: new Date(session.user.created_at),
            lastLogin: new Date(),
          },
          loading: false,
          permissions: permData ?? null,
        })
      } else {
        setAuthState(prev => ({ ...prev, loading: false }))
      }
    })

    // セッション変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthState({
          isAuthenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || session.user.email || "ユーザー",
            createdAt: new Date(session.user.created_at),
            lastLogin: new Date(),
          },
          loading: false,
          permissions: null,
        })
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          permissions: null,
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // LocalStorageからデータを読み込む
  useEffect(() => {
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
      
      // 🆕 改ざん検知処理を追加
      const verifyInvoices = async () => {
        const verifiedInvoices = await Promise.all(
          invoiceList.map(async (invoice) => {
            // ハッシュが存在する場合は検証
            if (invoice.dataHash) {
              try {
                const verifyResult = await verifyDataHash(invoice)
                if (!verifyResult.valid) {
                  console.warn(`[Store] ⚠️ 請求書 ${invoice.invoiceNumber} の改ざんを検出: ${verifyResult.message}`)
                  // 改ざん検知フラグを付与
                  return {
                    ...invoice,
                    isTampered: true,
                  }
                }
              } catch (error) {
                console.error(`[Store] 請求書 ${invoice.invoiceNumber} のハッシュ検証エラー:`, error)
              }
            }
            return invoice
          })
        )
        
        // 自動的にoverdueステータスを判定・更新
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        let hasUpdates = false
        const updatedInvoices = verifiedInvoices.map(invoice => {
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
        
        // 更新があった場合はLocalStorageに保存（ハッシュは保存時に再生成される）
        if (hasUpdates) {
          localStorage.setItem("invoices", JSON.stringify(updatedInvoices))
        }
        
        setInvoices(updatedInvoices)
      }
      
      verifyInvoices()
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

  const addInvoice = async (invoice: Invoice) => {
    try {
      // ハッシュを生成して保存
      const invoiceWithHash = (await addHashToData(invoice as unknown as Record<string, unknown>)) as unknown as Invoice
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: invoice.id,
          targetType: 'invoice',
          action: 'create',
          userId: authState.user.id,
          userName: authState.user.name,
          newValue: invoiceWithHash,
          remarks: `請求書 ${invoice.invoiceNumber} を作成`,
        })
        saveAuditLog(auditLog)
      }
      
      setInvoices([...invoices, invoiceWithHash])
      console.log(`[addInvoice] 請求書 ${invoice.invoiceNumber} を作成しました（ハッシュ: ${invoiceWithHash.dataHash?.substring(0, 16)}...）`)
    } catch (error) {
      console.error('[addInvoice] エラー:', error)
      // エラー時もデータは保存（ハッシュなし）
      setInvoices([...invoices, invoice])
    }
  }

  const updateInvoice = async (id: string, updatedInvoice: Partial<Invoice>) => {
    try {
      const oldInvoice = invoices.find((inv: Invoice) => inv.id === id)
      if (!oldInvoice) {
        console.error(`[updateInvoice] ID ${id} の請求書が見つかりません`)
        return
      }
      
      // 改ざん検証
      if (oldInvoice.dataHash) {
        const verifyResult = await verifyDataHash(oldInvoice)
        if (!verifyResult.valid) {
          console.warn(`[updateInvoice] ⚠️ 請求書 ${oldInvoice.invoiceNumber} の改ざんを検出: ${verifyResult.message}`)
        }
      }
      
      // 更新データを作成（isTamperedフラグは除去して新しいハッシュを生成）
      const newInvoice = { 
        ...oldInvoice, 
        ...updatedInvoice, 
        updatedAt: new Date(),
        isTampered: undefined, // 更新時に改ざんフラグをクリア
      }
      
      // 新しいハッシュを生成
      const newInvoiceWithHash = (await addHashToData(newInvoice as unknown as Record<string, unknown>)) as unknown as Invoice
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: id,
          targetType: 'invoice',
          action: 'update',
          userId: authState.user.id,
          userName: authState.user.name,
          oldValue: oldInvoice,
          newValue: newInvoiceWithHash,
          remarks: `請求書 ${oldInvoice.invoiceNumber} を更新`,
        })
        saveAuditLog(auditLog)
      }
      
      setInvoices(invoices.map((inv: Invoice) => (inv.id === id ? newInvoiceWithHash : inv)))
      console.log(`[updateInvoice] 請求書 ${oldInvoice.invoiceNumber} を更新しました（新ハッシュ: ${newInvoiceWithHash.dataHash?.substring(0, 16)}...）`)
    } catch (error) {
      console.error('[updateInvoice] エラー:', error)
      // エラー時も更新は実行（ハッシュなし）
      setInvoices(invoices.map((inv: Invoice) => (inv.id === id ? { ...inv, ...updatedInvoice } : inv)))
    }
  }

  const deleteInvoice = async (id: string) => {
    try {
      const invoice = invoices.find((inv: Invoice) => inv.id === id)
      if (!invoice) {
        console.error(`[deleteInvoice] ID ${id} の請求書が見つかりません`)
        return
      }
      
      // 改ざん検証
      if (invoice.dataHash) {
        const verifyResult = await verifyDataHash(invoice)
        if (!verifyResult.valid) {
          console.warn(`[deleteInvoice] ⚠️ 請求書 ${invoice.invoiceNumber} の改ざんを検出: ${verifyResult.message}`)
        }
      }
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: id,
          targetType: 'invoice',
          action: 'delete',
          userId: authState.user.id,
          userName: authState.user.name,
          oldValue: invoice,
          remarks: `請求書 ${invoice.invoiceNumber} を削除`,
        })
        saveAuditLog(auditLog)
      }
      
      setInvoices(invoices.filter((inv: Invoice) => inv.id !== id))
      console.log(`[deleteInvoice] 請求書 ${invoice.invoiceNumber} を削除しました`)
    } catch (error) {
      console.error('[deleteInvoice] エラー:', error)
      // エラー時も削除は実行
      setInvoices(invoices.filter((inv: Invoice) => inv.id !== id))
    }
  }

  const addClient = async (client: Client) => {
    try {
      // ハッシュを生成して保存
      const clientWithHash = (await addHashToData(client as unknown as Record<string, unknown>)) as unknown as Client
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: client.id,
          targetType: 'client',
          action: 'create',
          userId: authState.user.id,
          userName: authState.user.name,
          newValue: clientWithHash,
          remarks: `顧客 ${client.name} を作成`,
        })
        saveAuditLog(auditLog)
      }
      
      setClients([...clients, clientWithHash])
      console.log(`[addClient] 顧客 ${client.name} を作成しました`)
    } catch (error) {
      console.error('[addClient] エラー:', error)
      setClients([...clients, client])
    }
  }

  const updateClient = async (id: string, updatedClient: Partial<Client>) => {
    try {
      const oldClient = clients.find((c: Client) => c.id === id)
      if (!oldClient) {
        console.error(`[updateClient] ID ${id} の顧客が見つかりません`)
        return
      }
      
      // 改ざん検証
      if (oldClient.dataHash) {
        const verifyResult = await verifyDataHash(oldClient)
        if (!verifyResult.valid) {
          console.warn(`[updateClient] ⚠️ 顧客 ${oldClient.name} の改ざんを検出: ${verifyResult.message}`)
        }
      }
      
      const newClient = { ...oldClient, ...updatedClient, updatedAt: new Date() }
      const newClientWithHash = (await addHashToData(newClient as unknown as Record<string, unknown>)) as unknown as Client
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: id,
          targetType: 'client',
          action: 'update',
          userId: authState.user.id,
          userName: authState.user.name,
          oldValue: oldClient,
          newValue: newClientWithHash,
          remarks: `顧客 ${oldClient.name} を更新`,
        })
        saveAuditLog(auditLog)
      }
      
      setClients(clients.map((client: Client) => (client.id === id ? newClientWithHash : client)))
      console.log(`[updateClient] 顧客 ${oldClient.name} を更新しました`)
    } catch (error) {
      console.error('[updateClient] エラー:', error)
      setClients(clients.map((client: Client) => (client.id === id ? { ...client, ...updatedClient, updatedAt: new Date() } : client)))
    }
  }

  const deleteClient = async (id: string) => {
    try {
      const client = clients.find((c: Client) => c.id === id)
      if (!client) {
        console.error(`[deleteClient] ID ${id} の顧客が見つかりません`)
        return
      }
      
      // 改ざん検証
      if (client.dataHash) {
        const verifyResult = await verifyDataHash(client)
        if (!verifyResult.valid) {
          console.warn(`[deleteClient] ⚠️ 顧客 ${client.name} の改ざんを検出: ${verifyResult.message}`)
        }
      }
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: id,
          targetType: 'client',
          action: 'delete',
          userId: authState.user.id,
          userName: authState.user.name,
          oldValue: client,
          remarks: `顧客 ${client.name} を削除`,
        })
        saveAuditLog(auditLog)
      }
      
      setClients(clients.filter((client: Client) => client.id !== id))
      console.log(`[deleteClient] 顧客 ${client.name} を削除しました`)
    } catch (error) {
      console.error('[deleteClient] エラー:', error)
      setClients(clients.filter((client: Client) => client.id !== id))
    }
  }

  const updateSettings = (updatedSettings: Partial<Settings>) => {
    setSettings({ ...settings, ...updatedSettings })
  }

  const addPayment = async (payment: Payment) => {
    try {
      // ハッシュを生成して保存
      const paymentWithHash = (await addHashToData(payment as unknown as Record<string, unknown>)) as unknown as Payment
      
      // 監査ログを記録
      if (authState.user) {
        const auditLog = createAuditLog({
          targetId: payment.id,
          targetType: 'payment',
          action: 'create',
          userId: authState.user.id,
          userName: authState.user.name,
          newValue: paymentWithHash,
          remarks: `支払い記録を作成（請求書ID: ${payment.invoiceId}, 金額: ${payment.amount}円）`,
        })
        saveAuditLog(auditLog)
      }
      
      setPayments([...payments, paymentWithHash])
      
      // 支払いがあった請求書のステータスを更新
      await updateInvoice(payment.invoiceId, {
        status: "paid" as InvoiceStatus,
        paidDate: payment.paymentDate,
      })
      
      console.log(`[addPayment] 支払い記録を作成しました`)
    } catch (error) {
      console.error('[addPayment] エラー:', error)
      setPayments([...payments, payment])
      updateInvoice(payment.invoiceId, {
        status: "paid" as InvoiceStatus,
        paidDate: payment.paymentDate,
      })
    }
  }

  const getInvoiceById = (id: string) => {
    return invoices.find((inv: Invoice) => inv.id === id)
  }

  const getClientById = (id: string) => {
    return clients.find((client: Client) => client.id === id)
  }

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) {
        console.error("[Store] Supabase ログインエラー:", error)
        setAuthState(prev => ({ ...prev, loading: false }))
        return false
      }

    if (data.session?.user) {
      const user: User = {
        id: data.session.user.id,
        email: data.session.user.email || "",
        name: data.session.user.user_metadata?.name || data.session.user.email || "ユーザー",
        createdAt: new Date(data.session.user.created_at),
        lastLogin: new Date(),
      }

      // ★ 権限を Supabase から読み込む
      const { data: permData } = await supabase
        .from("permissions")
        .select("*")
        .eq("user_id", data.session.user.id)
        .single()

      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
        permissions: permData ?? null,   // ← ここで権限をセット
      })
      return true
    }

      setAuthState(prev => ({ ...prev, loading: false }))
      return false
    } catch (err) {
      console.error("[Store] ログイン処理エラー:", err)
      setAuthState(prev => ({ ...prev, loading: false }))
      return false
    }
  }

  const register = async (credentials: RegisterCredentials): Promise<{ success: boolean; error?: string }> => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      const supabase = createSupabaseBrowserClient()
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name,
          }
        }
      })

      if (error) {
        console.error("[Store] Supabase 登録エラー:", error)
        setAuthState(prev => ({ ...prev, loading: false }))
        return {
          success: false,
          error: error.message === "User already registered"
            ? "このメールアドレスは既に登録されています"
            : "登録中にエラーが発生しました"
        }
      }

      if (data.session?.user) {
        const user: User = {
          id: data.session.user.id,
          email: data.session.user.email || "",
          name: credentials.name || data.session.user.email || "ユーザー",
          createdAt: new Date(data.session.user.created_at),
          lastLogin: new Date(),
        }
        
        setAuthState({
          isAuthenticated: true,
          user,
          loading: false,
          permissions: null,
        })
        return { success: true }
      }

      // メール確認が必要な場合
      setAuthState(prev => ({ ...prev, loading: false }))
      return {
        success: true,
        error: "確認メールを送信しました。メールを確認してアカウントを有効化してください。"
      }
    } catch (err) {
      console.error("[Store] 登録処理エラー:", err)
      setAuthState(prev => ({ ...prev, loading: false }))
      return { success: false, error: "登録中にエラーが発生しました" }
    }
  }

  const logout = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false,
      permissions: null,
    })
  }

  const updateInvoiceStatus = (id: string, status: InvoiceStatus) => {
    const updatedInvoice = apiUpdateInvoiceStatus(id, status)
    if (updatedInvoice) {
      // isNew フラグを false に更新（ステータス変更時にNEWバッジを消す）
      updatedInvoice.isNew = false
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
        register,
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