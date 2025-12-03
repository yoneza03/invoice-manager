"use client"

import AdminUserList from "@/components/admin/AdminUserList"
import { useRouter } from "next/navigation"

export default function AdminUsersPage() {
  const router = useRouter()

  const handleNavigate = (page: string) => {
    if (page === "dashboard") {
      router.push("/")
    } else if (page === "settings") {
      router.push("/")
    } else {
      router.push(`/${page}`)
    }
  }

  return <AdminUserList onNavigate={handleNavigate} />
}