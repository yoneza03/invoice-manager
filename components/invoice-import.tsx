"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Image as ImageIcon, X, Loader2, CheckCircle, AlertCircle, Plus, Trash2, Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react"
import { invoiceImportService } from "@/lib/invoice-import-service"
import { useStore } from "@/lib/store"
import { Invoice, OCRResult } from "@/lib/types"
import { extractInvoiceData } from '@/lib/ocr/invoiceExtractor';
import type { InvoiceData } from '@/lib/types';
import { formatFileSize, fileToImageForOCR } from "@/lib/file-processor"
import { ocrProcessor } from "@/lib/ocr-processor"
import { toast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { InvoiceStatus } from "@/lib/types";


async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

type ProcessingStatus = "idle" | "uploading" | "converting" | "ocr_processing" | "extracting" | "success" | "error"

interface ImportedFile {
  file: File
  preview?: string
  status: ProcessingStatus
  error?: string
  progress?: number // 0-100のOCR進捗
  currentStep?: string // 現在の処理ステップの説明
  checked: boolean // チェックボックスの状態
  result?: {
    invoice: Partial<Invoice>
    ocrData: OCRResult
  }
  extractedData?: InvoiceData | null // ファイルごとのOCR抽出データ
  ocrConfidence?: number // ファイルごとのOCR信頼度
}

export default function InvoiceImport() {
  const { clients, addInvoice, addClient } = useStore()
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<ImportedFile | null>(null)
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    issueDate: '',
    transactionDate: '',
    currency: 'JPY',
    subject: '',
    orderNumber: '',
    billingToDepartment: '',
    billingToContactPerson: '',
    dueDate: '',
    paymentCondition: '',
    bankName: '',
    branchName: '',
    accountType: '',
    accountNumber: '',
    accountHolder: '',
    feeBearer: '',
    taxRate: 10,
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // ファイルを追加
    const newFiles: ImportedFile[] = acceptedFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "idle" as ProcessingStatus,
      checked: false, // デフォルトは未チェック
    }))

    setImportedFiles((prev) => [...prev, ...newFiles])

    // 順次処理
    for (const newFile of newFiles) {
      await processFile(newFile)
    }
  }, [clients])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10, // 最大10枚まで同時アップロード可能
  })

  const processFile = async (importedFile: ImportedFile) => {
    try {
      // ステップ1: アップロード中
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? { ...f, status: "uploading", progress: 10, currentStep: "ファイルをアップロード中..." }
            : f
        )
      )

      await new Promise((resolve) => setTimeout(resolve, 300))

      // ステップ2: ファイル変換中
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? { ...f, status: "converting", progress: 25, currentStep: "ファイルを画像に変換中..." }
            : f
        )
      )

      await new Promise((resolve) => setTimeout(resolve, 500))

      // ステップ3: OCR処理中
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? { ...f, status: "ocr_processing", progress: 50, currentStep: "OCRでテキストを認識中..." }
            : f
        )
      )

      // OCR処理（実際の処理）
      const result = await invoiceImportService.importFromFile(importedFile.file, clients)

      // ステップ4: データ抽出中
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? { ...f, status: "extracting", progress: 75, currentStep: "請求書データを抽出中..." }
            : f
        )
      )

      // ファイルハッシュを計算
      const fileHash = await calculateFileHash(importedFile.file)

      // extractInvoiceDataを使用してInvoiceDataを抽出
      let invoiceData: InvoiceData | null = null
      let confidence = 0

      try {
        // ファイルを画像に変換してOCR処理
        const imageData = await fileToImageForOCR(importedFile.file)
        const ocrText = await ocrProcessor.extractText(imageData)

        // extractInvoiceDataを呼び出し
        invoiceData = extractInvoiceData(ocrText, importedFile.file.name, fileHash)

        // 信頼度スコアを取得
        confidence = invoiceData.metadata.ocrConfidence

        console.log('[OCR Integration] InvoiceData抽出成功:', {
          id: invoiceData.id,
          confidence: confidence,
          issuerName: invoiceData.issuerInfo?.name,
          totalAmount: invoiceData.amountInfo.totalAmount
        })
      } catch (extractError) {
        console.error('[OCR Integration] InvoiceData抽出エラー:', extractError)
        // エラーが発生してもインポート処理は継続
      }

      await new Promise((resolve) => setTimeout(resolve, 300))

      // ステップ5: 完了（ファイルごとのOCRデータを保存）
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? {
                ...f,
                status: "success",
                progress: 100,
                currentStep: "完了",
                result: {
                  invoice: result.invoice,
                  ocrData: result.ocrData,
                },
                extractedData: invoiceData, // ファイルごとに保存
                ocrConfidence: confidence, // ファイルごとに保存
              }
            : f
        )
      )

      // OCR抽出完了時のトースト通知
      if (invoiceData && confidence > 0) {
        const confidencePercent = Math.round(confidence * 100)

        toast({
          title: `OCR抽出が完了しました: ${importedFile.file.name}`,
          description: `信頼度: ${confidencePercent}%`,
          variant: confidencePercent < 70 ? "destructive" : "default",
        })
      }
    } catch (error) {
      console.error("ファイル処理エラー:", error)

      // エラーの種類によって詳細なメッセージを設定
      let errorMessage = "処理に失敗しました"

      if (error instanceof Error) {
        if (error.message.includes("ファイルサイズ")) {
          errorMessage = "ファイルサイズが大きすぎます（10MB以下にしてください）"
        } else if (error.message.includes("ファイル形式")) {
          errorMessage = "対応していないファイル形式です（PDF、JPEG、PNGのみ対応）"
        } else if (error.message.includes("OCR")) {
          errorMessage = "OCR処理に失敗しました。画質を確認してください"
        } else {
          errorMessage = error.message
        }
      }

      // エラー時のトースト通知
      toast({
        title: "OCR抽出に失敗しました",
        description: errorMessage,
        variant: "destructive",
      })

      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? {
                ...f,
                status: "error",
                progress: 0,
                currentStep: "エラー",
                error: errorMessage,
              }
            : f
        )
      )
    }
  }

  // OCR抽出データをフォームに反映する関数（空欄のみセット）
  function applyExtractedDataToForm(data: InvoiceData, targetFile: ImportedFile) {
    if (!targetFile?.result) return;

    console.log('[applyExtractedDataToForm] データ反映開始（空欄のみ）', data);

    const currentInvoice = targetFile.result.invoice;
    const updatedInvoice: Partial<Invoice> = {
      ...currentInvoice,
    };

    // 基本情報の自動入力（OCR値を優先）
    if (data.basicInfo) {
      // 請求書番号：OCR値を優先、空の場合のみ既存値を保持
      if (data.basicInfo.invoiceNumber) {
        updatedInvoice.invoiceNumber = data.basicInfo.invoiceNumber;
      }
      // 発行日：OCR値を優先、空の場合のみ既存値を保持
      if (data.basicInfo.issueDate) {
        updatedInvoice.issueDate = new Date(data.basicInfo.issueDate);
      }
      // 取引日の自動入力（notesが空の場合のみ）
      if (data.basicInfo.transactionDate && !currentInvoice.notes) {
        const transactionDateNote = `取引日: ${data.basicInfo.transactionDate}`;
        updatedInvoice.notes = transactionDateNote;
      }
      // 通貨の自動入力（notesが空の場合のみ）
      if (data.basicInfo.currency && data.basicInfo.currency !== 'JPY' && !currentInvoice.notes) {
        const currencyNote = `通貨: ${data.basicInfo.currency}`;
        updatedInvoice.notes = updatedInvoice.notes
          ? `${updatedInvoice.notes}\n${currencyNote}`
          : currencyNote;
      }
      // 件名の自動入力（notesが空の場合のみ）
      if (data.basicInfo.subject && !currentInvoice.notes) {
        const subjectNote = `件名: ${data.basicInfo.subject}`;
        updatedInvoice.notes = updatedInvoice.notes
          ? `${updatedInvoice.notes}\n${subjectNote}`
          : subjectNote;
      }
      // 発注番号の自動入力（notesが空の場合のみ）
      if (data.basicInfo.orderNumber && !currentInvoice.notes) {
        const orderNote = `発注番号: ${data.basicInfo.orderNumber}`;
        updatedInvoice.notes = updatedInvoice.notes
          ? `${updatedInvoice.notes}\n${orderNote}`
          : orderNote;
      }
    }

    // 請求先情報の自動入力（空欄のみ）
    if (data.billingTo && currentInvoice.client) {
      updatedInvoice.client = {
        ...currentInvoice.client,
      };
      if (data.billingTo.companyName && !currentInvoice.client.name) {
        updatedInvoice.client.name = data.billingTo.companyName;
      }
      if (data.billingTo.contactPerson && !currentInvoice.client.contactPerson) {
        updatedInvoice.client.contactPerson = data.billingTo.contactPerson;
      }
      // 部署名の自動入力（memoが空の場合のみ）
      if (data.billingTo.department && !currentInvoice.client.memo) {
        const deptMemo = `部署: ${data.billingTo.department}`;
        updatedInvoice.client.memo = deptMemo;
      }
    }

    // 金額情報の自動入力（空欄のみ）
    if (data.amountInfo) {
      if (data.amountInfo.subtotal && !currentInvoice.subtotal) {
        updatedInvoice.subtotal = data.amountInfo.subtotal;
      }
      if (data.amountInfo.taxAmount && !currentInvoice.tax) {
        updatedInvoice.tax = data.amountInfo.taxAmount;
      }
      if (data.amountInfo.totalAmount && !currentInvoice.total) {
        updatedInvoice.total = data.amountInfo.totalAmount;
      }

      // 税率を計算（空欄のみ）
      // 内部値は必ず10（UI上の%値）として保持
      if (!currentInvoice.taxRate) {
        if (data.amountInfo.taxBreakdown.length > 0) {
          // 税率がパーセント形式（10）か小数形式（0.1）かを判定し、必ず%値に変換
          const rate = data.amountInfo.taxBreakdown[0].rate;
          updatedInvoice.taxRate = rate < 1 ? rate * 100 : rate;
        } else if (data.amountInfo.subtotal > 0 && data.amountInfo.taxAmount > 0) {
          // 小計と税額から税率を計算（%値として保存）
          updatedInvoice.taxRate = (data.amountInfo.taxAmount / data.amountInfo.subtotal) * 100;
        }
      }
    }

    // 発行者情報の自動入力（OCR値を優先）
    if (data.issuerInfo) {
      // 既存のissuerInfoがある場合は、OCR値でマージ
      updatedInvoice.issuerInfo = {
        name: data.issuerInfo.name || currentInvoice.issuerInfo?.name || '',
        address: data.issuerInfo.address || currentInvoice.issuerInfo?.address,
        phone: data.issuerInfo.phone || currentInvoice.issuerInfo?.phone,
        email: data.issuerInfo.email || currentInvoice.issuerInfo?.email,
        registrationNumber: data.issuerInfo.registrationNumber || currentInvoice.issuerInfo?.registrationNumber,
      };
    }

    // 支払条件の自動入力（OCR値を優先）
    if (data.paymentTerms) {
      // 支払期限：OCR値を優先、空の場合のみ既存値を保持
      if (data.paymentTerms.dueDate) {
        updatedInvoice.dueDate = new Date(data.paymentTerms.dueDate);
      }

      if (!currentInvoice.paymentInfo || Object.keys(currentInvoice.paymentInfo).length === 0) {
        updatedInvoice.paymentInfo = {
          bankName: data.paymentTerms.bankName || undefined,
          branchName: data.paymentTerms.branchName || undefined,
          accountType: data.paymentTerms.accountType || undefined,
          accountNumber: data.paymentTerms.accountNumber || undefined,
          accountHolder: data.paymentTerms.accountHolder || undefined,
        };
      }
    }

    // 明細行の自動入力（既存がない場合のみセット、ある場合は追加）
    if (data.lineItems && data.lineItems.length > 0) {
      if (!currentInvoice.lineItems || currentInvoice.lineItems.length === 0) {
        updatedInvoice.lineItems = data.lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.amount,
          amount: item.amount,
        }));
      }
      // 既存の明細がある場合は追加しない（ユーザー編集を保護）
    }

    // メタデータ情報の反映（空欄のみ）
    if (data.metadata) {
      if (data.metadata.source && !currentInvoice.source) {
        updatedInvoice.source = data.metadata.source;
      }
      if (data.metadata.status && !currentInvoice.status) {
        updatedInvoice.status = data.metadata.status;
      }
    }

    // ファイルの結果を更新
    setImportedFiles((prev) =>
      prev.map((f) =>
        f.file === targetFile.file
          ? {
              ...f,
              result: {
                ...f.result!,
                invoice: updatedInvoice,
              },
            }
          : f
      )
    );

    // selectedFileも更新（UIに即座に反映）
    setSelectedFile(prev =>
      prev && prev.file === targetFile.file
        ? {
            ...prev,
            result: {
              ...prev.result!,
              invoice: updatedInvoice,
            },
          }
        : prev
    );

    console.log('[applyExtractedDataToForm] フォームへの自動入力完了（空欄のみ）', updatedInvoice);
  }

  // selectedFileが変更されたときにファイルごとのOCRデータをフォームに反映
  // 初回のみ実行（OCR完了時のみ）
  useEffect(() => {
    if (selectedFile && selectedFile.extractedData && selectedFile.result && selectedFile.status === 'success') {
      // 既に反映済みかチェック（extractedDataが存在し、かつinvoiceに最低限のデータがある場合は既に反映済み）
      const alreadyApplied = selectedFile.result.invoice.invoiceNumber ||
                             selectedFile.result.invoice.total ||
                             (selectedFile.result.invoice.lineItems && selectedFile.result.invoice.lineItems.length > 0);

      // まだ反映されていない場合のみ実行
      if (!alreadyApplied) {
        // 開発環境でのみデバッグログを出力
        if (process.env.NODE_ENV === 'development') {
          console.log('抽出されたデータ:', selectedFile.extractedData)
          console.log('OCR信頼度:', selectedFile.ocrConfidence)
        }

        // applyExtractedDataToForm関数を呼び出してフォームに反映
        applyExtractedDataToForm(selectedFile.extractedData, selectedFile)
      }
    }
  }, [selectedFile?.file, selectedFile?.status])

  const removeFile = (file: File) => {
    setImportedFiles((prev) => prev.filter((f) => f.file !== file))
    if (selectedFile?.file === file) {
      setSelectedFile(null)
    }
  }

  const confirmImport = async (importedFile: ImportedFile) => {
    if (!importedFile.result) {
      throw new Error('インポートデータが見つかりません');
    }

    const { invoice } = importedFile.result;
    const { extractedData } = importedFile; // OCR抽出データを取得

    // Supabase クライアント作成
    const supabase = createSupabaseBrowserClient();

    // ログイン中のユーザーID取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('ログインユーザー情報が取得できませんでした');
    }

    // ★★★ OCRデータから不足しているフィールドを補完 ★★★
    let finalInvoiceNumber = invoice.invoiceNumber;
    let finalIssueDate = invoice.issueDate;
    let finalDueDate = invoice.dueDate;

    // invoice_number が空の場合、extractedData から取得
    if (!finalInvoiceNumber && extractedData?.basicInfo?.invoiceNumber) {
      finalInvoiceNumber = extractedData.basicInfo.invoiceNumber;
      console.log('[confirmImport] ✅ invoice_number を extractedData から補完:', finalInvoiceNumber);
    }

    // issue_date が空の場合、extractedData から取得
    if (!finalIssueDate && extractedData?.basicInfo?.issueDate) {
      finalIssueDate = new Date(extractedData.basicInfo.issueDate);
      console.log('[confirmImport] ✅ issue_date を extractedData から補完:', finalIssueDate);
    }

    // due_date が空の場合、extractedData から取得
    if (!finalDueDate && extractedData?.paymentTerms?.dueDate) {
      finalDueDate = new Date(extractedData.paymentTerms.dueDate);
      console.log('[confirmImport] ✅ due_date を extractedData から補完:', finalDueDate);
    }

    console.log('[confirmImport] インポート開始（保存前のデータ確認）:', {
      invoiceNumber: finalInvoiceNumber,
      issueDate: finalIssueDate,
      dueDate: finalDueDate,
      clientName: invoice.client?.name,
      total: invoice.total,
      taxRate: invoice.taxRate,
      status: invoice.status,
      userId: user.id,
      issuerInfo: invoice.issuerInfo,
      items: invoice.lineItems,
    });

    // 請求書を Supabase に保存（存在するカラムのみ）
    const invoiceId = crypto.randomUUID();

    // ★★★ Supabase insert ペイロード（OCR補完後のデータを使用） ★★★
    const insertPayload = {
      // 基本情報
      id: invoiceId,
      user_id: user.id,
      invoice_number: finalInvoiceNumber || "", // ★ OCR補完後のデータ
      client_name: invoice.client?.name ?? "",
      amount: invoice.total ?? 0,
      status: "pending", // ★ インポート時は常に pending に統一
      due_date: finalDueDate ? finalDueDate.toISOString() : null, // ★ OCR補完後のデータ（nullのまま保持）
      paid_date: null,
      issue_date: finalIssueDate ? finalIssueDate.toISOString() : null, // ★ OCR補完後のデータ（nullのまま保持）
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'imported', // ★ インポート元を追加
      // 発行者情報（存在するカラムのみ）
      issuer_name: invoice.issuerInfo?.name ?? null,
      issuer_address: invoice.issuerInfo?.address ?? null,
      issuer_tel: invoice.issuerInfo?.phone ?? null,
      issuer_email: invoice.issuerInfo?.email ?? null,
      issuer_registration_number: invoice.issuerInfo?.registrationNumber ?? null, // ★ 適格請求書発行事業者登録番号を追加
      // 支払情報（振込先 - 存在するカラムのみ）
      issuer_bank_name: invoice.paymentInfo?.bankName ?? null,
      issuer_bank_branch: invoice.paymentInfo?.branchName ?? null,
      issuer_bank_account: invoice.paymentInfo?.accountNumber ?? null,
    };

    console.log('[confirmImport] ★★★ Supabase insert ペイロード全体 ★★★', insertPayload);
    console.log('[confirmImport] ★★★ invoice_number 確認 ★★★', {
      'insertPayload.invoice_number': insertPayload.invoice_number,
      '長さ': insertPayload.invoice_number.length,
      '型': typeof insertPayload.invoice_number,
    });
    console.log('[confirmImport] ★★★ issue_date 確認 ★★★', insertPayload.issue_date);
    console.log('[confirmImport] ★★★ due_date 確認 ★★★', insertPayload.due_date);
    console.log('[confirmImport] ★★★ 元データ確認 - invoice.lineItems ★★★', invoice.lineItems);
    console.log('[confirmImport] ★★★ 元データ確認 - invoice.issuerInfo ★★★', invoice.issuerInfo);
    console.log('[confirmImport] ★★★ 元データ確認 - invoice.client ★★★', invoice.client);
    console.log('[confirmImport] ★★★ 元データ確認 - invoice.status ★★★', invoice.status);

    const { data, error } = await supabase.from("invoices").insert(insertPayload).select();

    if (error) {
      throw new Error(`請求書を保存できませんでした: ${error.message}`);
    }

    console.log('[confirmImport] Supabase保存成功:', data);

    // LocalStorage（useStore）にも保存して一覧に表示されるようにする
    // ★重要: OCR補完後のデータを使用（new Date() をデフォルト値として使用しない）
    const fullInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber: finalInvoiceNumber || "", // ★ OCR補完後のデータ
      issueDate: finalIssueDate || new Date(), // ★ OCR補完後のデータ（最終手段として new Date()）
      dueDate: finalDueDate || new Date(), // ★ OCR補完後のデータ（最終手段として new Date()）
      client: invoice.client ?? {
        id: crypto.randomUUID(),
        name: "",
        email: "",
        phone: "",
        address: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      lineItems: invoice.lineItems ?? [], // ★ items を確実に保存
      subtotal: invoice.subtotal ?? 0,
      tax: invoice.tax ?? 0,
      taxRate: invoice.taxRate ?? 10,
      total: invoice.total ?? 0,
      notes: invoice.notes ?? "",
      status: "pending" as InvoiceStatus, // ★ インポート時は常に pending に統一
      createdAt: new Date(),
      updatedAt: new Date(),
      paidDate: undefined,
      source: 'imported', // ★ インポート元を追加
      issuerInfo: invoice.issuerInfo, // ★ 発行者情報を確実に保存
      paymentInfo: invoice.paymentInfo, // ★ 支払情報を確実に保存
      isNew: true,
    };

    console.log('[confirmImport] LocalStorage保存前の最終データ確認:', {
      id: fullInvoice.id,
      invoiceNumber: fullInvoice.invoiceNumber,
      issueDate: fullInvoice.issueDate,
      dueDate: fullInvoice.dueDate,
      issuerInfo: fullInvoice.issuerInfo,
      lineItems: fullInvoice.lineItems,
      status: fullInvoice.status,
      taxRate: fullInvoice.taxRate,
    });

    // useStoreのaddInvoiceを呼び出してLocalStorageにも保存
    await addInvoice(fullInvoice);
    console.log('[confirmImport] LocalStorage保存完了');
  };

  // すべて選択
  const selectAll = () => {
    setImportedFiles((prev) =>
      prev.map((f) => ({ ...f, checked: true }))
    );
  };

  // チェック済みをインポート
  const importChecked = async () => {
    const checkedFiles = importedFiles.filter((f) => f.checked && f.status === "success");

    if (checkedFiles.length === 0) {
      toast({
        title: "エラー",
        description: "インポート可能なファイルが選択されていません。",
        variant: "destructive",
      });
      return;
    }

    console.log(`[importChecked] バッチインポート開始: ${checkedFiles.length}件`);

    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    for (const file of checkedFiles) {
      try {
        await confirmImport(file);
        successCount++;
        console.log(`[importChecked] インポート成功 (${successCount}/${checkedFiles.length}):`, file.file.name);
      } catch (error) {
        console.error("[importChecked] インポートエラー:", error);
        errorCount++;
        errorMessages.push(`${file.file.name}: ${error instanceof Error ? error.message : 'エラー'}`);
      }
    }

    console.log(`[importChecked] バッチインポート完了: 成功${successCount}件, 失敗${errorCount}件`);
    if (errorMessages.length > 0) {
      console.error(`[importChecked] エラー詳細:`, errorMessages);
    }

    // バッチインポート完了後にまとめてファイルを削除
    setImportedFiles((prev) => prev.filter((f) => !checkedFiles.includes(f)));
    if (selectedFile && checkedFiles.includes(selectedFile)) {
      setSelectedFile(null);
    }

    toast({
      title: "インポート完了",
      description: `${successCount}件の請求書をインポートしました。${errorCount > 0 ? `（${errorCount}件失敗）` : ""}`,
    });
  };

  // すべてインポート（確認省略）
  const importAll = async () => {
    const successFiles = importedFiles.filter((f) => f.status === "success");

    if (successFiles.length === 0) {
      toast({
        title: "エラー",
        description: "インポート可能なファイルがありません。",
        variant: "destructive",
      });
      return;
    }

    const confirmed = window.confirm("すべての請求書を確認なしでインポートします。よろしいですか？");

    if (!confirmed) {
      return;
    }

    console.log(`[importAll] 全件インポート開始: ${successFiles.length}件`);

    let successCount = 0;
    let errorCount = 0;
    const errorMessages: string[] = [];

    for (const file of successFiles) {
      try {
        await confirmImport(file);
        successCount++;
        console.log(`[importAll] インポート成功 (${successCount}/${successFiles.length}):`, file.file.name);
      } catch (error) {
        console.error("[importAll] インポートエラー:", error);
        errorCount++;
        errorMessages.push(`${file.file.name}: ${error instanceof Error ? error.message : 'エラー'}`);
      }
    }

    console.log(`[importAll] 全件インポート完了: 成功${successCount}件, 失敗${errorCount}件`);
    if (errorMessages.length > 0) {
      console.error(`[importAll] エラー詳細:`, errorMessages);
    }

    // バッチインポート完了後にまとめてファイルを削除
    setImportedFiles([]);
    setSelectedFile(null);

    toast({
      title: "インポート完了",
      description: `${successCount}件の請求書をインポートしました。${errorCount > 0 ? `（${errorCount}件失敗）` : ""}`,
    });
  };

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case "uploading":
      case "converting":
      case "ocr_processing":
      case "extracting":
        return <Loader2 className="animate-spin text-blue-500" size={20} />
      case "success":
        return <CheckCircle className="text-green-500" size={20} />
      case "error":
        return <AlertCircle className="text-red-500" size={20} />
      default:
        return null
    }
  }

  const getStatusText = (status: ProcessingStatus, currentStep?: string) => {
    if (currentStep) {
      return currentStep
    }

    switch (status) {
      case "uploading":
        return "アップロード中..."
      case "converting":
        return "変換中..."
      case "ocr_processing":
        return "OCR処理中..."
      case "extracting":
        return "データ抽出中..."
      case "success":
        return "完了"
      case "error":
        return "エラー"
      default:
        return "待機中"
    }
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">請求書インポート</h1>
        <p className="text-muted-foreground">PDFまたは画像ファイルから請求書データを自動抽出</p>
      </div>

      {/* ドロップゾーン */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors mb-8 ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 text-muted-foreground" size={48} />
        <p className="text-lg font-semibold text-foreground mb-2">
          {isDragActive ? "ファイルをドロップしてください" : "ファイルをドラッグ&ドロップ"}
        </p>
        <p className="text-sm text-muted-foreground mb-4">または クリックしてファイルを選択</p>
        <p className="text-xs text-muted-foreground">
          対応形式: PDF, JPEG, PNG（最大10MB、10枚まで同時アップロード可能）
        </p>
      </div>

      {/* ファイルリスト */}
      {importedFiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ファイル一覧 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">アップロードファイル</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                >
                  すべて選択
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={importChecked}
                >
                  チェック済みをインポート
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={importAll}
                >
                  すべてインポート
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {importedFiles.map((importedFile, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                    selectedFile?.file === importedFile.file
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={importedFile.checked}
                    onCheckedChange={(checked) => {
                      setImportedFiles((prev) =>
                        prev.map((f) =>
                          f.file === importedFile.file
                            ? { ...f, checked: !!checked }
                            : f
                        )
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => setSelectedFile(importedFile)}
                  >
                    {importedFile.file.type === "application/pdf" ? (
                      <FileText className="text-red-500" size={24} />
                    ) : (
                      <ImageIcon className="text-blue-500" size={24} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {importedFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(importedFile.file.size)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(importedFile.status)}
                        <span className="text-xs text-muted-foreground">
                          {getStatusText(importedFile.status, importedFile.currentStep)}
                        </span>
                      </div>
                      {importedFile.progress !== undefined && importedFile.status !== "success" && importedFile.status !== "error" && (
                        <div className="w-20 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${importedFile.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(importedFile.file)
                      }}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors"
                    >
                      <X size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* プレビュー・結果 */}
          <div className="bg-card border border-border rounded-lg p-6">
            {selectedFile ? (
              <>
                <h2 className="text-xl font-bold text-foreground mb-4">
                  {selectedFile.status === "success" ? "抽出結果" : "プレビュー"}
                </h2>

                {/* プレビュー画像 */}
                {selectedFile.preview && (
                  <div className="mb-4">
                    <img
                      src={selectedFile.preview}
                      alt="Preview"
                      className="w-full h-48 object-contain bg-muted rounded"
                    />
                  </div>
                )}

                {/* OCR結果 - 編集可能 */}
                {selectedFile.status === "success" && selectedFile.result && (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                    {/* OCR信頼度バー */}
                    <Card className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "border-yellow-500 bg-yellow-50/50" : ""}>
                      <CardContent className="pt-4">
                        <Label className="text-sm font-medium">OCR信頼度</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                (selectedFile.ocrConfidence ?? 0) >= 0.7 ? "bg-green-500" : "bg-yellow-500"
                              }`}
                              style={{
                                width: `${((selectedFile.ocrConfidence ?? 0) * 100).toFixed(0)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {((selectedFile.ocrConfidence ?? 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                        {(selectedFile.ocrConfidence ?? 0) < 0.7 && (
                          <p className="text-xs text-yellow-700 mt-1">
                            ⚠️ 信頼度が低いため、内容を確認してください
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* A. 基本情報セクション */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">基本情報</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="invoiceNumber">請求書番号 *</Label>
                            <Input
                              id="invoiceNumber"
                              value={selectedFile.result.invoice.invoiceNumber || ""}
                              onChange={(e) => {
                                setImportedFiles((prev) =>
                                  prev.map((f) =>
                                    f.file === selectedFile.file
                                      ? {
                                          ...f,
                                          result: {
                                            ...f.result!,
                                            invoice: {
                                              ...f.result!.invoice,
                                              invoiceNumber: e.target.value,
                                            },
                                          },
                                        }
                                      : f
                                  )
                                )
                                setSelectedFile(prev =>
                                  prev && prev.file === selectedFile.file
                                    ? {
                                        ...prev,
                                        result: {
                                          ...prev.result!,
                                          invoice: {
                                            ...prev.result!.invoice,
                                            invoiceNumber: e.target.value,
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }}
                              className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}
                            />
                          </div>
                          <div>
                            <Label htmlFor="issueDate">発行日</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={`w-full justify-start text-left font-normal ${
                                    !selectedFile.result.invoice.issueDate && "text-muted-foreground"
                                  }`}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {selectedFile.result.invoice.issueDate
                                    ? format(selectedFile.result.invoice.issueDate, "PPP", { locale: ja })
                                    : "日付を選択"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={selectedFile.result.invoice.issueDate}
                                  onSelect={(date) => {
                                    setImportedFiles((prev) =>
                                      prev.map((f) =>
                                        f.file === selectedFile.file
                                          ? {
                                              ...f,
                                              result: {
                                                ...f.result!,
                                                invoice: {
                                                  ...f.result!.invoice,
                                                  issueDate: date,
                                                },
                                              },
                                            }
                                          : f
                                      )
                                    )
                                    setSelectedFile(prev =>
                                      prev && prev.file === selectedFile.file
                                        ? {
                                            ...prev,
                                            result: {
                                              ...prev.result!,
                                              invoice: {
                                                ...prev.result!.invoice,
                                                issueDate: date,
                                              },
                                            },
                                          }
                                        : prev
                                    )
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="dueDate">支払期日</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${
                                  !selectedFile.result.invoice.dueDate && "text-muted-foreground"
                                }`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedFile.result.invoice.dueDate
                                  ? format(selectedFile.result.invoice.dueDate, "PPP", { locale: ja })
                                  : "日付を選択"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={selectedFile.result.invoice.dueDate}
                                onSelect={(date) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                dueDate: date,
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              dueDate: date,
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </CardContent>
                    </Card>

                    {/* B. 発行者情報セクション */}
                    <Collapsible defaultOpen={!!selectedFile.result.invoice.issuerInfo}>
                      <Card>
                        <CardHeader>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer">
                              <CardTitle className="text-base">発行者情報</CardTitle>
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            </div>
                          </CollapsibleTrigger>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent className="space-y-3">
                            <div>
                              <Label htmlFor="issuerName">発行者名 *</Label>
                              <Input
                                id="issuerName"
                                value={selectedFile.result.invoice.issuerInfo?.name || ""}
                                onChange={(e) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                issuerInfo: {
                                                  name: e.target.value,
                                                  address: f.result!.invoice.issuerInfo?.address || '',
                                                  phone: f.result!.invoice.issuerInfo?.phone || '',
                                                  email: f.result!.invoice.issuerInfo?.email || '',
                                                  registrationNumber: f.result!.invoice.issuerInfo?.registrationNumber || '',
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              issuerInfo: {
                                                name: e.target.value,
                                                address: prev.result!.invoice.issuerInfo?.address || '',
                                                phone: prev.result!.invoice.issuerInfo?.phone || '',
                                                email: prev.result!.invoice.issuerInfo?.email || '',
                                                registrationNumber: prev.result!.invoice.issuerInfo?.registrationNumber || '',
                                              },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                                className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="issuerAddress">住所</Label>
                              <Textarea
                                id="issuerAddress"
                                value={selectedFile.result.invoice.issuerInfo?.address || ""}
                                onChange={(e) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                issuerInfo: {
                                                  name: f.result!.invoice.issuerInfo?.name || '',
                                                  address: e.target.value,
                                                  phone: f.result!.invoice.issuerInfo?.phone || '',
                                                  email: f.result!.invoice.issuerInfo?.email || '',
                                                  registrationNumber: f.result!.invoice.issuerInfo?.registrationNumber || '',
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              issuerInfo: {
                                                name: prev.result!.invoice.issuerInfo?.name || '',
                                                address: e.target.value,
                                                phone: prev.result!.invoice.issuerInfo?.phone || '',
                                                email: prev.result!.invoice.issuerInfo?.email || '',
                                                registrationNumber: prev.result!.invoice.issuerInfo?.registrationNumber || '',
                                              },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                                rows={2}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="issuerPhone">電話番号</Label>
                                <Input
                                  id="issuerPhone"
                                  value={selectedFile.result.invoice.issuerInfo?.phone || ""}
                                  onChange={(e) => {
                                    setImportedFiles((prev) =>
                                      prev.map((f) =>
                                        f.file === selectedFile.file
                                          ? {
                                              ...f,
                                              result: {
                                                ...f.result!,
                                                invoice: {
                                                  ...f.result!.invoice,
                                                  issuerInfo: {
                                                    name: f.result!.invoice.issuerInfo?.name || '',
                                                    address: f.result!.invoice.issuerInfo?.address || '',
                                                    phone: e.target.value,
                                                    email: f.result!.invoice.issuerInfo?.email || '',
                                                    registrationNumber: f.result!.invoice.issuerInfo?.registrationNumber || '',
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
                                    )
                                    setSelectedFile(prev =>
                                      prev && prev.file === selectedFile.file
                                        ? {
                                            ...prev,
                                            result: {
                                              ...prev.result!,
                                              invoice: {
                                                ...prev.result!.invoice,
                                                issuerInfo: {
                                                  name: prev.result!.invoice.issuerInfo?.name || '',
                                                  address: prev.result!.invoice.issuerInfo?.address || '',
                                                  phone: e.target.value,
                                                  email: prev.result!.invoice.issuerInfo?.email || '',
                                                  registrationNumber: prev.result!.invoice.issuerInfo?.registrationNumber || '',
                                                },
                                              },
                                            },
                                          }
                                        : prev
                                    )
                                  }}
                                />
                              </div>
                              <div>
                                <Label htmlFor="issuerEmail">メールアドレス</Label>
                                <Input
                                  id="issuerEmail"
                                  type="email"
                                  value={selectedFile.result.invoice.issuerInfo?.email || ""}
                                  onChange={(e) => {
                                    setImportedFiles((prev) =>
                                      prev.map((f) =>
                                        f.file === selectedFile.file
                                          ? {
                                              ...f,
                                              result: {
                                                ...f.result!,
                                                invoice: {
                                                  ...f.result!.invoice,
                                                  issuerInfo: {
                                                    name: f.result!.invoice.issuerInfo?.name || '',
                                                    address: f.result!.invoice.issuerInfo?.address || '',
                                                    phone: f.result!.invoice.issuerInfo?.phone || '',
                                                    email: e.target.value,
                                                    registrationNumber: f.result!.invoice.issuerInfo?.registrationNumber || '',
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
                                    )
                                    setSelectedFile(prev =>
                                      prev && prev.file === selectedFile.file
                                        ? {
                                            ...prev,
                                            result: {
                                              ...prev.result!,
                                              invoice: {
                                                ...prev.result!.invoice,
                                                issuerInfo: {
                                                  name: prev.result!.invoice.issuerInfo?.name || '',
                                                  address: prev.result!.invoice.issuerInfo?.address || '',
                                                  phone: prev.result!.invoice.issuerInfo?.phone || '',
                                                  email: e.target.value,
                                                  registrationNumber: prev.result!.invoice.issuerInfo?.registrationNumber || '',
                                                },
                                              },
                                            },
                                          }
                                        : prev
                                    )
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="registrationNumber">登録番号（インボイス番号）</Label>
                              <Input
                                id="registrationNumber"
                                placeholder="T1234567890123"
                                value={selectedFile.result.invoice.issuerInfo?.registrationNumber || ""}
                                onChange={(e) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                issuerInfo: {
                                                  name: f.result!.invoice.issuerInfo?.name || '',
                                                  address: f.result!.invoice.issuerInfo?.address || '',
                                                  phone: f.result!.invoice.issuerInfo?.phone || '',
                                                  email: f.result!.invoice.issuerInfo?.email || '',
                                                  registrationNumber: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              issuerInfo: {
                                                name: prev.result!.invoice.issuerInfo?.name || '',
                                                address: prev.result!.invoice.issuerInfo?.address || '',
                                                phone: prev.result!.invoice.issuerInfo?.phone || '',
                                                email: prev.result!.invoice.issuerInfo?.email || '',
                                                registrationNumber: e.target.value,
                                              },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                              />
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* C. 請求先情報セクション */}
                    <Collapsible defaultOpen>
                      <Card>
                        <CardHeader>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer">
                              <CardTitle className="text-base">請求先情報</CardTitle>
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            </div>
                          </CollapsibleTrigger>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent className="space-y-3">
                            <div>
                              <Label htmlFor="clientName">会社名 *</Label>
                              <Input
                                id="clientName"
                                value={selectedFile.result.invoice.client?.name || ""}
                                onChange={(e) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                client: {
                                                  ...f.result!.invoice.client!,
                                                  name: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              client: {
                                                ...prev.result!.invoice.client!,
                                                name: e.target.value,
                                              },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                                className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="clientAddress">住所</Label>
                              <Textarea
                                id="clientAddress"
                                value={selectedFile.result.invoice.client?.address || ""}
                                onChange={(e) => {
                                  setImportedFiles((prev) =>
                                    prev.map((f) =>
                                      f.file === selectedFile.file
                                        ? {
                                            ...f,
                                            result: {
                                              ...f.result!,
                                              invoice: {
                                                ...f.result!.invoice,
                                                client: {
                                                  ...f.result!.invoice.client!,
                                                  address: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                  setSelectedFile(prev =>
                                    prev && prev.file === selectedFile.file
                                      ? {
                                          ...prev,
                                          result: {
                                            ...prev.result!,
                                            invoice: {
                                              ...prev.result!.invoice,
                                              client: {
                                                ...prev.result!.invoice.client!,
                                                address: e.target.value,
                                              },
                                            },
                                          },
                                        }
                                      : prev
                                  )
                                }}
                                rows={2}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="contactPerson">担当者名</Label>
                                <Input
                                  id="contactPerson"
                                  value={selectedFile.result.invoice.client?.contactPerson || ""}
                                  onChange={(e) => {
                                    setImportedFiles((prev) =>
                                      prev.map((f) =>
                                        f.file === selectedFile.file
                                          ? {
                                              ...f,
                                              result: {
                                                ...f.result!,
                                                invoice: {
                                                  ...f.result!.invoice,
                                                  client: {
                                                    ...f.result!.invoice.client!,
                                                    contactPerson: e.target.value,
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
                                    )
                                    setSelectedFile(prev =>
                                      prev && prev.file === selectedFile.file
                                        ? {
                                            ...prev,
                                            result: {
                                              ...prev.result!,
                                              invoice: {
                                                ...prev.result!.invoice,
                                                client: {
                                                  ...prev.result!.invoice.client!,
                                                  contactPerson: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : prev
                                    )
                                  }}
                                />
                              </div>
                              <div>
                                <Label htmlFor="clientPhone">電話番号</Label>
                                <Input
                                  id="clientPhone"
                                  value={selectedFile.result.invoice.client?.phone || ""}
                                  onChange={(e) => {
                                    setImportedFiles((prev) =>
                                      prev.map((f) =>
                                        f.file === selectedFile.file
                                          ? {
                                              ...f,
                                              result: {
                                                ...f.result!,
                                                invoice: {
                                                  ...f.result!.invoice,
                                                  client: {
                                                    ...f.result!.invoice.client!,
                                                    phone: e.target.value,
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
                                    )
                                    setSelectedFile(prev =>
                                      prev && prev.file === selectedFile.file
                                        ? {
                                            ...prev,
                                            result: {
                                              ...prev.result!,
                                              invoice: {
                                                ...prev.result!.invoice,
                                                client: {
                                                  ...prev.result!.invoice.client!,
                                                  phone: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : prev
                                    )
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* D. 金額情報セクション */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">金額情報</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="subtotal">小計</Label>
                            <Input
                              id="subtotal"
                              type="number"
                              value={selectedFile.result.invoice.subtotal || 0}
                              onChange={(e) => {
                                const subtotal = Number(e.target.value)
                                const taxRate = selectedFile.result!.invoice.taxRate || 10
                                const tax = Math.round(subtotal * (taxRate / 100))
                                const total = subtotal + tax
                                setImportedFiles((prev) =>
                                  prev.map((f) =>
                                    f.file === selectedFile.file
                                      ? {
                                          ...f,
                                          result: {
                                            ...f.result!,
                                            invoice: {
                                              ...f.result!.invoice,
                                              subtotal,
                                              tax,
                                              total,
                                            },
                                          },
                                        }
                                      : f
                                  )
                                )
                                setSelectedFile(prev =>
                                  prev && prev.file === selectedFile.file
                                    ? {
                                        ...prev,
                                        result: {
                                          ...prev.result!,
                                          invoice: {
                                            ...prev.result!.invoice,
                                            subtotal,
                                            tax,
                                            total,
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }}
                              className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}
                            />
                          </div>
                          <div>
                            <Label htmlFor="taxRate">税率 (%)</Label>
                            <Input
                              id="taxRate"
                              type="number"
                              step="0.01"
                              value={selectedFile.result.invoice.taxRate ?? 10}
                              onChange={(e) => {
                                const taxRate = Number(e.target.value)
                                const subtotal = selectedFile.result!.invoice.subtotal || 0
                                const tax = Math.round(subtotal * (taxRate / 100))
                                const total = subtotal + tax
                                setImportedFiles((prev) =>
                                  prev.map((f) =>
                                    f.file === selectedFile.file
                                      ? {
                                          ...f,
                                          result: {
                                            ...f.result!,
                                            invoice: {
                                              ...f.result!.invoice,
                                              taxRate,
                                              tax,
                                              total,
                                            },
                                          },
                                        }
                                      : f
                                  )
                                )
                                setSelectedFile(prev =>
                                  prev && prev.file === selectedFile.file
                                    ? {
                                        ...prev,
                                        result: {
                                          ...prev.result!,
                                          invoice: {
                                            ...prev.result!.invoice,
                                            taxRate,
                                            tax,
                                            total,
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="tax">税額</Label>
                            <Input
                              id="tax"
                              type="number"
                              value={selectedFile.result.invoice.tax || 0}
                              onChange={(e) => {
                                const tax = Number(e.target.value)
                                const subtotal = selectedFile.result!.invoice.subtotal || 0
                                const total = subtotal + tax
                                setImportedFiles((prev) =>
                                  prev.map((f) =>
                                    f.file === selectedFile.file
                                      ? {
                                          ...f,
                                          result: {
                                            ...f.result!,
                                            invoice: {
                                              ...f.result!.invoice,
                                              tax,
                                              total,
                                            },
                                          },
                                        }
                                      : f
                                  )
                                )
                                setSelectedFile(prev =>
                                  prev && prev.file === selectedFile.file
                                    ? {
                                        ...prev,
                                        result: {
                                          ...prev.result!,
                                          invoice: {
                                            ...prev.result!.invoice,
                                            tax,
                                            total,
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }}
                              className={(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}
                            />
                          </div>
                          <div>
                            <Label htmlFor="total">合計金額 *</Label>
                            <Input
                              id="total"
                              type="number"
                              value={selectedFile.result.invoice.total || 0}
                              onChange={(e) => {
                                const total = Number(e.target.value)
                                setImportedFiles((prev) =>
                                  prev.map((f) =>
                                    f.file === selectedFile.file
                                      ? {
                                          ...f,
                                          result: {
                                            ...f.result!,
                                            invoice: {
                                              ...f.result!.invoice,
                                              total,
                                            },
                                          },
                                        }
                                      : f
                                  )
                                )
                                setSelectedFile(prev =>
                                  prev && prev.file === selectedFile.file
                                    ? {
                                        ...prev,
                                        result: {
                                          ...prev.result!,
                                          invoice: {
                                            ...prev.result!.invoice,
                                            total,
                                          },
                                        },
                                      }
                                    : prev
                                )
                              }}
                              className={`font-bold text-lg ${(selectedFile.ocrConfidence ?? 0) < 0.7 ? "bg-yellow-50" : ""}`}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

{/* E. 支払条件セクション */}
<Collapsible>
  <Card>
    <CardHeader>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between cursor-pointer">
          <CardTitle className="text-base">支払条件</CardTitle>
          <ChevronDown className="h-4 w-4 transition-transform" />
        </div>
      </CollapsibleTrigger>
    </CardHeader>
    <CollapsibleContent>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bankName">銀行名</Label>
            <Input
              id="bankName"
              value={selectedFile.result.invoice.paymentInfo?.bankName || ""}
              onChange={(e) => {
                setImportedFiles((prev) =>
                  prev.map((f) =>
                    f.file === selectedFile.file
                      ? {
                          ...f,
                          result: {
                            ...f.result!,
                            invoice: {
                              ...f.result!.invoice,
                              paymentInfo: {
                                ...f.result!.invoice.paymentInfo,
                                bankName: e.target.value,
                              },
                            },
                          },
                        }
                      : f
                  )
                )
                setSelectedFile(prev =>
                  prev && prev.file === selectedFile.file
                    ? {
                        ...prev,
                        result: {
                          ...prev.result!,
                          invoice: {
                            ...prev.result!.invoice,
                            paymentInfo: {
                              ...prev.result!.invoice.paymentInfo,
                              bankName: e.target.value,
                            },
                          },
                        },
                      }
                    : prev
                )
              }}
            />
          </div>
          <div>
            <Label htmlFor="branchName">支店名</Label>
            <Input
              id="branchName"
              value={selectedFile.result.invoice.paymentInfo?.branchName || ""}
              onChange={(e) => {
                setImportedFiles((prev) =>
                  prev.map((f) =>
                    f.file === selectedFile.file
                      ? {
                          ...f,
                          result: {
                            ...f.result!,
                            invoice: {
                              ...f.result!.invoice,
                              paymentInfo: {
                                ...f.result!.invoice.paymentInfo,
                                branchName: e.target.value,
                              },
                            },
                          },
                        }
                      : f
                  )
                )
                setSelectedFile(prev =>
                  prev && prev.file === selectedFile.file
                    ? {
                        ...prev,
                        result: {
                          ...prev.result!,
                          invoice: {
                            ...prev.result!.invoice,
                            paymentInfo: {
                              ...prev.result!.invoice.paymentInfo,
                              branchName: e.target.value,
                            },
                          },
                        },
                      }
                    : prev
                )
              }}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="accountType">口座種別</Label>
            <Input
              id="accountType"
              placeholder="普通預金"
              value={selectedFile.result.invoice.paymentInfo?.accountType || ""}
              onChange={(e) => {
                setImportedFiles((prev) =>
                  prev.map((f) =>
                    f.file === selectedFile.file
                      ? {
                          ...f,
                          result: {
                            ...f.result!,
                            invoice: {
                              ...f.result!.invoice,
                              paymentInfo: {
                                ...f.result!.invoice.paymentInfo,
                                accountType: e.target.value,
                              },
                            },
                          },
                        }
                      : f
                  )
                )
                setSelectedFile(prev =>
                  prev && prev.file === selectedFile.file
                    ? {
                        ...prev,
                        result: {
                          ...prev.result!,
                          invoice: {
                            ...prev.result!.invoice,
                            paymentInfo: {
                              ...prev.result!.invoice.paymentInfo,
                              accountType: e.target.value,
                            },
                          },
                        },
                      }
                    : prev
                )
              }}
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">口座番号</Label>
            <Input
              id="accountNumber"
              value={selectedFile.result.invoice.paymentInfo?.accountNumber || ""}
              onChange={(e) => {
                setImportedFiles((prev) =>
                  prev.map((f) =>
                    f.file === selectedFile.file
                      ? {
                          ...f,
                          result: {
                            ...f.result!,
                            invoice: {
                              ...f.result!.invoice,
                              paymentInfo: {
                                ...f.result!.invoice.paymentInfo,
                                accountNumber: e.target.value,
                              },
                            },
                          },
                        }
                      : f
                  )
                )
                setSelectedFile(prev =>
                  prev && prev.file === selectedFile.file
                    ? {
                        ...prev,
                        result: {
                          ...prev.result!,
                          invoice: {
                            ...prev.result!.invoice,
                            paymentInfo: {
                              ...prev.result!.invoice.paymentInfo,
                              accountNumber: e.target.value,
                            },
                          },
                        },
                      }
                    : prev
                )
              }}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="accountHolder">口座名義</Label>
          <Input
            id="accountHolder"
            value={selectedFile.result.invoice.paymentInfo?.accountHolder || ""}
            onChange={(e) => {
              setImportedFiles((prev) =>
                prev.map((f) =>
                  f.file === selectedFile.file
                    ? {
                        ...f,
                        result: {
                          ...f.result!,
                          invoice: {
                            ...f.result!.invoice,
                            paymentInfo: {
                              ...f.result!.invoice.paymentInfo,
                              accountHolder: e.target.value,
                            },
                          },
                        },
                      }
                    : f
                )
              )
              setSelectedFile(prev =>
                prev && prev.file === selectedFile.file
                  ? {
                      ...prev,
                      result: {
                        ...prev.result!,
                        invoice: {
                          ...prev.result!.invoice,
                          paymentInfo: {
                            ...prev.result!.invoice.paymentInfo,
                            accountHolder: e.target.value,
                          },
                        },
                      },
                    }
                  : prev
              )
            }}
          />
        </div>
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>

                    {/* F. 明細行セクション */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">明細行</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItem = {
                                id: `item-${Date.now()}`,
                                description: "",
                                quantity: 1,
                                unitPrice: 0,
                                amount: 0,
                              }
                              setImportedFiles((prev) =>
                                prev.map((f) =>
                                  f.file === selectedFile.file
                                    ? {
                                        ...f,
                                        result: {
                                          ...f.result!,
                                          invoice: {
                                            ...f.result!.invoice,
                                            lineItems: [...(f.result!.invoice.lineItems || []), newItem],
                                          },
                                        },
                                      }
                                    : f
                                )
                              )
                              setSelectedFile(prev =>
                                prev && prev.file === selectedFile.file
                                  ? {
                                      ...prev,
                                      result: {
                                        ...prev.result!,
                                        invoice: {
                                          ...prev.result!.invoice,
                                          lineItems: [...(prev.result!.invoice.lineItems || []), newItem],
                                        },
                                      },
                                    }
                                  : prev
                              )
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            明細を追加
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {selectedFile.result.invoice.lineItems && selectedFile.result.invoice.lineItems.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40%]">品名</TableHead>
                                  <TableHead className="w-[15%]">数量</TableHead>
                                  <TableHead className="w-[20%]">単価</TableHead>
                                  <TableHead className="w-[20%]">合計</TableHead>
                                  <TableHead className="w-[5%]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedFile.result.invoice.lineItems.map((item, index) => (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <Input
                                        value={item.description}
                                        onChange={(e) => {
                                          const updatedItems = [...(selectedFile.result!.invoice.lineItems || [])]
                                          updatedItems[index] = {
                                            ...updatedItems[index],
                                            description: e.target.value,
                                          }
                                          setImportedFiles((prev) =>
                                            prev.map((f) =>
                                              f.file === selectedFile.file
                                                ? {
                                                    ...f,
                                                    result: {
                                                      ...f.result!,
                                                      invoice: {
                                                        ...f.result!.invoice,
                                                        lineItems: updatedItems,
                                                      },
                                                    },
                                                  }
                                                : f
                                            )
                                          )
                                          setSelectedFile(prev =>
                                            prev && prev.file === selectedFile.file
                                              ? {
                                                  ...prev,
                                                  result: {
                                                    ...prev.result!,
                                                    invoice: {
                                                      ...prev.result!.invoice,
                                                      lineItems: updatedItems,
                                                    },
                                                  },
                                                }
                                              : prev
                                          )
                                        }}
                                        placeholder="品名を入力"
                                        className="h-8"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const quantity = Number(e.target.value)
                                          const unitPrice = item.unitPrice || 0
                                          const amount = quantity * unitPrice
                                          const updatedItems = [...(selectedFile.result!.invoice.lineItems || [])]
                                          updatedItems[index] = {
                                            ...updatedItems[index],
                                            quantity,
                                            amount,
                                          }
                                          setImportedFiles((prev) =>
                                            prev.map((f) =>
                                              f.file === selectedFile.file
                                                ? {
                                                    ...f,
                                                    result: {
                                                      ...f.result!,
                                                      invoice: {
                                                        ...f.result!.invoice,
                                                        lineItems: updatedItems,
                                                      },
                                                    },
                                                  }
                                                : f
                                            )
                                          )
                                          setSelectedFile(prev =>
                                            prev && prev.file === selectedFile.file
                                              ? {
                                                  ...prev,
                                                  result: {
                                                    ...prev.result!,
                                                    invoice: {
                                                      ...prev.result!.invoice,
                                                      lineItems: updatedItems,
                                                    },
                                                  },
                                                }
                                              : prev
                                          )
                                        }}
                                        className="h-8"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => {
                                          const unitPrice = Number(e.target.value)
                                          const quantity = item.quantity || 1
                                          const amount = quantity * unitPrice
                                          const updatedItems = [...(selectedFile.result!.invoice.lineItems || [])]
                                          updatedItems[index] = {
                                            ...updatedItems[index],
                                            unitPrice,
                                            amount,
                                          }
                                          setImportedFiles((prev) =>
                                            prev.map((f) =>
                                              f.file === selectedFile.file
                                                ? {
                                                    ...f,
                                                    result: {
                                                      ...f.result!,
                                                      invoice: {
                                                        ...f.result!.invoice,
                                                        lineItems: updatedItems,
                                                      },
                                                    },
                                                  }
                                                : f
                                            )
                                          )
                                          setSelectedFile(prev =>
                                            prev && prev.file === selectedFile.file
                                              ? {
                                                  ...prev,
                                                  result: {
                                                    ...prev.result!,
                                                    invoice: {
                                                      ...prev.result!.invoice,
                                                      lineItems: updatedItems,
                                                    },
                                                  },
                                                }
                                              : prev
                                          )
                                        }}
                                        className="h-8"
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {item.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const updatedItems = (selectedFile.result!.invoice.lineItems || []).filter((_, i) => i !== index)
                                          setImportedFiles((prev) =>
                                            prev.map((f) =>
                                              f.file === selectedFile.file
                                                ? {
                                                    ...f,
                                                    result: {
                                                      ...f.result!,
                                                      invoice: {
                                                        ...f.result!.invoice,
                                                        lineItems: updatedItems,
                                                      },
                                                    },
                                                  }
                                                : f
                                            )
                                          )
                                          setSelectedFile(prev =>
                                            prev && prev.file === selectedFile.file
                                              ? {
                                                  ...prev,
                                                  result: {
                                                    ...prev.result!,
                                                    invoice: {
                                                      ...prev.result!.invoice,
                                                      lineItems: updatedItems,
                                                    },
                                                  },
                                                }
                                              : prev
                                          )
                                        }}
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                            <p className="mb-2">明細行がありません</p>
                            <p className="text-sm">「明細を追加」ボタンから追加してください</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* G. メモ・備考欄 */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">メモ・備考</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={selectedFile.result.invoice.notes || ""}
                          onChange={(e) => {
                            setImportedFiles((prev) =>
                              prev.map((f) =>
                                f.file === selectedFile.file
                                  ? {
                                      ...f,
                                      result: {
                                        ...f.result!,
                                        invoice: {
                                          ...f.result!.invoice,
                                          notes: e.target.value,
                                        },
                                      },
                                    }
                                  : f
                              )
                            )
                            setSelectedFile(prev =>
                              prev && prev.file === selectedFile.file
                                ? {
                                    ...prev,
                                    result: {
                                      ...prev.result!,
                                      invoice: {
                                        ...prev.result!.invoice,
                                        notes: e.target.value,
                                      },
                                    },
                                  }
                                : prev
                            )
                          }}
                          placeholder="備考やメモを入力してください"
                          rows={3}
                        />
                      </CardContent>
                    </Card>

                    {/* インポートボタン */}
                    <Button
                      onClick={async () => {
                        try {
                          await confirmImport(selectedFile);
                          toast({
                            title: "保存完了",
                            description: "請求書が一覧と支払管理に追加されました!",
                          });
                          removeFile(selectedFile.file);
                        } catch (error) {
                          toast({
                            title: "保存エラー",
                            description: error instanceof Error ? error.message : "エラーが発生しました",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="w-full"
                      size="lg"
                    >
                      この内容でインポート
                    </Button>
                  </div>
                )}

                {/* エラー表示 */}
                {selectedFile.status === "error" && (
                  <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                    <p className="text-destructive font-medium mb-2">エラーが発生しました</p>
                    <p className="text-sm text-muted-foreground">{selectedFile.error}</p>
                  </div>
                )}

                {/* 処理中 */}
                {(selectedFile.status === "uploading" ||
                  selectedFile.status === "converting" ||
                  selectedFile.status === "ocr_processing" ||
                  selectedFile.status === "extracting") && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary mb-4" size={48} />
                    <p className="text-foreground font-medium">
                      {getStatusText(selectedFile.status, selectedFile.currentStep)}
                    </p>
                    {selectedFile.progress !== undefined && (
                      <div className="w-full max-w-xs mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">進捗</span>
                          <span className="text-xs font-semibold text-primary">{selectedFile.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${selectedFile.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-4">しばらくお待ちください...</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                ファイルを選択してください
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
