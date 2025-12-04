# Supabase マイグレーション手順

## 現在の状況
- `permissions` テーブルはSupabase Studioで手動作成済み
- RooCodeが想定するカラム構造と異なる可能性がある
- `can_access_payments` などのカラムが不足している

## 実行手順

### 1. 現在のテーブル構造を確認

Supabase Studio → SQL Editor を開き、以下のファイルの内容を実行:
```
supabase/migrations/check_permissions_structure.sql
```

このクエリで現在のカラム一覧が表示されます。

### 2. 必要なカラムの確認

RooCodeが必要とするカラム:
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, UNIQUE, REFERENCES auth.users)
- `role` (TEXT, CHECK constraint)
- `can_edit_invoices` (BOOLEAN) ← 不足している可能性
- `can_edit_clients` (BOOLEAN) ← 不足している可能性
- `can_access_payments` (BOOLEAN) ← **これがエラーの原因**
- `can_send_emails` (BOOLEAN) ← 不足している可能性
- `can_access_settings` (BOOLEAN) ← 不足している可能性
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### 3. テーブル構造を修正

Supabase Studio → SQL Editor を開き、以下のファイルの内容を実行:
```
supabase/migrations/fix_permissions_table.sql
```

このSQLは以下を実行します:
- 不足しているカラムを安全に追加
- トリガー関数の作成（updated_at自動更新）
- RLS (Row Level Security) ポリシーの設定
- CHECK制約の追加

### 4. 実行後の確認

再度 `check_permissions_structure.sql` を実行して、すべてのカラムが追加されたことを確認してください。

### 5. アプリケーションの動作確認

マイグレーション実行後:
1. アプリケーションを再起動（開発サーバーを再起動）
2. ユーザー管理画面で「支払管理」のチェックボックスを編集
3. 保存ボタンを押してエラーが解消されたか確認

## トラブルシューティング

### エラー: "permission denied for table permissions"
→ Supabase Studioの「SQL Editor」ではなく、「Database」→「Migrations」から実行してください

### エラー: "column already exists"
→ 問題ありません。このマイグレーションは既存カラムをスキップする設計です

### 既存データへの影響
- 既存のレコードには影響しません
- 新規追加されたカラムにはデフォルト値 `false` が設定されます
- 既存ユーザーの権限は手動で再設定が必要な場合があります

## 代替方法: 完全な再作成（データ消失注意）

もしテーブルを完全に作り直したい場合（**既存データは削除されます**）:

1. 既存テーブルを削除:
   ```sql
   DROP TABLE IF EXISTS permissions CASCADE;
   ```

2. `create_permissions.sql` を実行してテーブルを再作成

⚠️ **警告**: この方法は既存のユーザー権限データがすべて失われます。

## 実行方法の詳細

### Supabase Studioでの実行手順

1. **Supabaseダッシュボードにログイン**
   - https://app.supabase.com にアクセス
   - 該当プロジェクトを選択

2. **SQL Editorを開く**
   - 左サイドバーから「SQL Editor」をクリック
   - 「New query」をクリック

3. **SQLファイルの内容をコピー&ペースト**
   - まず `check_permissions_structure.sql` の内容をコピー
   - SQL Editorにペーストして「Run」ボタンをクリック
   - 現在のテーブル構造を確認

4. **修正SQLを実行**
   - 新しいクエリを作成
   - `fix_permissions_table.sql` の内容をコピー
   - SQL Editorにペーストして「Run」ボタンをクリック
   - 成功メッセージを確認

5. **確認**
   - 再度 `check_permissions_structure.sql` を実行
   - すべての必要なカラムが存在することを確認

### ローカルでSupabase CLIを使用する場合（オプション）

```bash
# Supabase CLIがインストールされている場合
supabase db reset
supabase migration up
```

## 次のステップ

マイグレーション完了後:
1. ブラウザでアプリケーションをリロード
2. ユーザー管理画面にアクセス
3. 支払管理のチェックボックスを編集して保存
4. エラーが解消されていることを確認