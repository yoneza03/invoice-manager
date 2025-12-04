-- permissionsテーブルを修正するマイグレーションSQL
-- このファイルをSupabase Studio の SQL Editor で実行してください

-- ステップ1: 不足しているカラムがあれば追加
DO $$ 
BEGIN
    -- can_edit_invoices カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'can_edit_invoices'
    ) THEN
        ALTER TABLE permissions ADD COLUMN can_edit_invoices BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- can_edit_clients カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'can_edit_clients'
    ) THEN
        ALTER TABLE permissions ADD COLUMN can_edit_clients BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- can_access_payments カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'can_access_payments'
    ) THEN
        ALTER TABLE permissions ADD COLUMN can_access_payments BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- can_send_emails カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'can_send_emails'
    ) THEN
        ALTER TABLE permissions ADD COLUMN can_send_emails BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- can_access_settings カラムを追加（存在しない場合）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'can_access_settings'
    ) THEN
        ALTER TABLE permissions ADD COLUMN can_access_settings BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- ステップ2: updated_at カラムを追加（存在しない場合）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'permissions' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE permissions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- ステップ3: updated_at自動更新トリガーを作成
CREATE OR REPLACE FUNCTION update_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除してから再作成
DROP TRIGGER IF EXISTS trigger_permissions_updated_at ON permissions;

CREATE TRIGGER trigger_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_permissions_updated_at();

-- ステップ4: RLS (Row Level Security) ポリシーを設定
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view own permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can update all permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can insert permissions" ON permissions;

-- ポリシーを再作成
-- Policy: Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON permissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all permissions
CREATE POLICY "Admins can view all permissions"
  ON permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can update all permissions
CREATE POLICY "Admins can update all permissions"
  ON permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can insert permissions for new users
CREATE POLICY "Admins can insert permissions"
  ON permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- ステップ5: roleカラムのCHECK制約を追加（存在しない場合）
DO $$ 
BEGIN
    -- 既存の制約を削除
    ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_role_check;
    
    -- 新しい制約を追加
    ALTER TABLE permissions ADD CONSTRAINT permissions_role_check 
        CHECK (role IN ('admin', 'accounting', 'sales', 'viewer'));
END $$;

-- ステップ6: コメントを追加（ドキュメント化）
COMMENT ON TABLE permissions IS 'ユーザー権限管理テーブル';
COMMENT ON COLUMN permissions.id IS '権限ID（主キー）';
COMMENT ON COLUMN permissions.user_id IS 'ユーザーID（auth.usersへの外部キー）';
COMMENT ON COLUMN permissions.role IS 'ロール（admin/accounting/sales/viewer）';
COMMENT ON COLUMN permissions.can_edit_invoices IS '請求書編集権限';
COMMENT ON COLUMN permissions.can_edit_clients IS '顧客編集権限';
COMMENT ON COLUMN permissions.can_access_payments IS '支払管理アクセス権限';
COMMENT ON COLUMN permissions.can_send_emails IS 'メール送信権限';
COMMENT ON COLUMN permissions.can_access_settings IS '設定アクセス権限';
COMMENT ON COLUMN permissions.created_at IS '作成日時';
COMMENT ON COLUMN permissions.updated_at IS '更新日時';

-- 完了メッセージ
DO $$ 
BEGIN
    RAISE NOTICE 'permissionsテーブルの修正が完了しました';
END $$;