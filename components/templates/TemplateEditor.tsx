"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  InvoiceTemplate,
  CreateInvoiceTemplateRequest,
  UpdateInvoiceTemplateRequest,
  InvoiceLineItem
} from "@/lib/types"

interface TemplateEditorProps {
  initialData?: InvoiceTemplate | null
  mode: "create" | "edit"
  onSave: (data: CreateInvoiceTemplateRequest | UpdateInvoiceTemplateRequest) => Promise<void>
  onCancel?: () => void
}

interface FormData {
  name: string
  description: string
  items: InvoiceLineItem[]
  taxRate: number
}

export function TemplateEditor({ initialData, mode, onSave, onCancel }: TemplateEditorProps) {
  const [formData, setFormData] = useState<FormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    items: initialData?.items || [],
    taxRate: initialData?.taxRate || 10
  })
  
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; items?: string }>({})

  // 自動計算：小計
  const calculateSubtotal = (items: InvoiceLineItem[]): number => {
    return items.reduce((sum, item) => sum + item.amount, 0)
  }

  // 自動計算：税額
  const calculateTaxAmount = (subtotal: number, taxRate: number): number => {
    return Math.floor(subtotal * (taxRate / 100))
  }

  // 自動計算：合計金額
  const calculateTotalAmount = (subtotal: number, taxAmount: number): number => {
    return subtotal + taxAmount
  }

  const subtotal = calculateSubtotal(formData.items)
  const taxAmount = calculateTaxAmount(subtotal, formData.taxRate)
  const totalAmount = calculateTotalAmount(subtotal, taxAmount)

  // 明細行を追加
  const handleAddItem = () => {
    const newItem: InvoiceLineItem = {
      id: `item-${Date.now()}`,
      description: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0
    }
    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    })
  }

  // 明細行を削除
  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      items: newItems
    })
  }

  // 明細行を更新
  const handleUpdateItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const newItems = [...formData.items]
    const item = newItems[index]

    if (field === "description") {
      item.description = value as string
    } else if (field === "quantity") {
      item.quantity = Number(value)
      item.amount = item.quantity * item.unitPrice
    } else if (field === "unitPrice") {
      item.unitPrice = Number(value)
      item.amount = item.quantity * item.unitPrice
    }

    setFormData({
      ...formData,
      items: newItems
    })
  }

  // バリデーション
  const validate = (): boolean => {
    const newErrors: { name?: string; items?: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = "テンプレート名は必須です"
    }

    if (formData.items.length === 0) {
      newErrors.items = "明細行を最低1行追加してください"
    } else {
      const hasEmptyDescription = formData.items.some(item => !item.description.trim())
      if (hasEmptyDescription) {
        newErrors.items = "明細行の品名を入力してください"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 保存処理
  const handleSave = async () => {
    if (!validate()) {
      return
    }

    setIsSaving(true)
    try {
      const requestData: CreateInvoiceTemplateRequest | UpdateInvoiceTemplateRequest = {
        name: formData.name,
        description: formData.description || undefined,
        items: formData.items,
        subtotal,
        taxRate: formData.taxRate,
        taxAmount,
        totalAmount
      }

      await onSave(requestData)
    } catch (error) {
      console.error("保存エラー:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>テンプレートの名前と説明を入力してください</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">テンプレート名 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例: 月次定額サービス"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">説明文（任意）</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="テンプレートの用途や注意事項を入力"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxRate">税率（%）</Label>
            <Input
              id="taxRate"
              type="number"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
              min="0"
              max="100"
              step="1"
            />
          </div>
        </CardContent>
      </Card>

      {/* 明細行 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>明細行</CardTitle>
              <CardDescription>請求する品目を追加してください</CardDescription>
            </div>
            <Button onClick={handleAddItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              明細追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {errors.items && <p className="text-sm text-red-500 mb-4">{errors.items}</p>}
          
          {formData.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              明細行がありません。「明細追加」ボタンをクリックして追加してください。
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">品名</TableHead>
                    <TableHead className="w-[100px]">数量</TableHead>
                    <TableHead className="w-[120px]">単価</TableHead>
                    <TableHead className="w-[120px]">金額</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                          placeholder="品名を入力"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                          min="0"
                          step="1"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(index, "unitPrice", e.target.value)}
                          min="0"
                          step="1"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ¥{item.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 金額計算 */}
      <Card>
        <CardHeader>
          <CardTitle>金額計算</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">小計（税抜）</span>
              <span className="font-medium">¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">消費税（{formData.taxRate}%）</span>
              <span className="font-medium">¥{taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-t-2">
              <span className="text-lg font-semibold">合計金額（税込）</span>
              <span className="text-2xl font-bold text-primary">¥{totalAmount.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* アクションボタン */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            キャンセル
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {mode === "create" ? "作成" : "更新"}
        </Button>
      </div>
    </div>
  )
}