"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Register } from "@/components/register"
import { useStore } from "@/lib/store"

export default function RegisterPage() {
  const router = useRouter()
  const { authState } = useStore()

  useEffect(() => {
    if (authState.isAuthenticated && !authState.loading) {
      router.push("/")
    }
  }, [authState.isAuthenticated, authState.loading, router])

  if (authState.loading) {
    return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>
  }

  return <Register />
}