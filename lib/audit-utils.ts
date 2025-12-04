/**
 * 電子帳簿保存法対応 - 監査ログ・改ざん防止ユーティリティ
 * 
 * 必須要件:
 * 1. タイムスタンプ - データ作成・更新時刻の記録
 * 2. ハッシュ値生成 - データの改ざん検証用
 * 3. 監査ログ - 更新・削除履歴の記録
 */

/**
 * SHA-256ハッシュを生成
 * @param data ハッシュ化するデータ（オブジェクト）
 * @returns SHA-256ハッシュ文字列
 */
export async function generateHash(data: unknown): Promise<string> {
  try {
    // オブジェクトを正規化されたJSON文字列に変換
    const normalized = JSON.stringify(data, Object.keys(data as object).sort())
    
    // TextEncoderでバイト配列に変換
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(normalized)
    
    // SHA-256ハッシュを計算
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    
    // ハッシュを16進数文字列に変換
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex
  } catch (error) {
    console.error('[generateHash] ハッシュ生成エラー:', error)
    throw new Error('ハッシュ生成に失敗しました')
  }
}

/**
 * データの改ざんを検証
 * @param data 検証するデータ
 * @param storedHash 保存されているハッシュ値
 * @returns 検証結果 { valid: boolean, currentHash: string }
 */
export async function verifyHash(
  data: unknown,
  storedHash: string
): Promise<{ valid: boolean; currentHash: string }> {
  try {
    const currentHash = await generateHash(data)
    return {
      valid: currentHash === storedHash,
      currentHash,
    }
  } catch (error) {
    console.error('[verifyHash] ハッシュ検証エラー:', error)
    return {
      valid: false,
      currentHash: '',
    }
  }
}

/**
 * 監査ログエントリの型定義
 */
export interface AuditLogEntry {
  /** ログID */
  id: string
  /** 対象データID */
  targetId: string
  /** 対象データタイプ */
  targetType: 'invoice' | 'client' | 'payment' | 'settings'
  /** 操作タイプ */
  action: 'create' | 'update' | 'delete'
  /** 操作実行ユーザーID */
  userId: string
  /** 操作実行ユーザー名 */
  userName: string
  /** 操作実行日時 (ISO 8601) */
  timestamp: string
  /** 変更前の値（update/deleteの場合） */
  oldValue?: unknown
  /** 変更後の値（create/updateの場合） */
  newValue?: unknown
  /** 変更フィールド一覧（updateの場合） */
  changedFields?: string[]
  /** 備考 */
  remarks?: string
}

/**
 * 監査ログを生成
 */
export function createAuditLog(params: {
  targetId: string
  targetType: AuditLogEntry['targetType']
  action: AuditLogEntry['action']
  userId: string
  userName: string
  oldValue?: unknown
  newValue?: unknown
  remarks?: string
}): AuditLogEntry {
  const timestamp = new Date().toISOString()
  const id = `audit-${timestamp}-${Math.random().toString(36).substr(2, 9)}`
  
  // 変更されたフィールドを検出
  let changedFields: string[] | undefined
  if (params.action === 'update' && params.oldValue && params.newValue) {
    changedFields = detectChangedFields(
      params.oldValue as Record<string, unknown>,
      params.newValue as Record<string, unknown>
    )
  }
  
  return {
    id,
    targetId: params.targetId,
    targetType: params.targetType,
    action: params.action,
    userId: params.userId,
    userName: params.userName,
    timestamp,
    oldValue: params.oldValue,
    newValue: params.newValue,
    changedFields,
    remarks: params.remarks,
  }
}

/**
 * 変更されたフィールドを検出
 */
function detectChangedFields(
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>
): string[] {
  const changed: string[] = []
  
  // 新しい値のキーをチェック
  for (const key of Object.keys(newValue)) {
    if (JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key])) {
      changed.push(key)
    }
  }
  
  return changed
}

/**
 * 監査ログをLocalStorageに保存
 */
export function saveAuditLog(log: AuditLogEntry): void {
  try {
    const logsJson = localStorage.getItem('audit_logs')
    const logs: AuditLogEntry[] = logsJson ? JSON.parse(logsJson) : []
    
    logs.push(log)
    
    // 最新1000件のみ保持（容量対策）
    const trimmedLogs = logs.slice(-1000)
    
    localStorage.setItem('audit_logs', JSON.stringify(trimmedLogs))
    console.log(`[saveAuditLog] 監査ログを保存: ${log.action} ${log.targetType} ${log.targetId}`)
  } catch (error) {
    console.error('[saveAuditLog] 監査ログ保存エラー:', error)
  }
}

/**
 * 監査ログを取得
 */
export function getAuditLogs(filter?: {
  targetId?: string
  targetType?: AuditLogEntry['targetType']
  action?: AuditLogEntry['action']
  userId?: string
  startDate?: string
  endDate?: string
}): AuditLogEntry[] {
  try {
    const logsJson = localStorage.getItem('audit_logs')
    if (!logsJson) {
      return []
    }
    
    let logs: AuditLogEntry[] = JSON.parse(logsJson)
    
    // フィルタリング
    if (filter) {
      if (filter.targetId) {
        logs = logs.filter(log => log.targetId === filter.targetId)
      }
      if (filter.targetType) {
        logs = logs.filter(log => log.targetType === filter.targetType)
      }
      if (filter.action) {
        logs = logs.filter(log => log.action === filter.action)
      }
      if (filter.userId) {
        logs = logs.filter(log => log.userId === filter.userId)
      }
      if (filter.startDate) {
        logs = logs.filter(log => log.timestamp >= filter.startDate!)
      }
      if (filter.endDate) {
        logs = logs.filter(log => log.timestamp <= filter.endDate!)
      }
    }
    
    // 新しい順にソート
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  } catch (error) {
    console.error('[getAuditLogs] 監査ログ取得エラー:', error)
    return []
  }
}

/**
 * ハッシュ付きデータの型定義
 */
export interface HashableData {
  /** データのハッシュ値 */
  dataHash?: string
  /** ハッシュ生成日時 */
  hashGeneratedAt?: string
}

/**
 * データにハッシュを追加
 */
export async function addHashToData<T extends Record<string, unknown>>(
  data: T
): Promise<T & HashableData> {
  // ハッシュ計算用のデータ（hashフィールドを除外）
  const dataForHash = { ...data }
  delete dataForHash.dataHash
  delete dataForHash.hashGeneratedAt
  
  const hash = await generateHash(dataForHash)
  
  return {
    ...data,
    dataHash: hash,
    hashGeneratedAt: new Date().toISOString(),
  }
}

/**
 * データのハッシュを検証（改ざんチェック）
 */
export async function verifyDataHash<T extends HashableData>(
  data: T
): Promise<{ valid: boolean; message: string }> {
  if (!data.dataHash) {
    return {
      valid: false,
      message: 'ハッシュ値が設定されていません',
    }
  }
  
  // ハッシュ計算用のデータ（hashフィールドを除外）
  const dataForHash = { ...data }
  delete dataForHash.dataHash
  delete dataForHash.hashGeneratedAt
  
  const result = await verifyHash(dataForHash, data.dataHash)
  
  if (result.valid) {
    return {
      valid: true,
      message: 'データは改ざんされていません',
    }
  } else {
    return {
      valid: false,
      message: '⚠️ データが改ざんされた可能性があります',
    }
  }
}