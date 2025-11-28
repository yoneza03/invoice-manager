-- Create invoice_templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  items JSON NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_templates_user_id ON invoice_templates(user_id);

-- Add index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_invoice_templates_created_at ON invoice_templates(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_invoice_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_invoice_templates_updated_at
  BEFORE UPDATE ON invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_templates_updated_at();

-- Add Row Level Security (RLS) policies
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own templates
CREATE POLICY "Users can view own templates"
  ON invoice_templates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own templates
CREATE POLICY "Users can insert own templates"
  ON invoice_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own templates
CREATE POLICY "Users can update own templates"
  ON invoice_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own templates
CREATE POLICY "Users can delete own templates"
  ON invoice_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE invoice_templates IS '請求書テンプレート管理テーブル';
COMMENT ON COLUMN invoice_templates.id IS 'テンプレートID（主キー）';
COMMENT ON COLUMN invoice_templates.user_id IS 'ユーザーID';
COMMENT ON COLUMN invoice_templates.name IS 'テンプレート名';
COMMENT ON COLUMN invoice_templates.description IS 'テンプレートの説明（任意）';
COMMENT ON COLUMN invoice_templates.items IS '請求書明細（JSON配列）';
COMMENT ON COLUMN invoice_templates.subtotal IS '小計';
COMMENT ON COLUMN invoice_templates.tax_rate IS '税率（%）';
COMMENT ON COLUMN invoice_templates.tax_amount IS '税額';
COMMENT ON COLUMN invoice_templates.total_amount IS '合計金額';
COMMENT ON COLUMN invoice_templates.created_at IS '作成日時';
COMMENT ON COLUMN invoice_templates.updated_at IS '更新日時';