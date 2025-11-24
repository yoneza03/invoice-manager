"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Image as ImageIcon, X, Loader2, CheckCircle, AlertCircle, Plus, Trash2, Calendar as CalendarIcon, ChevronDown } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ja } from "date-fns/locale"

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
  result?: {
    invoice: Partial<Invoice>
    ocrData: OCRResult
  }
}

export default function InvoiceImport() {
  const { clients, addInvoice, addClient } = useStore()
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<ImportedFile | null>(null)
  const [extractedData, setExtractedData] = useState<InvoiceData | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<number>(0)
  const [hasShownToast, setHasShownToast] = useState<boolean>(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // ファイルを追加
    const newFiles: ImportedFile[] = acceptedFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      status: "idle" as ProcessingStatus,
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
        
        // ステート変数に保存
        setExtractedData(invoiceData)
        setOcrConfidence(confidence)
        
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

      // ステップ5: 完了
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
              }
            : f
        )
      )
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

  // OCR抽出完了時のトースト通知（重複防止付き）
  useEffect(() => {
    if (extractedData && ocrConfidence > 0 && !hasShownToast) {
      const confidencePercent = Math.round(ocrConfidence * 100)
      
      toast({
        title: "OCR抽出が完了しました",
        description: `信頼度: ${confidencePercent}%`,
        variant: confidencePercent < 70 ? "destructive" : "default",
      })
      
      setHasShownToast(true)
    }
  }, [extractedData, ocrConfidence, hasShownToast])

  // extractedDataをフォームに自動入力
  useEffect(() => {
    if (extractedData && selectedFile && selectedFile.result) {
      // 開発環境でのみデバッグログを出力
      if (process.env.NODE_ENV === 'development') {
        console.log('抽出されたデータ:', extractedData)
        console.log('OCR信頼度:', ocrConfidence)
      }
      
      console.log('[Auto-Fill] extractedDataをフォームに自動入力開始', extractedData)
      
      // InvoiceDataからPartial<Invoice>への変換とマッピング
      const updatedInvoice: Partial<Invoice> = {
        ...selectedFile.result.invoice,
      }

      // 基本情報の自動入力
      if (extractedData.basicInfo) {
        if (extractedData.basicInfo.invoiceNumber) {
          updatedInvoice.invoiceNumber = extractedData.basicInfo.invoiceNumber
        }
        if (extractedData.basicInfo.issueDate) {
          updatedInvoice.issueDate = new Date(extractedData.basicInfo.issueDate)
        }
      }

      // 請求先情報の自動入力
      if (extractedData.billingTo && updatedInvoice.client) {
        updatedInvoice.client = {
          ...updatedInvoice.client,
          name: extractedData.billingTo.companyName,
        }
      }

      // 金額情報の自動入力
      if (extractedData.amountInfo) {
        updatedInvoice.subtotal = extractedData.amountInfo.subtotal
        updatedInvoice.tax = extractedData.amountInfo.taxAmount
        updatedInvoice.total = extractedData.amountInfo.totalAmount
        
        // 税率を計算（taxBreakdownから取得、なければ計算）
        if (extractedData.amountInfo.taxBreakdown.length > 0) {
          updatedInvoice.taxRate = extractedData.amountInfo.taxBreakdown[0].rate
        } else if (extractedData.amountInfo.subtotal > 0) {
          updatedInvoice.taxRate = (extractedData.amountInfo.taxAmount / extractedData.amountInfo.subtotal) * 100
        }
      }

      // 発行者情報の自動入力
      if (extractedData.issuerInfo) {
        updatedInvoice.issuerInfo = {
          name: extractedData.issuerInfo.name,
          address: extractedData.issuerInfo.address,
          phone: extractedData.issuerInfo.phone,
          email: extractedData.issuerInfo.email,
          registrationNumber: extractedData.issuerInfo.registrationNumber,
        }
      }

      // 支払条件の自動入力
      if (extractedData.paymentTerms) {
        if (extractedData.paymentTerms.dueDate) {
          updatedInvoice.dueDate = new Date(extractedData.paymentTerms.dueDate)
        }
        
        updatedInvoice.paymentInfo = {
          bankName: extractedData.paymentTerms.bankName || undefined,
          branchName: extractedData.paymentTerms.branchName || undefined,
          accountType: extractedData.paymentTerms.accountType || undefined,
          accountNumber: extractedData.paymentTerms.accountNumber || undefined,
          accountHolder: extractedData.paymentTerms.accountHolder || undefined,
        }
      }

      // 明細行の自動入力
      if (extractedData.lineItems && extractedData.lineItems.length > 0) {
        updatedInvoice.lineItems = extractedData.lineItems.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || item.amount,
          amount: item.amount,
        }))
      }

      // メタデータ情報の反映
      if (extractedData.metadata) {
        updatedInvoice.source = extractedData.metadata.source
        updatedInvoice.status = extractedData.metadata.status
        if (extractedData.metadata.notes) {
          updatedInvoice.notes = extractedData.metadata.notes
        }
        if (extractedData.metadata.paidDate) {
          updatedInvoice.paidDate = new Date(extractedData.metadata.paidDate)
        }
      }

      // ファイルの結果を更新
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === selectedFile.file
            ? {
                ...f,
                result: {
                  ...f.result!,
                  invoice: updatedInvoice,
                },
              }
            : f
        )
      )

      // selectedFileも更新（UIに即座に反映）
      setSelectedFile(prev =>
        prev && prev.file === selectedFile.file
          ? {
              ...prev,
              result: {
                ...prev.result!,
                invoice: updatedInvoice,
              },
            }
          : prev
      )

      console.log('[Auto-Fill] フォームへの自動入力完了', updatedInvoice)
    }
  }, [extractedData, selectedFile?.file])

  const removeFile = (file: File) => {
    setImportedFiles((prev) => prev.filter((f) => f.file !== file))
    if (selectedFile?.file === file) {
      setSelectedFile(null)
      // ファイル削除時にトーストフラグをリセット
      setHasShownToast(false)
      setExtractedData(null)
      setOcrConfidence(0)
    }
  }

  const confirmImport = (importedFile: ImportedFile) => {
    if (!importedFile.result) return

    const { invoice } = importedFile.result

    // 新規顧客の場合は追加
    if (invoice.client && !clients.find((c) => c.id === invoice.client!.id)) {
      addClient(invoice.client)
    }

    // 請求書を追加
    addInvoice(invoice as Invoice)

    // ファイルを削除
    removeFile(importedFile.file)

    alert("請求書をインポートしました!")
  }

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
          対応形式: PDF, JPEG, PNG（最大10MB）
        </p>
      </div>

      {/* ファイルリスト */}
      {importedFiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ファイル一覧 */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">アップロードファイル</h2>
            <div className="space-y-3">
              {importedFiles.map((importedFile, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFile?.file === importedFile.file
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
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
                    <Card className={ocrConfidence < 0.7 ? "border-yellow-500 bg-yellow-50/50" : ""}>
                      <CardContent className="pt-4">
                        <Label className="text-sm font-medium">OCR信頼度</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                ocrConfidence >= 0.7 ? "bg-green-500" : "bg-yellow-500"
                              }`}
                              style={{
                                width: `${(selectedFile.result.ocrData.confidence * 100).toFixed(0)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {(selectedFile.result.ocrData.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        {ocrConfidence < 0.7 && (
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
                              }}
                              className={ocrConfidence < 0.7 ? "bg-yellow-50" : ""}
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
                                  }}
                                  initialFocus
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
                                }}
                                initialFocus
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
                                                  ...f.result!.invoice.issuerInfo,
                                                  name: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
                                  )
                                }}
                                className={ocrConfidence < 0.7 ? "bg-yellow-50" : ""}
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
                                                  ...f.result!.invoice.issuerInfo,
                                                  address: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
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
                                                    ...f.result!.invoice.issuerInfo,
                                                    phone: e.target.value,
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
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
                                                    ...f.result!.invoice.issuerInfo,
                                                    email: e.target.value,
                                                  },
                                                },
                                              },
                                            }
                                          : f
                                      )
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
                                                  ...f.result!.invoice.issuerInfo,
                                                  registrationNumber: e.target.value,
                                                },
                                              },
                                            },
                                          }
                                        : f
                                    )
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
                                }}
                                className={ocrConfidence < 0.7 ? "bg-yellow-50" : ""}
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
                              }}
                              className={ocrConfidence < 0.7 ? "bg-yellow-50" : ""}
                            />
                          </div>
                          <div>
                            <Label htmlFor="taxRate">税率 (%)</Label>
                            <Input
                              id="taxRate"
                              type="number"
                              step="0.01"
                              value={selectedFile.result.invoice.taxRate || 10}
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
                              }}
                              className={ocrConfidence < 0.7 ? "bg-yellow-50" : ""}
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
                              }}
                              className={`font-bold text-lg ${ocrConfidence < 0.7 ? "bg-yellow-50" : ""}`}
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
                                }}
                              />
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

                    {/* F. 明細行セクション */}
                    <Collapsible defaultOpen={selectedFile.result.invoice.lineItems && selectedFile.result.invoice.lineItems.length > 0}>
                      <Card>
                        <CardHeader>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer">
                              <CardTitle className="text-base">明細行</CardTitle>
                              <ChevronDown className="h-4 w-4 transition-transform" />
                            </div>
                          </CollapsibleTrigger>
                        </CardHeader>
                        <CollapsibleContent>
                          <CardContent>
                            <div className="space-y-3">
                              {selectedFile.result.invoice.lineItems && selectedFile.result.invoice.lineItems.length > 0 ? (
                                <>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>品名</TableHead>
                                        <TableHead className="w-20">数量</TableHead>
                                        <TableHead className="w-24">単価</TableHead>
                                        <TableHead className="w-24">金額</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {selectedFile.result.invoice.lineItems.map((item, index) => (
                                        <TableRow key={item.id}>
                                          <TableCell>
                                            <Input
                                              value={item.description}
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
                                                              lineItems: f.result!.invoice.lineItems?.map((li, i) =>
                                                                i === index ? { ...li, description: e.target.value } : li
                                                              ),
                                                            },
                                                          },
                                                        }
                                                      : f
                                                  )
                                                )
                                              }}
                                              className="h-8"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              value={item.quantity}
                                              onChange={(e) => {
                                                const quantity = Number(e.target.value)
                                                const amount = quantity * item.unitPrice
                                                setImportedFiles((prev) =>
                                                  prev.map((f) =>
                                                    f.file === selectedFile.file
                                                      ? {
                                                          ...f,
                                                          result: {
                                                            ...f.result!,
                                                            invoice: {
                                                              ...f.result!.invoice,
                                                              lineItems: f.result!.invoice.lineItems?.map((li, i) =>
                                                                i === index ? { ...li, quantity, amount } : li
                                                              ),
                                                            },
                                                          },
                                                        }
                                                      : f
                                                  )
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
                                                const amount = item.quantity * unitPrice
                                                setImportedFiles((prev) =>
                                                  prev.map((f) =>
                                                    f.file === selectedFile.file
                                                      ? {
                                                          ...f,
                                                          result: {
                                                            ...f.result!,
                                                            invoice: {
                                                              ...f.result!.invoice,
                                                              lineItems: f.result!.invoice.lineItems?.map((li, i) =>
                                                                i === index ? { ...li, unitPrice, amount } : li
                                                              ),
                                                            },
                                                          },
                                                        }
                                                      : f
                                                  )
                                                )
                                              }}
                                              className="h-8"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              value={item.amount}
                                              onChange={(e) => {
                                                const amount = Number(e.target.value)
                                                setImportedFiles((prev) =>
                                                  prev.map((f) =>
                                                    f.file === selectedFile.file
                                                      ? {
                                                          ...f,
                                                          result: {
                                                            ...f.result!,
                                                            invoice: {
                                                              ...f.result!.invoice,
                                                              lineItems: f.result!.invoice.lineItems?.map((li, i) =>
                                                                i === index ? { ...li, amount } : li
                                                              ),
                                                            },
                                                          },
                                                        }
                                                      : f
                                                  )
                                                )
                                              }}
                                              className="h-8 font-medium"
                                              readOnly
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={() => {
                                                setImportedFiles((prev) =>
                                                  prev.map((f) =>
                                                    f.file === selectedFile.file
                                                      ? {
                                                          ...f,
                                                          result: {
                                                            ...f.result!,
                                                            invoice: {
                                                              ...f.result!.invoice,
                                                              lineItems: f.result!.invoice.lineItems?.filter((_, i) => i !== index),
                                                            },
                                                          },
                                                        }
                                                      : f
                                                  )
                                                )
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
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
                                    }}
                                    className="w-full"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    明細を追加
                                  </Button>
                                </>
                              ) : (
                                <div className="text-center py-6">
                                  <p className="text-sm text-muted-foreground mb-3">明細行がありません</p>
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
                                                    lineItems: [newItem],
                                                  },
                                                },
                                              }
                                            : f
                                        )
                                      )
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    明細を追加
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

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
                          }}
                          placeholder="備考やメモを入力してください"
                          rows={3}
                        />
                      </CardContent>
                    </Card>

                    {/* インポートボタン */}
                    <Button
                      onClick={() => confirmImport(selectedFile)}
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