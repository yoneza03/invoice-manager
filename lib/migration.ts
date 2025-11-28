/**
 * LocalStorage最適化マイグレーション
 *
 * 既存のLocalStorageに保存されている請求書データから
 * base64Dataフィールドを削除し、容量を最適化します。
 * また、ステータスフィールドのマイグレーションも行います。
 */

import { Invoice, InvoiceAttachment, InvoiceStatus } from './types'

/**
 * 請求書ストレージのマイグレーションを実行
 * 
 * 処理内容:
 * - LocalStorageから 'invoices' キーでデータを取得
 * - 各請求書の attachments 配列からbase64Dataフィールドを削除
 * - pdfStorageLocation: 'none' を設定
 * - 更新したデータをLocalStorageに保存
 * - マイグレーション実行ログを出力
 */
export async function migrateInvoiceStorage(): Promise<void> {
  try {
    console.log('[Migration] LocalStorage最適化マイグレーションを開始...')
    
    // LocalStorageからデータを取得
    const invoicesJson = localStorage.getItem('invoices')
    if (!invoicesJson) {
      console.log('[Migration] マイグレーション対象のデータが見つかりませんでした')
      return
    }
    
    const invoices: Invoice[] = JSON.parse(invoicesJson)
    console.log(`[Migration] ${invoices.length}件の請求書をチェック`)
    
    let attachmentCount = 0
    let savedSize = 0
    let migratedInvoiceCount = 0
    let statusMigrationCount = 0
    
    // 各請求書を処理
    const migratedInvoices = invoices.map(invoice => {
      let needsMigration = false
      let migratedInvoice = { ...invoice }
      
      // ステータスマイグレーション: "imported" → "draft", "pending" → "unpaid"
      const oldStatus = invoice.status as any
      if (oldStatus === 'imported' || oldStatus === 'pending') {
        needsMigration = true
        statusMigrationCount++
        
        if (oldStatus === 'imported') {
          migratedInvoice.status = 'draft' as InvoiceStatus
          console.log(`[Migration] ステータス変換: ${invoice.invoiceNumber} - "imported" → "draft"`)
        } else if (oldStatus === 'pending') {
          migratedInvoice.status = 'unpaid' as InvoiceStatus
          console.log(`[Migration] ステータス変換: ${invoice.invoiceNumber} - "pending" → "unpaid"`)
        }
      }
      
      // statusフィールドが存在しない場合はデフォルト値として "draft" を設定
      if (!invoice.status) {
        needsMigration = true
        statusMigrationCount++
        migratedInvoice.status = 'draft' as InvoiceStatus
        console.log(`[Migration] ステータス追加: ${invoice.invoiceNumber} - デフォルト "draft"`)
      }
      
      // 添付ファイルが存在しない場合はスキップ
      if (!invoice.attachments || invoice.attachments.length === 0) {
        return invoice
      }
      
      let hasBase64Data = false
      
      // 各添付ファイルからbase64Dataを削除
      const migratedAttachments = invoice.attachments.map(attachment => {
        // base64Dataフィールドの存在チェック
        const attachmentAny = attachment as any
        
        if ('base64Data' in attachmentAny && attachmentAny.base64Data) {
          hasBase64Data = true
          attachmentCount++
          
          // Base64データのサイズを計算（概算）
          const base64Size = attachmentAny.base64Data.length
          savedSize += base64Size
          
          // base64Dataフィールドを削除
          const { base64Data, ...rest } = attachmentAny
          return rest as InvoiceAttachment
        }
        
        return attachment
      })
      
      // base64Dataが存在した場合
      if (hasBase64Data) {
        needsMigration = true
        migratedInvoiceCount++
        migratedInvoice = {
          ...migratedInvoice,
          attachments: migratedAttachments,
          pdfStorageLocation: invoice.pdfStorageLocation || ('none' as const),
        }
      }
      
      return needsMigration ? migratedInvoice : invoice
    })
    
    // マイグレーションが必要な場合のみLocalStorageを更新
    if (migratedInvoiceCount > 0 || statusMigrationCount > 0) {
      localStorage.setItem('invoices', JSON.stringify(migratedInvoices))
      
      // 削減容量をMB単位で計算
      const savedSizeMB = (savedSize / (1024 * 1024)).toFixed(2)
      
      if (migratedInvoiceCount > 0) {
        console.log(`[Migration] ${migratedInvoiceCount}件の請求書を最適化`)
        console.log(`[Migration] ${attachmentCount}件の添付ファイルからbase64Dataを削除`)
        console.log(`[Migration] 削減容量: ${savedSizeMB}MB`)
      }
      
      if (statusMigrationCount > 0) {
        console.log(`[Migration] ${statusMigrationCount}件の請求書ステータスを更新`)
      }
      
      console.log('[Migration] マイグレーション完了')
    } else {
      console.log('[Migration] マイグレーション対象のデータが見つかりませんでした')
    }
    
  } catch (error) {
    console.error('[Migration] マイグレーション中にエラーが発生しました:', error)
    console.error('[Migration] エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    // エラーが発生してもアプリケーションは継続動作
  }
}