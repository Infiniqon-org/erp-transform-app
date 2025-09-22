"use client"
import { SignUpForm } from "@/components/auth/signup-form"

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
      <div className="w-full max-w-md px-4">
        <SignUpForm />
      </div>
    </div>
  )
}
