"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Plus, Trash2 } from "lucide-react"
import { useStore } from "@/lib/store"
import { generateInvoiceNumber, generateId, calculateTax, calculateTotal } from "@/lib/api"
import { Invoice, InvoiceLineItem, Client } from "@/lib/types"

interface InvoiceCreateEnhancedProps {
  onNavigate: (page: string) => void
  invoiceId?: string | null
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export default function InvoiceCreateEnhanced({ onNavigate, invoiceId }: InvoiceCreateEnhancedProps) {
  const { addInvoice, updateInvoice, getInvoiceById, clients, settings } = useStore()
  
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState<string>("")
  const [items, setItems] = useState<LineItem[]>([
    { id: generateId("item"), description: "", quantity: 1, unitPrice: 0 },
  ])
  const [notes, setNotes] = useState<string>("")
  const [isEditMode, setIsEditMode] = useState<boolean>(false)

  // 編集モードの場合、請求書データを読み込む
  useEffect(() => {
    if (invoiceId) {
      const invoice = getInvoiceById(invoiceId)
      if (invoice) {
        setIsEditMode(true)
        setSelectedClient(invoice.client.id)
        setIssueDate(new Date(invoice.issueDate).toISOString().split("T")[0])
        setDueDate(new Date(invoice.dueDate).toISOString().split("T")[0])
        setItems(invoice.lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })))
        setNotes(invoice.notes || "")
      }
    }
  }, [invoiceId, getInvoiceById])

  const addItem = () => {
    setItems([...items, { id: generateId("item"), description: "", quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id))
    }
  }

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === "description" ? value : parseFloat(value.toString()) || 0,
            }
          : item
      )
    )
  }

  const calculateSubtotal = (): number => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  const handleSubmit = () => {
    const client = clients.find((c) => c.id === selectedClient)
    if (!client) {
      alert("顧客を選択してください")
      return
    }

    if (!issueDate || !dueDate) {
      alert("発行日と期限日を入力してください")
      return
    }

    const hasEmptyItems = items.some((item) => !item.description || item.quantity <= 0 || item.unitPrice <= 0)
    if (hasEmptyItems) {
      alert("すべての請求項目を正しく入力してください")
      return
    }

    const subtotal = calculateSubtotal()
    const tax = calculateTax(subtotal, settings.company.taxRate)
    const total = subtotal + tax

    const lineItems: InvoiceLineItem[] = items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }))

    if (isEditMode && invoiceId) {
      // 更新モード
      updateInvoice(invoiceId, {
        client: client,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        lineItems: lineItems,
        subtotal: subtotal,
        tax: tax,
        taxRate: settings.company.taxRate,
        total: total,
        notes: notes,
        updatedAt: new Date(),
      })
      alert("請求書を更新しました")
    } else {
      // 新規作成モード
      const newInvoice: Invoice = {
        id: generateId("inv"),
        invoiceNumber: generateInvoiceNumber(),
        client: client,
        issueDate: new Date(issueDate),
        dueDate: new Date(dueDate),
        lineItems: lineItems,
        subtotal: subtotal,
        tax: tax,
        taxRate: settings.company.taxRate,
        total: total,
        status: "pending",
        notes: notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addInvoice(newInvoice)
      alert("請求書を作成しました")
    }
    onNavigate("invoices")
  }

  const subtotal = calculateSubtotal()
  const tax = calculateTax(subtotal, settings.company.taxRate)
  const total = subtotal + tax

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("invoices")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">{isEditMode ? "請求書編集" : "新規請求書作成"}</h1>
          <p className="text-muted-foreground">{isEditMode ? "請求書を編集します" : "請求書を作成します"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">請求先情報</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">顧客を選択</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">顧客を選択してください</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.email}
                    </option>
                  ))}
                </select>
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
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">期限日</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
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
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    className="col-span-6 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="数量"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                    className="col-span-2 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="number"
                    placeholder="単価"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                    className="col-span-3 px-3 py-2 border border-border rounded-lg bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="col-span-1 p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                    disabled={items.length === 1}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
                <p className="font-semibold text-foreground">¥{subtotal.toLocaleString()}</p>
              </div>
              <div className="flex justify-between text-sm pb-3 border-b border-border">
                <p className="text-muted-foreground">消費税（{(settings.company.taxRate * 100).toFixed(0)}%）</p>
                <p className="font-semibold text-foreground">¥{tax.toLocaleString()}</p>
              </div>
              <div className="flex justify-between">
                <p className="font-bold text-foreground">請求総額</p>
                <p className="text-2xl font-bold text-primary">¥{total.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleSubmit}
              className="w-full px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              {isEditMode ? "請求書更新" : "請求書作成"}
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