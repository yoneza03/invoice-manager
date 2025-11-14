"use client"

import { useState } from "react"
import { ChevronLeft, Plus, Edit, Trash2, Search, X } from "lucide-react"
import { useStore } from "@/lib/store"
import { generateId } from "@/lib/api"
import { Client } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface ClientManagementProps {
  onNavigate: (page: string) => void
}

export default function ClientManagement({ onNavigate }: ClientManagementProps) {
  const { clients, addClient, updateClient, deleteClient } = useStore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  
  // フォームの状態
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    postalCode: "",
    address: "",
    contactPerson: "",
    memo: "",
  })

  // 検索フィルタリング
  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase()
    return (
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      (client.phone && client.phone.toLowerCase().includes(query)) ||
      (client.address && client.address.toLowerCase().includes(query))
    )
  })

  // フォームをリセット
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      postalCode: "",
      address: "",
      contactPerson: "",
      memo: "",
    })
    setEditingClient(null)
  }

  // 新規追加ダイアログを開く
  const handleAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  // 編集ダイアログを開く
  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      postalCode: client.postalCode || "",
      address: client.address,
      contactPerson: client.contactPerson || "",
      memo: client.memo || "",
    })
    setIsDialogOpen(true)
  }

  // 保存処理
  const handleSave = () => {
    // バリデーション
    if (!formData.name.trim()) {
      toast({
        title: "エラー",
        description: "取引先名を入力してください",
        variant: "destructive",
      })
      return
    }

    if (!formData.email.trim()) {
      toast({
        title: "エラー",
        description: "メールアドレスを入力してください",
        variant: "destructive",
      })
      return
    }

    // メールアドレスの簡易バリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "エラー",
        description: "有効なメールアドレスを入力してください",
        variant: "destructive",
      })
      return
    }

    if (editingClient) {
      // 更新
      updateClient(editingClient.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        memo: formData.memo.trim() || undefined,
      })
      toast({
        title: "更新完了",
        description: "取引先情報を更新しました",
      })
    } else {
      // 新規追加
      const newClient: Client = {
        id: generateId("client"),
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        address: formData.address.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        memo: formData.memo.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      addClient(newClient)
      toast({
        title: "追加完了",
        description: "新しい取引先を追加しました",
      })
    }

    setIsDialogOpen(false)
    resetForm()
  }

  // 削除処理
  const handleDelete = (id: string, name: string) => {
    setDeleteConfirmId(id)
  }

  const confirmDelete = () => {
    if (deleteConfirmId) {
      const client = clients.find((c) => c.id === deleteConfirmId)
      deleteClient(deleteConfirmId)
      toast({
        title: "削除完了",
        description: `${client?.name} を削除しました`,
      })
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="p-8 lg:p-12">
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-foreground">取引先管理</h1>
          <p className="text-muted-foreground">取引先情報の登録・管理</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          新規追加
        </button>
      </div>

      {/* 検索バー */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            type="text"
            placeholder="取引先名、メールアドレス、電話番号、住所で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 取引先一覧テーブル */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">取引先名</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">メールアドレス</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">電話番号</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">住所</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">担当者</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">アクション</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {searchQuery ? "検索結果が見つかりませんでした" : "取引先が登録されていません"}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-foreground">{client.name}</td>
                    <td className="py-4 px-6 text-sm text-foreground">{client.email}</td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{client.phone || "-"}</td>
                    <td className="py-4 px-6 text-sm text-muted-foreground max-w-xs truncate" title={client.address}>
                      {client.address || "-"}
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">{client.contactPerson || "-"}</td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(client)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="編集"
                        >
                          <Edit size={18} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(client.id, client.name)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 size={18} className="text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 件数表示 */}
      <div className="mt-6 text-sm text-muted-foreground">
        全 {filteredClients.length} 件{searchQuery && ` (${clients.length}件中)`}
      </div>

      {/* 追加・編集ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? "取引先情報の編集" : "新規取引先の追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">
                  取引先名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="株式会社サンプル"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="email">
                  メールアドレス <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="info@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">電話番号</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="03-1234-5678"
                />
              </div>
              <div>
                <Label htmlFor="postalCode">郵便番号</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="123-4567"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="address">住所</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="東京都渋谷区..."
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="contactPerson">担当者名</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="山田太郎"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="memo">メモ</Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="備考や特記事項"
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>{editingClient ? "更新" : "追加"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>取引先の削除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            この取引先を削除してもよろしいですか？この操作は取り消せません。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}