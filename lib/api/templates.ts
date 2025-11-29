import { createSupabaseServerClient } from "@/lib/supabase-server"
import {
  InvoiceTemplate,
  CreateInvoiceTemplateRequest,
  UpdateInvoiceTemplateRequest,
  InvoiceLineItem
} from "@/lib/types"

/**
 * Supabase テーブル型
 */
interface SupabaseInvoiceTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  items: any
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  created_at: string
  updated_at: string
}

/**
 * Supabase → アプリ型へ変換
 */
function mapSupabaseToTemplate(row: SupabaseInvoiceTemplate): InvoiceTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    items: row.items as InvoiceLineItem[],
    subtotal: row.subtotal,
    taxRate: row.tax_rate,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

/**
 * ─────────────────────────────
 * テンプレート一覧取得
 * ─────────────────────────────
 */
export async function getInvoiceTemplates(userId: string): Promise<InvoiceTemplate[]> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(`テンプレート一覧取得エラー: ${error.message}`)
  if (!data) return []

  return data.map(mapSupabaseToTemplate)
}

/**
 * ─────────────────────────────
 * IDから1件取得
 * ─────────────────────────────
 */
export async function getInvoiceTemplateById(id: string): Promise<InvoiceTemplate | null> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .eq("id", id)
    .single()

  // 見つからない場合
  if (error?.code === "PGRST116") return null
  if (error) throw new Error(`テンプレート取得エラー: ${error.message}`)

  return data ? mapSupabaseToTemplate(data) : null
}

/**
 * ─────────────────────────────
 * 新規テンプレート作成
 * ─────────────────────────────
 */
export async function createInvoiceTemplate(
  input: CreateInvoiceTemplateRequest
): Promise<InvoiceTemplate> {
  const supabase = createSupabaseServerClient()

  // 認証ユーザー取得
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("認証されていません。ログインしてください。")

  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      items: input.items,
      subtotal: input.subtotal,
      tax_rate: input.taxRate,
      tax_amount: input.taxAmount,
      total_amount: input.totalAmount
    })
    .select()
    .single()

  if (error) throw new Error(`テンプレート作成エラー: ${error.message}`)

  return mapSupabaseToTemplate(data)
}

/**
 * ─────────────────────────────
 * 更新
 * ─────────────────────────────
 */
export async function updateInvoiceTemplate(
  id: string,
  input: UpdateInvoiceTemplateRequest
): Promise<InvoiceTemplate> {

  const supabase = createSupabaseServerClient()

  const updateData: Record<string, any> = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description ?? null
  if (input.items !== undefined) updateData.items = input.items
  if (input.subtotal !== undefined) updateData.subtotal = input.subtotal
  if (input.taxRate !== undefined) updateData.tax_rate = input.taxRate
  if (input.taxAmount !== undefined) updateData.tax_amount = input.taxAmount
  if (input.totalAmount !== undefined) updateData.total_amount = input.totalAmount

  const { data, error } = await supabase
    .from("invoice_templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (error?.code === "PGRST116") {
    throw new Error(`ID ${id} のテンプレートが見つかりません`)
  }
  if (error) throw new Error(`テンプレート更新エラー: ${error.message}`)

  if (!data) throw new Error("テンプレート更新エラー: データなし")

  return mapSupabaseToTemplate(data)
}

/**
 * ─────────────────────────────
 * 削除
 * ─────────────────────────────
 */
export async function deleteInvoiceTemplate(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { error } = await supabase
    .from("invoice_templates")
    .delete()
    .eq("id", id)

  if (error) throw new Error(`テンプレート削除エラー: ${error.message}`)
}
