'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { getInvoiceTemplateById, updateInvoiceTemplate } from '@/lib/api/templates';
import { InvoiceTemplate, UpdateInvoiceTemplateRequest } from '@/lib/types';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';

interface PageProps {
  params: {
    id: string;
  };
}

export default function EditTemplatePage({ params }: PageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);

  useEffect(() => {
    const checkAuthAndLoadTemplate = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // 認証チェック
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          toast({
            title: 'エラー',
            description: 'ログインが必要です',
            variant: 'destructive',
          });
          router.push('/login');
          return;
        }
        
        setIsAuthenticated(true);

        // IDの存在チェック
        const { id } = params;
        if (!id) {
          toast({
            title: 'エラー',
            description: 'テンプレートIDが指定されていません',
            variant: 'destructive',
          });
          router.push('/templates');
          return;
        }

        // テンプレートデータ取得
        const templateData = await getInvoiceTemplateById(id);
        
        if (!templateData) {
          toast({
            title: 'エラー',
            description: 'テンプレートが見つかりません',
            variant: 'destructive',
          });
          router.push('/templates');
          return;
        }

        setTemplate(templateData);
      } catch (error) {
        console.error('テンプレート読み込みエラー:', error);
        toast({
          title: 'エラー',
          description: 'テンプレートの読み込みに失敗しました',
          variant: 'destructive',
        });
        router.push('/templates');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndLoadTemplate();
  }, [params, router, toast]);

  const handleUpdate = async (input: UpdateInvoiceTemplateRequest) => {
    const { id } = params;
    
    if (!id) {
      toast({
        title: 'エラー',
        description: 'テンプレートIDが不正です',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateInvoiceTemplate(id, input);
      
      toast({
        title: '成功',
        description: 'テンプレートを更新しました',
      });
      
      router.push('/templates');
    } catch (error) {
      console.error('テンプレート更新エラー:', error);
      toast({
        title: 'エラー',
        description: 'テンプレートの更新に失敗しました',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !template) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">テンプレート編集</h1>
        <p className="text-muted-foreground mt-2">
          テンプレートを編集します
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <TemplateEditor
          mode="edit"
          initialData={template}
          onSave={handleUpdate}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}