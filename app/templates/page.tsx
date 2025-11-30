"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { InvoiceTemplate } from "@/lib/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/spinner"
import { Plus, Search, Edit, Trash2, Calendar } from "lucide-react"

export default function TemplatesPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<InvoiceTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)

  // テンプレート一覧を取得
  const fetchTemplates = async () => {
    try {
      setIsLoading(true)
      
      const supabase = createSupabaseBrowserClient()
      // 認証済みユーザーIDを取得
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        toast({
          title: "エラー",
          description: "認証されていません。ログインしてください。",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      // API経由でテンプレート一覧を取得
      const response = await fetch("/api/templates")
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "テンプレートの取得に失敗しました")
      }
      
      const data: InvoiceTemplate[] = await response.json()
      setTemplates(data)
      setFilteredTemplates(data)
    } catch (error) {
      console.error("テンプレート取得エラー:", error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "テンプレートの取得に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 初回ロード時にテンプレートを取得
  useEffect(() => {
    fetchTemplates()
  }, [])

  // 検索クエリが変更されたときにフィルタリング
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTemplates(templates)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = templates.filter((template) =>
      template.name.toLowerCase().includes(query)
    )
    setFilteredTemplates(filtered)
  }, [searchQuery, templates])

  // 削除確認ダイアログを開く
  const handleDeleteClick = (id: string) => {
    setTemplateToDelete(id)
    setDeleteDialogOpen(true)
  }

  // テンプレート削除処理
  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return

    try {
      const response = await fetch(`/api/templates/${templateToDelete}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "テンプレートの削除に失敗しました")
      }
      
      toast({
        title: "削除完了",
        description: "テンプレートを削除しました",
      })

      // 一覧を再取得
      await fetchTemplates()
    } catch (error) {
      console.error("テンプレート削除エラー:", error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "テンプレートの削除に失敗しました",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setTemplateToDelete(null)
    }
  }

  // 日付フォーマット (YYYY/MM/DD)
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  // 新規作成ページへ遷移
  const handleCreateNew = () => {
    router.push("/templates/new")
  }

  // 編集ページへ遷移
  const handleEdit = (id: string) => {
    router.push(`/templates/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* ヘッダー */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">請求書テンプレート</h1>
        <p className="text-muted-foreground">
          よく使う請求書の内容をテンプレートとして保存できます
        </p>
      </div>

      {/* 操作バー */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 検索ボックス */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="テンプレート名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 新規作成ボタン */}
        <Button onClick={handleCreateNew} className="sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          新規テンプレート作成
        </Button>
      </div>

      {/* テンプレート一覧 */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? "テンプレートが見つかりません" : "テンプレートがありません"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? "別のキーワードで検索してください"
              : "新規テンプレートを作成して始めましょう"}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              新規テンプレート作成
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="line-clamp-1">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>作成日: {formatDate(template.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>更新日: {formatDate(template.updatedAt)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="font-semibold">
                      合計: ¥{template.totalAmount.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      明細 {template.items.length} 件
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(template.id)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  編集
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleDeleteClick(template.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  削除
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>テンプレートを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。テンプレートを完全に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}