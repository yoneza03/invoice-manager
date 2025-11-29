"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, FileText, Copy } from "lucide-react"
import {
  InvoiceTemplate,
  CreateInvoiceTemplateRequest,
  UpdateInvoiceTemplateRequest,
  InvoiceLineItem,
} from "@/lib/types"
import {
  getInvoiceTemplates,
  createInvoiceTemplate,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
  formatCurrency,
  formatDate,
  generateId,
} from "@/lib/api"
import { toast } from "@/components/ui/use-toast"

interface InvoiceTemplateManagementProps {
  userId: string
  onSelectTemplate?: (template: InvoiceTemplate) => void
}

export default function InvoiceTemplateManagement({
  userId,
  onSelectTemplate,
}: InvoiceTemplateManagementProps) {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null)

  // フォーム状態
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    items: [] as InvoiceLineItem[],
    subtotal: 0,
    taxRate: 10,
    taxAmount: 0,
    totalAmount: 0,
  })

  // テンプレート一覧を読み込み
  useEffect(() => {
    loadTemplates()
  }, [userId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await getInvoiceTemplates(userId)
      setTemplates(data)
    } catch (error) {
      console.error("テンプレート読み込みエラー:", error)
      toast({
        title: "エラー",
        description: "テンプレートの読み込みに失敗しました",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      items: [
        {
          id: generateId("item"),
          description: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        },
      ],
      subtotal: 0,
      taxRate: 10,
      taxAmount: 0,
      totalAmount: 0,
    })
  }

  // 明細を追加
  const addLineItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          id: generateId("item"),
          description: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
        },
      ],
    })
  }

  // 明細を削除
  const removeLineItem = (itemId: string) => {
    const updatedItems = formData.items.filter((item) => item.id !== itemId)
    setFormData({ ...formData, items: updatedItems })
    calculateTotals(updatedItems, formData.taxRate)
  }

  // 明細を更新
  const updateLineItem = (itemId: string, field: keyof InvoiceLineItem, value: any) => {
    const updatedItems = formData.items.map((item) => {
      if (item.id === itemId) {
        const updatedItem = { ...item, [field]: value }
        
        // 金額を自動計算
        if (field === "quantity" || field === "unitPrice") {
          updatedItem.amount = (updatedItem.quantity || 0) * (updatedItem.unitPrice || 0)
        }
        
        return updatedItem
      }
      return item
    })
    
    setFormData({ ...formData, items: updatedItems })
    calculateTotals(updatedItems, formData.taxRate)
  }

  // 合計金額を計算
  const calculateTotals = (items: InvoiceLineItem[], taxRate: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
    const taxAmount = Math.floor(subtotal * (taxRate / 100))
    const totalAmount = subtotal + taxAmount

    setFormData((prev) => ({
      ...prev,
      subtotal,
      taxAmount,
      totalAmount,
    }))
  }

  // テンプレートを作成
  const handleCreateTemplate = async () => {
    try {
      if (!formData.name.trim()) {
        toast({
          title: "エラー",
          description: "テンプレート名を入力してください",
          variant: "destructive",
        })
        return
      }

      if (formData.items.length === 0) {
        toast({
          title: "エラー",
          description: "明細を1つ以上追加してください",
          variant: "destructive",
        })
        return
      }

      const request: CreateInvoiceTemplateRequest = {
        name: formData.name,
        description: formData.description || undefined,
        items: formData.items,
        subtotal: formData.subtotal,
        taxRate: formData.taxRate,
        taxAmount: formData.taxAmount,
        totalAmount: formData.totalAmount,
      }

      await createInvoiceTemplate(userId, request)
      
      toast({
        title: "成功",
        description: "テンプレートを作成しました",
      })

      setIsCreateDialogOpen(false)
      resetForm()
      loadTemplates()
    } catch (error) {
      console.error("テンプレート作成エラー:", error)
      toast({
        title: "エラー",
        description: "テンプレートの作成に失敗しました",
        variant: "destructive",
      })
    }
  }

  // テンプレートを更新
  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const request: UpdateInvoiceTemplateRequest = {
        name: formData.name,
        description: formData.description || undefined,
        items: formData.items,
        subtotal: formData.subtotal,
        taxRate: formData.taxRate,
        taxAmount: formData.taxAmount,
        totalAmount: formData.totalAmount,
      }

      await updateInvoiceTemplate(userId, selectedTemplate.id, request)
      
      toast({
        title: "成功",
        description: "テンプレートを更新しました",
      })

      setIsEditDialogOpen(false)
      setSelectedTemplate(null)
      resetForm()
      loadTemplates()
    } catch (error) {
      console.error("テンプレート更新エラー:", error)
      toast({
        title: "エラー",
        description: "テンプレートの更新に失敗しました",
        variant: "destructive",
      })
    }
  }

  // テンプレートを削除
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    try {
      const success = await deleteInvoiceTemplate(userId, selectedTemplate.id)
      
      if (success) {
        toast({
          title: "成功",
          description: "テンプレートを削除しました",
        })
        loadTemplates()
      } else {
        toast({
          title: "エラー",
          description: "テンプレートの削除に失敗しました",
          variant: "destructive",
        })
      }

      setIsDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      console.error("テンプレート削除エラー:", error)
      toast({
        title: "エラー",
        description: "テンプレートの削除に失敗しました",
        variant: "destructive",
      })
    }
  }

  // 編集ダイアログを開く
  const openEditDialog = (template: InvoiceTemplate) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || "",
      items: template.items,
      subtotal: template.subtotal,
      taxRate: template.taxRate,
      taxAmount: template.taxAmount,
      totalAmount: template.totalAmount,
    })
    setIsEditDialogOpen(true)
  }

  // 削除確認ダイアログを開く
  const openDeleteDialog = (template: InvoiceTemplate) => {
    setSelectedTemplate(template)
    setIsDeleteDialogOpen(true)
  }

  // テンプレートを選択
  const handleSelectTemplate = (template: InvoiceTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template)
      toast({
        title: "テンプレートを適用",
        description: `「${template.name}」を請求書に適用しました`,
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>請求書テンプレート管理</CardTitle>
              <CardDescription>
                頻繁に使用する請求書の雛形を保存・管理できます
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  新規作成
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>テンプレート作成</DialogTitle>
                  <DialogDescription>
                    新しい請求書テンプレートを作成します
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">テンプレート名 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例: 月次定額サービス"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">説明</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="テンプレートの用途や注意事項"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>明細</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                        <Plus className="mr-2 h-3 w-3" />
                        明細追加
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {formData.items.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5">
                            <Label className="text-xs">品名</Label>
                            <Input
                              value={item.description}
                              onChange={(e) =>
                                updateLineItem(item.id, "description", e.target.value)
                              }
                              placeholder="品名・サービス名"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">数量</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(item.id, "quantity", Number(e.target.value))
                              }
                              min="0"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">単価</Label>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(item.id, "unitPrice", Number(e.target.value))
                              }
                              min="0"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">金額</Label>
                            <Input value={formatCurrency(item.amount)} disabled />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(item.id)}
                              disabled={formData.items.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="taxRate">税率 (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) => {
                        const newTaxRate = Number(e.target.value)
                        setFormData({ ...formData, taxRate: newTaxRate })
                        calculateTotals(formData.items, newTaxRate)
                      }}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>小計:</span>
                      <span className="font-medium">{formatCurrency(formData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>消費税 ({formData.taxRate}%):</span>
                      <span className="font-medium">{formatCurrency(formData.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>合計:</span>
                      <span>{formatCurrency(formData.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleCreateTemplate}>作成</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
              <p>テンプレートがありません</p>
              <p className="text-sm">「新規作成」ボタンからテンプレートを作成してください</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>テンプレート名</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead className="text-right">明細数</TableHead>
                  <TableHead className="text-right">合計金額</TableHead>
                  <TableHead className="text-right">作成日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {template.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{template.items.length}件</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(template.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(template.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {onSelectTemplate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectTemplate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(template)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>テンプレート編集</DialogTitle>
            <DialogDescription>テンプレートの内容を編集します</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">テンプレート名 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-description">説明</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>明細</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-2 h-3 w-3" />
                  明細追加
                </Button>
              </div>

              <div className="space-y-2">
                {formData.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs">品名</Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item.id, "description", e.target.value)
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">数量</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, "quantity", Number(e.target.value))
                        }
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">単価</Label>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(item.id, "unitPrice", Number(e.target.value))
                        }
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">金額</Label>
                      <Input value={formatCurrency(item.amount)} disabled />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.id)}
                        disabled={formData.items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-taxRate">税率 (%)</Label>
              <Input
                id="edit-taxRate"
                type="number"
                value={formData.taxRate}
                onChange={(e) => {
                  const newTaxRate = Number(e.target.value)
                  setFormData({ ...formData, taxRate: newTaxRate })
                  calculateTotals(formData.items, newTaxRate)
                }}
                min="0"
                max="100"
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>小計:</span>
                <span className="font-medium">{formatCurrency(formData.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>消費税 ({formData.taxRate}%):</span>
                <span className="font-medium">{formatCurrency(formData.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>合計:</span>
                <span>{formatCurrency(formData.totalAmount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleUpdateTemplate}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              テンプレート「{selectedTemplate?.name}」を削除します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}