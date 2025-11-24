"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Image as ImageIcon, X, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { invoiceImportService } from "@/lib/invoice-import-service"
import { useStore } from "@/lib/store"
import { Invoice, OCRResult, InvoiceData } from "@/lib/types"
import { formatFileSize } from "@/lib/file-processor"
import { extractInvoiceData } from "@/lib/ocr/invoiceExtractor"

type ProcessingStatus = "idle" | "uploading" | "processing" | "success" | "error"

interface ImportedFile {
  file: File
  preview?: string
  status: ProcessingStatus
  error?: string
  result?: {
    invoice: Partial<Invoice>
    ocrData: OCRResult
  }
}

export default function InvoiceImport() {
  const { clients, addInvoice, addClient } = useStore()
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<ImportedFile | null>(null)

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
      // ステータス更新: アップロード中
      setImportedFiles((prev) =>
        prev.map((f) => (f.file === importedFile.file ? { ...f, status: "uploading" } : f))
      )

      await new Promise((resolve) => setTimeout(resolve, 500))

      // ステータス更新: 処理中
      setImportedFiles((prev) =>
        prev.map((f) => (f.file === importedFile.file ? { ...f, status: "processing" } : f))
      )

      // OCR処理
      const result = await invoiceImportService.importFromFile(importedFile.file, clients)

      // ステータス更新: 成功
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? {
                ...f,
                status: "success",
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
      setImportedFiles((prev) =>
        prev.map((f) =>
          f.file === importedFile.file
            ? {
                ...f,
                status: "error",
                error: error instanceof Error ? error.message : "処理に失敗しました",
              }
            : f
        )
      )
    }
  }

  const removeFile = (file: File) => {
    setImportedFiles((prev) => prev.filter((f) => f.file !== file))
    if (selectedFile?.file === file) {
      setSelectedFile(null)
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
      case "processing":
        return <Loader2 className="animate-spin text-blue-500" size={20} />
      case "success":
        return <CheckCircle className="text-green-500" size={20} />
      case "error":
        return <AlertCircle className="text-red-500" size={20} />
      default:
        return null
    }
  }

  const getStatusText = (status: ProcessingStatus) => {
    switch (status) {
      case "uploading":
        return "アップロード中..."
      case "processing":
        return "OCR処理中..."
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
                  <div className="flex items-center gap-2">
                    {getStatusIcon(importedFile.status)}
                    <span className="text-xs text-muted-foreground">
                      {getStatusText(importedFile.status)}
                    </span>
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
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">請求書番号</label>
                      <input
                        type="text"
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
                        className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">顧客名</label>
                      <input
                        type="text"
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
                        className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">合計金額</label>
                      <input
                        type="number"
                        value={selectedFile.result.invoice.total || 0}
                        onChange={(e) => {
                          const newTotal = Number(e.target.value)
                          setImportedFiles((prev) =>
                            prev.map((f) =>
                              f.file === selectedFile.file
                                ? {
                                    ...f,
                                    result: {
                                      ...f.result!,
                                      invoice: {
                                        ...f.result!.invoice,
                                        total: newTotal,
                                        subtotal: newTotal / 1.1, // 仮の消費税率
                                        tax: newTotal - newTotal / 1.1,
                                      },
                                    },
                                  }
                                : f
                            )
                          )
                        }}
                        className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">OCR信頼度</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(selectedFile.result.ocrData.confidence * 100).toFixed(0)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {(selectedFile.result.ocrData.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        ※ 信頼度が低い場合は手動で修正してください
                      </p>
                    </div>

                    {/* 🆕 発行者情報セクション */}
                    {selectedFile.result.invoice.issuerInfo && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-800 mb-2">発行者情報（OCR抽出）</h3>
                        <p className="text-sm">{selectedFile.result.invoice.issuerInfo.name}</p>
                        {selectedFile.result.invoice.issuerInfo.address && (
                          <p className="text-xs text-muted-foreground">{selectedFile.result.invoice.issuerInfo.address}</p>
                        )}
                        {selectedFile.result.invoice.issuerInfo.phone && (
                          <p className="text-xs text-muted-foreground">TEL: {selectedFile.result.invoice.issuerInfo.phone}</p>
                        )}
                        {selectedFile.result.invoice.issuerInfo.registrationNumber && (
                          <p className="text-xs text-muted-foreground">登録番号: {selectedFile.result.invoice.issuerInfo.registrationNumber}</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => confirmImport(selectedFile)}
                      className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      この内容でインポート
                    </button>
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
                {(selectedFile.status === "processing" || selectedFile.status === "uploading") && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary mb-4" size={48} />
                    <p className="text-foreground font-medium">{getStatusText(selectedFile.status)}</p>
                    <p className="text-sm text-muted-foreground mt-2">しばらくお待ちください...</p>
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