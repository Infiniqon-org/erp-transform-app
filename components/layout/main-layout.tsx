"use client"

import { AppSidebar } from "./app-sidebar"
import type React from "react"
import { motion } from "framer-motion"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <motion.div
      className="flex h-screen bg-slate-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AppSidebar />
      <motion.main
        className="flex-1 overflow-auto lg:ml-0"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </motion.main>
    </motion.div>
  )
}
