"use client";

import { useRouter } from "next/navigation";
import PaymentManagement from "@/components/payment-management";

export default function PaymentsPage() {
  const router = useRouter();

  const handleNavigate = (page: string) => {
    if (page === "dashboard") {
      router.push("/");
    } else {
      router.push(`/${page}`);
    }
  };

  return <PaymentManagement onNavigate={handleNavigate} />;
}