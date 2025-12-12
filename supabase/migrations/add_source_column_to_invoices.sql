-- Add source column to invoices table
-- Migration: add_source_column_to_invoices
-- Created: 2025-12-11

-- 1. Add source column with default 'imported'
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'imported';

-- 2. Update existing records to 'manual'
UPDATE invoices
SET source = 'manual'
WHERE source = 'imported';

-- 3. Add comment to the column
COMMENT ON COLUMN invoices.source IS 'Data source: manual, pdf_import, or image_import';
