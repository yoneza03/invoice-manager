-- 現在のpermissionsテーブルの構造を確認するクエリ
-- Supabase Studio の SQL Editor で実行してください

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
    AND table_name = 'permissions'
ORDER BY 
    ordinal_position;