# 電子帳簿保存法対応 - 実装ドキュメント

## 概要

電子帳簿保存法の必須要件である「タイムスタンプ」「改ざん防止」機能を実装しました。

## 実装内容

### 1. ハッシュ生成・改ざん検証ユーティリティ

**新規ファイル**: [`lib/audit-utils.ts`](../lib/audit-utils.ts)

#### 主要機能

- **`generateHash(data)`**: SHA-256ハッシュ値の生成
- **`verifyHash(data, storedHash)`**: データ改ざん検証
- **`addHashToData(data)`**: データにハッシュを追加
- **`verifyDataHash(data)`**: ハッシュ付きデータの検証
- **`createAuditLog(params)`**: 監査ログエントリの生成
- **`saveAuditLog(log)`**: 監査ログをLocalStorageに保存
- **`getAuditLogs(filter?)`**: 監査ログの取得とフィルタリング

#### 監査ログの構造

```typescript
interface AuditLogEntry {
  id: string                    // ログID
  targetId: string              // 対象データID
  targetType: 'invoice' | 'client' | 'payment' | 'settings'
  action: 'create' | 'update' | 'delete'
  userId: string                // 操作実行ユーザーID
  userName: string              // 操作実行ユーザー名
  timestamp: string             // 操作実行日時 (ISO 8601)
  oldValue?: unknown            // 変更前の値
  newValue?: unknown            // 変更後の値
  changedFields?: string[]      // 変更されたフィールド一覧
  remarks?: string              // 備考
}
```

### 2. 型定義の拡張

**変更ファイル**: [`lib/types.ts`](../lib/types.ts:30)

以下の型に電子帳簿保存法対応フィールドを追加:

```typescript
// Invoice, Client, Payment に追加
{
  dataHash?: string           // 改ざん防止用ハッシュ値
  hashGeneratedAt?: string    // ハッシュ生成日時 (ISO 8601)
}
```

### 3. ストア機能の実装

**変更ファイル**: [`lib/store.tsx`](../lib/store.tsx:1)

#### 実装した機能

すべてのCRUD操作に以下の機能を追加:

1. **作成時 (Create)**
   - SHA-256ハッシュを自動生成
   - ハッシュ生成日時を記録
   - 監査ログに作成記録を保存

2. **更新時 (Update)**
   - 既存データのハッシュを検証（改ざん検出）
   - 新しいハッシュを生成
   - 変更前・変更後の値を監査ログに記録
   - 変更されたフィールドを自動検出

3. **削除時 (Delete)**
   - 削除前にハッシュを検証
   - 削除されたデータを監査ログに記録

#### 対応したデータ型

- ✅ **Invoice** (請求書)
- ✅ **Client** (顧客)
- ✅ **Payment** (支払い)

#### 改ざん検出の動作

```typescript
// 更新時に自動的にハッシュ検証
if (oldInvoice.dataHash) {
  const verifyResult = await verifyDataHash(oldInvoice)
  if (!verifyResult.valid) {
    console.warn(`⚠️ データが改ざんされた可能性があります`)
  }
}
```

### 4. 監査ログの保存場所

- **保存先**: `localStorage['audit_logs']`
- **保持件数**: 最新1000件（容量対策）
- **ソート**: 新しい順

## 使用方法

### 監査ログの確認

ブラウザの開発者ツールのコンソールで:

```javascript
// すべてのログを取得
import { getAuditLogs } from './lib/audit-utils'
const logs = getAuditLogs()

// 特定の請求書のログを取得
const invoiceLogs = getAuditLogs({ targetId: 'invoice-id-123' })

// 特定期間のログを取得
const recentLogs = getAuditLogs({
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-12-31T23:59:59Z'
})

// 削除操作のみを取得
const deleteLogs = getAuditLogs({ action: 'delete' })
```

### ハッシュ検証

```javascript
import { verifyDataHash } from './lib/audit-utils'

const invoice = { /* 請求書データ */ }
const result = await verifyDataHash(invoice)

if (result.valid) {
  console.log('✅ データは改ざんされていません')
} else {
  console.error('⚠️ データが改ざんされた可能性があります')
}
```

## 電子帳簿保存法への対応状況

### ✅ 実装済み

1. **タイムスタンプ**
   - 作成日時: `createdAt` (既存)
   - 更新日時: `updatedAt` (既存)
   - ハッシュ生成日時: `hashGeneratedAt` (新規)
   - 監査ログのタイムスタンプ: `timestamp` (新規)

2. **改ざん防止**
   - SHA-256ハッシュによるデータ整合性検証
   - 更新・削除時の自動改ざん検出
   - ハッシュ不一致時の警告ログ出力

3. **監査証跡（履歴ログ）**
   - 作成・更新・削除の全操作を記録
   - 変更前・変更後の値を保存
   - 操作実行ユーザー・日時を記録
   - 変更フィールドの自動検出

### 🔄 今後の拡張案

1. **タイムスタンプ署名**
   - 外部タイムスタンプ局（TSA）との連携
   - RFC 3161準拠のタイムスタンプトークン

2. **監査ログのエクスポート**
   - CSV/JSON形式でのエクスポート機能
   - 税務調査対応用のレポート生成

3. **Supabaseへの移行**
   - LocalStorageからSupabaseへの移行
   - サーバーサイドでの監査ログ管理
   - より堅牢なデータ保護

## セキュリティ上の注意点

1. **LocalStorageの制限**
   - ブラウザのLocalStorageは容易にアクセス可能
   - 本格運用時はSupabaseなどのDBへ移行推奨

2. **ハッシュアルゴリズム**
   - 現在はSHA-256を使用（Web標準API）
   - 必要に応じてより強力なアルゴリズムへの変更も可能

3. **監査ログの保護**
   - 現在は1000件制限（容量対策）
   - 本格運用時は無制限保存+バックアップ推奨

## 変更ファイル一覧

- 🆕 [`lib/audit-utils.ts`](../lib/audit-utils.ts) - 監査ユーティリティ（新規作成）
- ✏️ [`lib/types.ts`](../lib/types.ts) - 型定義にハッシュフィールドを追加
- ✏️ [`lib/store.tsx`](../lib/store.tsx) - CRUD操作に監査機能を追加

## テスト方法

1. 請求書を作成
2. ブラウザコンソールで監査ログを確認
3. LocalStorageの `audit_logs` を確認
4. 請求書を更新して、変更履歴が記録されているか確認
5. 請求書のハッシュ値を手動で変更して、改ざん検出が動作するか確認

---

**実装完了日**: 2025-12-05  
**バージョン**: 1.0.0