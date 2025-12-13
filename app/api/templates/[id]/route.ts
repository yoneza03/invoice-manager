import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import {
  getInvoiceTemplateById,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
} from "@/lib/api/templates"
import { UpdateInvoiceTemplateRequest } from "@/lib/types"

/**
 * GET /api/templates/[id]
 * 特定テンプレート取得
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証されていません" },
        { status: 401 }
      )
    }

    const { id } = await params

    // テンプレート取得
    const template = await getInvoiceTemplateById(id)
    if (!template) {
      return NextResponse.json(
        { error: "テンプレートが見つかりません" },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error("テンプレート取得エラー:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/templates/[id]
 * テンプレート更新
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証されていません" },
        { status: 401 }
      )
    }

    const { id } = await params

    // リクエストボディを取得
    const body: UpdateInvoiceTemplateRequest = await req.json()

    // テンプレート更新
    const updatedTemplate = await updateInvoiceTemplate(id, body)

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error("テンプレート更新エラー:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テンプレートの更新に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/templates/[id]
 * テンプレート削除
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証されていません" },
        { status: 401 }
      )
    }

    const { id } = await params

    // テンプレート削除
    await deleteInvoiceTemplate(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("テンプレート削除エラー:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テンプレートの削除に失敗しました" },
      { status: 500 }
    )
  }
}
