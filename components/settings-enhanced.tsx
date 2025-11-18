"use client"

import { useState } from "react"
import { ChevronLeft, Save } from "lucide-react"
import { useStore } from "@/lib/store"
import { Settings } from "@/lib/types"
import { validateRegistrationNumber } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface SettingsEnhancedProps {
  onNavigate: (page: string) => void
}

export default function SettingsEnhanced({ onNavigate }: SettingsEnhancedProps) {
  const { settings, updateSettings } = useStore()
  const { toast } = useToast()
  
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
    // バリデーション
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
        address: address,
        phone: phone,
        email: email,
        bankName: bankName,
        branchName: branchName,
        accountType: accountType,
        accountNumber: accountNumber,
        taxRate: settings.company.taxRate,
        registrationNumber: registrationNumber.trim() || undefined,
      },
      notifications: {
        dueDateReminder: dueDateReminder,
        paymentConfirmation: paymentConfirmation,
        invoiceCreation: invoiceCreation,
      },
    }
    updateSettings(updatedSettings)
    toast({
      title: "保存完了",
      description: "設定を保存しました",
    })
  }

  return (
    <div className="p-8 lg:p-12">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => onNavigate("dashboard")} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-foreground">設定</h1>
          <p className="text-muted-foreground">システム設定の管理</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Company Info */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">企業情報</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">企業名</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">住所</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">電話番号</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {/* 登録番号 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                適格請求書発行事業者登録番号
                <span className="text-xs text-muted-foreground ml-2">
                  （任意: T+13桁の数字）
                </span>
              </label>
              <input
                type="text"
                id="registrationNumber"
                placeholder="T1234567890123"
                value={registrationNumber}
                onChange={(e) => {
                  setRegistrationNumber(e.target.value)
                  setValidationError(undefined)
                }}
                onBlur={handleRegistrationNumberBlur}
                maxLength={14}
                pattern="^T\d{13}$"
                aria-label="適格請求書発行事業者登録番号"
                aria-describedby="regnum-help regnum-error"
                aria-invalid={validationError ? "true" : "false"}
                className={`w-full px-4 py-2 border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                  validationError ? "border-red-500" : "border-border"
                }`}
              />
              <p id="regnum-help" className="text-xs text-muted-foreground mt-1">
                インボイス制度対応。登録番号は請求書PDFに自動印刷されます。
              </p>
              {validationError && (
                <p id="regnum-error" className="text-xs text-red-600 mt-1" role="alert">
                  {validationError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">支払設定</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">銀行名</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">支店名</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">口座種別</label>
                <select 
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as "普通預金" | "当座預金")}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="普通預金">普通預金</option>
                  <option value="当座預金">当座預金</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">口座番号</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">通知設定</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={dueDateReminder} 
                onChange={(e) => setDueDateReminder(e.target.checked)}
                className="w-4 h-4 rounded border-border" 
              />
              <span className="text-foreground">期限到来時に通知する</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={paymentConfirmation} 
                onChange={(e) => setPaymentConfirmation(e.target.checked)}
                className="w-4 h-4 rounded border-border" 
              />
              <span className="text-foreground">支払完了時に通知する</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={invoiceCreation} 
                onChange={(e) => setInvoiceCreation(e.target.checked)}
                className="w-4 h-4 rounded border-border" 
              />
              <span className="text-foreground">新規請求書作成時に通知する</span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Save size={20} />
          設定を保存
        </button>
      </div>
    </div>
  )
}