-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'accounting', 'sales', 'viewer')),
  can_edit_invoices BOOLEAN NOT NULL DEFAULT false,
  can_edit_clients BOOLEAN NOT NULL DEFAULT false,
  can_access_payments BOOLEAN NOT NULL DEFAULT false,
  can_send_emails BOOLEAN NOT NULL DEFAULT false,
  can_access_settings BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_permissions_updated_at();

-- Add Row Level Security (RLS) policies
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

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

-- Function to automatically create default permissions for new users
CREATE OR REPLACE FUNCTION create_default_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO permissions (user_id, role, can_edit_invoices, can_edit_clients, can_access_payments, can_send_emails, can_access_settings)
  VALUES (NEW.id, 'viewer', false, false, false, false, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default permissions when a new user is created
CREATE TRIGGER trigger_create_default_permissions
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_permissions();

-- Add comments for documentation
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