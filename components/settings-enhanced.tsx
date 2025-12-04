"use client"

import { useState } from "react"
import { ChevronLeft, Save, Shield } from "lucide-react"
import { useStore } from "@/lib/store"
import { Settings } from "@/lib/types"
import { validateRegistrationNumber } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface SettingsEnhancedProps {
  onNavigate: (page: string) => void
}

export default function SettingsEnhanced({ onNavigate }: SettingsEnhancedProps) {
  const { settings, updateSettings, authState } = useStore()
  const { toast } = useToast()
  
  // --- 以下はあなたの元コードと同じ ---
  const [companyName, setCompanyName] = useState(settings.company.name)
  const [address, setAddress] = useState(settings.company.address)
  const [phone, setPhone] = useState(settings.company.phone)
  const [email, setEmail] = useState(settings.company.email)
  const [bankName, setBankName] = useState(settings.company.bankName)
  const [branchName, setBranchName] = useState(settings.company.branchName)
  const [accountType, setAccountType] = useState(settings.company.accountType)
  const [accountNumber, setAccountNumber] = useState(settings.company.accountNumber)
  const [dueDateReminder, setDueDateReminder] = useState(settings.notifications.dueDateReminder)
  const [paymentConfirmation, setPaymentConfirmation] = useState(settings.notifications.paymentConfirmation)
  const [invoiceCreation, setInvoiceCreation] = useState(settings.notifications.invoiceCreation)
  const [registrationNumber, setRegistrationNumber] = useState(settings.company.registrationNumber ?? "")
  const [validationError, setValidationError] = useState<string | undefined>(undefined)

  const handleRegistrationNumberBlur = () => {
    const validation = validateRegistrationNumber(registrationNumber)
    setValidationError(validation.error)
  }

  const handleSave = () => {
    const validation = validateRegistrationNumber(registrationNumber)
    if (!validation.valid) {
      toast({
        title: "入力エラー",
        description: validation.error,
        variant: "destructive",
      })
      setValidationError(validation.error)
      return
    }

    const updatedSettings: Settings = {
      company: {
        name: companyName,
        address,
        phone,
        email,
        bankName,
        branchName,
        accountType,
        accountNumber,
        taxRate: settings.company.taxRate,
        registrationNumber: registrationNumber.trim() || undefined,
      },
      notifications: {
        dueDateReminder,
        paymentConfirmation,
        invoiceCreation,
      },
    }

    updateSettings(updatedSettings)
    toast({ title: "保存完了", description: "設定を保存しました" })
  }

  return (
    <div className="p-8 lg:p-12">

      {/* 戻る＋タイトル */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold">設定</h1>
          <p className="text-muted-foreground">システム設定の管理</p>
        </div>
      </div>

      {/** ★ 横2カラム：企業情報 + 支払設定 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* --- 企業情報カード --- */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold mb-4">企業情報</h3>

          <div>
            <label className="block text-sm font-medium mb-1">企業名</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">住所</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">電話番号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-input"
              />
            </div>
          </div>

          {/* 適格請求書番号 */}
          <div>
            <label className="text-sm font-medium mb-1">
              適格請求書発行事業者登録番号（任意）
            </label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => {
                setRegistrationNumber(e.target.value)
                setValidationError(undefined)
              }}
              onBlur={handleRegistrationNumberBlur}
              maxLength={14}
              className={`w-full px-4 py-2 border rounded-lg bg-input ${
                validationError ? "border-red-500" : ""
              }`}
            />
            {validationError && (
              <p className="text-xs text-red-600 mt-1">{validationError}</p>
            )}
          </div>
        </div>

        {/* --- 支払設定カード --- */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold mb-4">支払設定</h3>

          <div>
            <label className="block text-sm font-medium mb-1">銀行名</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">支店名</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg bg-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">口座種別</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as "普通預金" | "当座預金")}
                className="w-full px-4 py-2 border rounded-lg bg-input"
              >
                <option value="普通預金">普通預金</option>
                <option value="当座預金">当座預金</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">口座番号</label>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/** --- 通知設定（1カラムで下段に） --- */}
      <div className="bg-card border border-border rounded-lg p-6 mt-6 space-y-4">
        <h3 className="text-lg font-semibold mb-4">通知設定</h3>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={dueDateReminder} onChange={(e) => setDueDateReminder(e.target.checked)} />
          期限到来時に通知する
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={paymentConfirmation} onChange={(e) => setPaymentConfirmation(e.target.checked)} />
          支払完了時に通知する
        </label>

        <label className="flex items-center gap-3">
          <input type="checkbox" checked={invoiceCreation} onChange={(e) => setInvoiceCreation(e.target.checked)} />
          新規請求書作成時に通知する
        </label>
      </div>


      {/** 保存ボタン */}
      <button
        onClick={handleSave}
        className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        <Save size={20} />
        設定を保存
      </button>

      {/* Admin Permissions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">管理者設定</h3>
        <p className="text-sm text-muted-foreground mb-4">
          システムに登録されているユーザーの権限を管理できます。
        </p>

        <button
          onClick={() => onNavigate("admin-users")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
        >
          ユーザー管理へ
        </button>
      </div>

    </div>
  )
}
