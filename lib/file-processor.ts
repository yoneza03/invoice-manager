import { InvoiceAttachment } from "./types"

/**
 * ファイルをBase64エンコード
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Base64からBlobに変換
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(",")[1])
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type: mimeType })
}

/**
 * 画像を圧縮してBase64に変換
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let width = img.width
        let height = img.height

        // 最大サイズを計算
        const maxWidth = 1920
        const maxHeight = 1920

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)

        // 品質を調整してサイズを制限
        let quality = 0.9
        let base64 = canvas.toDataURL(file.type, quality)

        while (base64.length > maxSizeMB * 1024 * 1024 && quality > 0.1) {
          quality -= 0.1
          base64 = canvas.toDataURL(file.type, quality)
        }

        resolve(base64)
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * PDFファイルを画像に変換
 */
export async function pdfToImage(file: File): Promise<string> {
  // pdf.js を使用してPDFを画像化
  const pdfjsLib = await import("pdfjs-dist")
  
  // Worker設定 - npm パッケージから直接参照
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1) // 最初のページを取得

  const viewport = page.getViewport({ scale: 2.0 })
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  canvas.height = viewport.height
  canvas.width = viewport.width

  await page.render({
    canvasContext: context!,
    viewport: viewport,
    canvas: canvas,
  }).promise

  return canvas.toDataURL("image/png")
}

/**
 * ファイルを添付ファイル形式に変換
 * 🆕 LocalStorage最適化: base64Dataは保存しない（メタデータのみ）
 */
export async function createAttachment(file: File): Promise<InvoiceAttachment> {
  return {
    id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: new Date(),
  }
}

/**
 * ファイルをOCR処理用に画像データに変換
 * 🆕 LocalStorage最適化: OCR処理のためだけに使用し、保存しない
 */
export async function fileToImageForOCR(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    return await pdfToImage(file)
  } else if (file.type.startsWith("image/")) {
    return await compressImage(file, 1)
  } else {
    throw new Error("サポートされていないファイル形式です")
  }
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

/**
 * ファイル形式を検証
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"]

  if (file.size > maxSize) {
    return { valid: false, error: "ファイルサイズは10MB以下にしてください" }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "PDF、JPEG、PNG形式のファイルのみ対応しています" }
  }

  return { valid: true }
}