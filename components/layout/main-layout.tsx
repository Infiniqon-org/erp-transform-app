"use client"

import type React from "react"
import { AppSidebar } from "./app-sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-slate-50">
      <AppSidebar />
      <main className="flex-1 overflow-auto lg:ml-0">
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  )
}
