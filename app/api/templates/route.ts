import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import {
  getInvoiceTemplates,
  createInvoiceTemplate,
} from "@/lib/api/templates"
import { CreateInvoiceTemplateRequest } from "@/lib/types"

/**
 * GET /api/templates
 * テンプレート一覧取得
 */
export async function GET(req: NextRequest) {
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

    // テンプレート一覧を取得
    const templates = await getInvoiceTemplates(user.id)
    
    return NextResponse.json(templates)
  } catch (error) {
    console.error("テンプレート一覧取得エラー:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テンプレートの取得に失敗しました" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/templates
 * テンプレート新規作成
 */
export async function POST(req: NextRequest) {
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

    // リクエストボディを取得
    const body: CreateInvoiceTemplateRequest = await req.json()
    
    // テンプレート作成
    const newTemplate = await createInvoiceTemplate(body)
    
    return NextResponse.json(newTemplate, { status: 201 })
  } catch (error) {
    console.error("テンプレート作成エラー:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テンプレートの作成に失敗しました" },
      { status: 500 }
    )
  }
}