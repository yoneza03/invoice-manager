'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { createInvoiceTemplate } from '@/lib/api/templates';
import { CreateInvoiceTemplateRequest, UpdateInvoiceTemplateRequest } from '@/lib/types';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useToast } from '@/hooks/use-toast';

export default function NewTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          toast({
            title: 'エラー',
            description: 'ログインが必要です',
            variant: 'destructive',
          });
          router.push('/login');
          return;
        }
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('認証チェックエラー:', error);
        toast({
          title: 'エラー',
          description: '認証情報の確認に失敗しました',
          variant: 'destructive',
        });
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, toast]);

  const handleCreate = async (input: CreateInvoiceTemplateRequest | UpdateInvoiceTemplateRequest) => {
    try {
      // createモードでは常にCreateInvoiceTemplateRequestが渡される
      await createInvoiceTemplate(input as CreateInvoiceTemplateRequest);
      
      toast({
        title: '成功',
        description: 'テンプレートを作成しました',
      });
      
      router.push('/templates');
    } catch (error) {
      console.error('テンプレート作成エラー:', error);
      toast({
        title: 'エラー',
        description: 'テンプレートの作成に失敗しました',
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">テンプレート新規作成</h1>
        <p className="text-muted-foreground mt-2">
          新しい請求書テンプレートを作成します
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <TemplateEditor
          mode="create"
          initialData={null}
          onSave={handleCreate}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}