"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Save, Shield, User } from "lucide-react"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser"
import { UserPermissions } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface AdminUserListProps {
  onNavigate: (page: string) => void
}

interface UserWithPermissions {
  id: string
  email: string
  name: string
  createdAt: string
  permissions: UserPermissions | null
}

export default function AdminUserList({ onNavigate }: AdminUserListProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<UserPermissions | null>(null)

  // ユーザー一覧を取得
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      
      // 現在のユーザーを取得（管理者権限チェック用）
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        toast({
          title: "エラー",
          description: "ログインしてください",
          variant: "destructive",
        })
        onNavigate("dashboard")
        return
      }

      // 現在のユーザーの権限を確認
      const { data: currentPermissions } = await supabase
        .from("permissions")
        .select("*")
        .eq("user_id", currentUser.id)
        .single()

      if (!currentPermissions || currentPermissions.role !== "admin") {
        toast({
          title: "アクセス拒否",
          description: "管理者権限が必要です",
          variant: "destructive",
        })
        onNavigate("dashboard")
        return
      }

      // 全ユーザーを取得（Supabase Admin API を使用する場合）
      // ※ ここでは permissions テーブルから取得する方式を採用
      const { data: permissionsData, error } = await supabase
        .from("permissions")
        .select("*")

      if (error) {
        console.error("権限データ取得エラー:", error)
        toast({
          title: "エラー",
          description: "ユーザーデータの取得に失敗しました",
          variant: "destructive",
        })
        return
      }

      // ユーザー情報を整形
      const userList: UserWithPermissions[] = permissionsData.map((perm: any) => ({
        id: perm.user_id,
        email: perm.user_id, // ※ auth.users からメール取得が必要な場合は別途実装
        name: perm.user_id,
        createdAt: perm.created_at,
        permissions: {
          role: perm.role,
          canEditInvoices: perm.can_edit_invoices || false,
          canEditClients: perm.can_edit_clients || false,
          canAccessPayments: perm.can_access_payments || false,
          canSendEmails: perm.can_send_emails || false,
          canAccessSettings: perm.can_access_settings || false,
        },
      }))

      setUsers(userList)
    } catch (err) {
      console.error("ユーザー取得エラー:", err)
      toast({
        title: "エラー",
        description: "予期しないエラーが発生しました",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 編集開始
  const handleEditStart = (user: UserWithPermissions) => {
    setEditingUserId(user.id)
    setEditingPermissions(user.permissions)
  }

  // 編集キャンセル
  const handleEditCancel = () => {
    setEditingUserId(null)
    setEditingPermissions(null)
  }

  // 権限保存
  const handleSavePermissions = async (userId: string) => {
    if (!editingPermissions) return

    try {
      const supabase = createSupabaseBrowserClient()

      const { error } = await supabase
        .from("permissions")
        .update({
          role: editingPermissions.role,
          can_edit_invoices: editingPermissions.canEditInvoices,
          can_edit_clients: editingPermissions.canEditClients,
          can_access_payments: editingPermissions.canAccessPayments,
          can_send_emails: editingPermissions.canSendEmails,
          can_access_settings: editingPermissions.canAccessSettings,
        })
        .eq("user_id", userId)

      if (error) {
        console.error("権限更新エラー:", error)
        console.error("エラー詳細:", JSON.stringify(error, null, 2))
        toast({
          title: "エラー",
          description: `権限の更新に失敗しました: ${error.message || "不明なエラー"}`,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "保存完了",
        description: "権限を更新しました",
      })

      // 一覧を再取得
      await fetchUsers()
      setEditingUserId(null)
      setEditingPermissions(null)
    } catch (err) {
      console.error("権限保存エラー:", err)
      toast({
        title: "エラー",
        description: "予期しないエラーが発生しました",
        variant: "destructive",
      })
    }
  }

  // ロール選択ハンドラー
  const handleRoleChange = (role: "admin" | "accounting" | "sales" | "viewer") => {
    if (!editingPermissions) return

    // ロールに応じたデフォルト権限を設定
    let defaultPermissions: UserPermissions
    switch (role) {
      case "admin":
        defaultPermissions = {
          role: "admin",
          canEditInvoices: true,
          canEditClients: true,
          canAccessPayments: true,
          canSendEmails: true,
          canAccessSettings: true,
        }
        break
      case "accounting":
        defaultPermissions = {
          role: "accounting",
          canEditInvoices: true,
          canEditClients: false,
          canAccessPayments: true,
          canSendEmails: true,
          canAccessSettings: false,
        }
        break
      case "sales":
        defaultPermissions = {
          role: "sales",
          canEditInvoices: true,
          canEditClients: true,
          canAccessPayments: false,
          canSendEmails: true,
          canAccessSettings: false,
        }
        break
      case "viewer":
        defaultPermissions = {
          role: "viewer",
          canEditInvoices: false,
          canEditClients: false,
          canAccessPayments: false,
          canSendEmails: false,
          canAccessSettings: false,
        }
        break
    }

    setEditingPermissions(defaultPermissions)
  }

  if (loading) {
    return (
      <div className="p-8 lg:p-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 lg:p-12">
      {/* 戻る＋タイトル */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => onNavigate("settings")}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground">システムユーザーの権限を管理</p>
        </div>
      </div>

      {/* ユーザー一覧 */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">ユーザー</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">ロール</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">請求書編集</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">顧客編集</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">支払管理</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">設定</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const isEditing = editingUserId === user.id
              const displayPermissions = isEditing ? editingPermissions : user.permissions

              return (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <select
                        value={displayPermissions?.role || "viewer"}
                        onChange={(e) => handleRoleChange(e.target.value as any)}
                        className="px-3 py-1 border rounded bg-input text-sm"
                      >
                        <option value="admin">管理者</option>
                        <option value="accounting">経理</option>
                        <option value="sales">営業</option>
                        <option value="viewer">閲覧のみ</option>
                      </select>
                    ) : (
                      <span className="text-sm">
                        {displayPermissions?.role === "admin" && "管理者"}
                        {displayPermissions?.role === "accounting" && "経理"}
                        {displayPermissions?.role === "sales" && "営業"}
                        {displayPermissions?.role === "viewer" && "閲覧のみ"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={displayPermissions?.canEditInvoices || false}
                        onChange={(e) =>
                          setEditingPermissions({
                            ...editingPermissions!,
                            canEditInvoices: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className="text-sm">
                        {displayPermissions?.canEditInvoices ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={displayPermissions?.canEditClients || false}
                        onChange={(e) =>
                          setEditingPermissions({
                            ...editingPermissions!,
                            canEditClients: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className="text-sm">
                        {displayPermissions?.canEditClients ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={displayPermissions?.canAccessPayments || false}
                        onChange={(e) =>
                          setEditingPermissions({
                            ...editingPermissions!,
                            canAccessPayments: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className="text-sm">
                        {displayPermissions?.canAccessPayments ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={displayPermissions?.canAccessSettings || false}
                        onChange={(e) =>
                          setEditingPermissions({
                            ...editingPermissions!,
                            canAccessSettings: e.target.checked,
                          })
                        }
                        className="w-4 h-4"
                      />
                    ) : (
                      <span className="text-sm">
                        {displayPermissions?.canAccessSettings ? "✓" : "✗"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSavePermissions(user.id)}
                          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditStart(user)}
                        className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-sm hover:bg-secondary/90"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <p>ユーザーが登録されていません</p>
          </div>
        )}
      </div>
    </div>
  )
}