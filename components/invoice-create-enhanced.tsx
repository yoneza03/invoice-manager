"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Plus, Trash2, FileText } from "lucide-react"
import { useStore } from "@/lib/store"
import { generateInvoiceNumber, generateId, calculateTax, calculateTotal } from "@/lib/api"
import { getInvoiceTemplates } from "@/lib/api/templates"
import { Invoice, InvoiceLineItem, Client, InvoiceTemplate } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"

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
  const { toast } = useToast()
  
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState<string>("")
  const [items, setItems] = useState<LineItem[]>([
    { id: generateId("item"), description: "", quantity: 1, unitPrice: 0 },
  ])
  const [notes, setNotes] = useState<string>("")
  const [isEditMode, setIsEditMode] = useState<boolean>(false)
  
  // テンプレート管理用の状態
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 認証ユーザーIDを取得
  useEffect(() => {
    const fetchUserId = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    fetchUserId()
  }, [])

  // テンプレート一覧を読み込み
  useEffect(() => {
    if (userId) {
      loadTemplates()
    }
  }, [userId])

  const loadTemplates = async () => {
    if (!userId) return
    
    try {
      const data = await getInvoiceTemplates(userId)
      setTemplates(data)
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error)
      toast({
        title: "エラー",
        description: "テンプレートの読み込みに失敗しました",
        variant: "destructive",
      })
    }
  }

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

  // テンプレートを適用
  const applyTemplate = (template: InvoiceTemplate) => {
    // バリデーション: 明細が1つもない場合はエラー
    if (!template.items || template.items.length === 0) {
      toast({
        title: "エラー",
        description: "このテンプレートには明細がありません",
        variant: "destructive",
      })
      return
    }

    // テンプレートの明細をコピー
    const templateItems: LineItem[] = template.items.map((item) => ({
      id: generateId("item"),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))
    
    // フォームに適用
    setItems(templateItems)
    
    // ダイアログを閉じる
    setIsTemplateDialogOpen(false)
    
    // 成功メッセージ
    toast({
      title: "テンプレートを適用しました",
      description: `「${template.name}」の明細${template.items.length}件を読み込みました`,
    })
  }

  const calculateSubtotal = (): number => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  const handleSubmit = () => {
    const client = clients.find((c) => c.id === selectedClient)
    if (!client) {
      toast({
        title: "エラー",
        description: "顧客を選択してください",
        variant: "destructive",
      })
      return
    }

    if (!issueDate || !dueDate) {
      toast({
        title: "エラー",
        description: "発行日と期限日を入力してください",
        variant: "destructive",
      })
      return
    }

    const hasEmptyItems = items.some((item) => !item.description || item.quantity <= 0 || item.unitPrice <= 0)
    if (hasEmptyItems) {
      toast({
        title: "エラー",
        description: "すべての請求項目を正しく入力してください",
        variant: "destructive",
      })
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
      toast({
        title: "請求書を更新しました",
        description: `請求書番号: ${getInvoiceById(invoiceId)?.invoiceNumber}`,
      })
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
        status: "unpaid",
        notes: notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addInvoice(newInvoice)
      toast({
        title: "請求書を作成しました",
        description: `請求書番号: ${newInvoice.invoiceNumber}`,
      })
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
              <div className="flex gap-2">
                <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <button
                      className="flex items-center gap-2 px-3 py-2 border border-border text-foreground font-medium rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                      <FileText size={18} />
                      テンプレート
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>テンプレートを選択</DialogTitle>
                      <DialogDescription>
                        保存されたテンプレートから選択して請求書に適用できます
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {templates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                          <p>テンプレートがありません</p>
                        </div>
                      ) : (
                        templates.map((template) => (
                          <div
                            key={template.id}
                            className="border border-border rounded-lg p-4 hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => applyTemplate(template)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold text-foreground">{template.name}</h4>
                                {template.description && (
                                  <p className="text-sm text-muted-foreground">{template.description}</p>
                                )}
                              </div>
                              <Badge variant="secondary">{template.items.length}件</Badge>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">
                                税率: {template.taxRate}%
                              </span>
                              <span className="font-semibold text-foreground">
                                ¥{template.totalAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                
                <button
                  onClick={addItem}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  <Plus size={18} />
                  項目追加
                </button>
              </div>
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