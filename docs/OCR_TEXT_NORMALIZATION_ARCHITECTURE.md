# OCR テキスト正規化アーキテクチャ

## 概要
OCR処理で発生する品名の2段折り返しと数値認識エラー（カンマ/ピリオド混同）を解決するためのアーキテクチャ。

## 問題点

### 1. 品名の2段折り返し
**現象:**
```
行10: "SNS 運用 (10 \\204.040 \\204.040"
行11: "月 分 )"
```

**原因:**
- 元データで品名が2段に折り返されている
- OCRが別々の行として認識
- 括弧の不完全性チェックが機能していない

### 2. 数値のカンマ/ピリオド混同
**現象:**
```
期待値: 204,040
実際: \\204.040
```

**原因:**
- OCRが全角カンマ「，」または半角カンマ「,」をピリオド「.」と誤認識
- バックスラッシュプレフィックスが付与される
- 現在の処理では `.` 以下が切り捨てられる

## 解決アーキテクチャ

### Phase 1: テキスト前処理（プリプロセッシング）

#### 1.1 数値正規化
```typescript
// OCR認識直後にテキスト全体を正規化
function normalizeOCRText(text: string): string {
  // バックスラッシュ付き数値を正規化
  // \\204.040 → 204,040
  text = text.replace(/\\\\(\d+)\.(\d{3})/g, '$1,$2')
  
  // ピリオド区切りの3桁数値をカンマに変換
  // 204.040 → 204,040
  text = text.replace(/(\d{1,3})\.(\d{3})/g, '$1,$2')
  
  return text
}
```

#### 1.2 行結合ルール強化
```typescript
// 複数行にわたる品名を結合
function mergeMultilineDescriptions(lines: string[]): string[] {
  const merged: string[] = []
  let pendingLine = ''
  
  for (const line of lines) {
    // 括弧の開閉をカウント
    const openParens = (line.match(/[（(]/g) || []).length
    const closeParens = (line.match(/[）)]/g) || []).length
    
    if (pendingLine) {
      // 保留中の行がある場合は結合
      pendingLine += line
      
      // 括弧が閉じたら確定
      const totalOpen = (pendingLine.match(/[（(]/g) || []).length
      const totalClose = (pendingLine.match(/[）)]/g) || []).length
      
      if (totalOpen === totalClose) {
        merged.push(pendingLine)
        pendingLine = ''
      }
    } else {
      // 括弧が開いているが閉じていない
      if (openParens > closeParens) {
        pendingLine = line
      } else {
        merged.push(line)
      }
    }
  }
  
  // 未処理の保留行があれば追加
  if (pendingLine) {
    merged.push(pendingLine)
  }
  
  return merged
}
```

### Phase 2: 明細行抽出の改善

#### 2.1 品名抽出パターンの改善
```typescript
// より柔軟な品名抽出
private extractDescriptionOnly(line: string): string {
  // 金額パターンを削除
  line = line.replace(/[¥\\￥]\s*[\d,，]+/g, '')
  line = line.replace(/\\\\\d+/g, '')
  
  // 数値のみの部分を削除
  line = line.replace(/\s+\d{3,}\s+/g, ' ')
  
  return line.trim()
}
```

#### 2.2 数値抽出の改善
```typescript
// カンマ区切り数値の正規化抽出
private extractAmount(text: string): string | undefined {
  // パターン1: ¥記号付き
  const pattern1 = /[¥\\￥]\s*([\d,，]+)/
  // パターン2: バックスラッシュ付き
  const pattern2 = /\\\\(\d+)/
  // パターン3: カンマ区切り
  const pattern3 = /([\d,，]{5,})/
  
  const match = text.match(pattern1) || text.match(pattern2) || text.match(pattern3)
  
  if (match) {
    return match[1].replace(/[,，]/g, '')
  }
  
  return undefined
}
```

### Phase 3: 実装順序

1. **テキスト正規化の追加** (`normalizeOCRText`)
   - `processInvoice()` メソッド内で OCR 結果取得直後に実行
   
2. **行結合処理の追加** (`mergeMultilineDescriptions`)
   - `parseInvoiceFields()` メソッド内で行分割直後に実行

3. **品名抽出ロジックの改善**
   - `extractLineItems()` メソッドの括弧チェックを強化
   - `processLineItem()` メソッドの数値抽出を改善

4. **数値パターンの拡張**
   - バックスラッシュ付き数値のサポート
   - ピリオド区切りからカンマ区切りへの変換

## テストケース

### 入力例
```
SNS 運用 (10 \\204.040 \\204.040
月 分 )
```

### 期待される出力
```typescript
{
  description: "SNS 運用 (10月分)",
  unitPrice: "204040",
  amount: "204040"
}
```

## メリット

1. **ロバスト性向上**: OCR誤認識に対する耐性が向上
2. **保守性**: 正規化ロジックが一箇所に集約
3. **拡張性**: 新しい誤認識パターンへの対応が容易
4. **パフォーマンス**: 前処理により後続処理が簡素化

## 実装ファイル

- `lib/ocr-processor.ts`: 主要な修正対象
  - `processInvoice()`: テキスト正規化追加
  - `parseInvoiceFields()`: 行結合処理追加
  - `extractLineItems()`: 抽出ロジック改善
  - `processLineItem()`: 数値抽出改善