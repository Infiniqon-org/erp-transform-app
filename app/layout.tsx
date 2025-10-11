import "./globals.css"

import { Inter, Playfair_Display } from "next/font/google"

import { AuthProvider } from "@/components/providers/auth-provider"
import type { Metadata } from "next"
import type React from "react"
import { ReduxProvider } from "@/components/providers/redux-provider"
import { Toaster } from "@/components/ui/toaster"
import { TransitionProvider } from "@/components/layout/transition-provider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "Infiniqon - Data Transformation Platform",
  description: "Transform your ERP data seamlessly with our professional data transformation platform",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${playfairDisplay.variable}`}>
      <body className="font-sans antialiased bg-slate-50">
        <ReduxProvider>
          <AuthProvider>
            <TransitionProvider>{children}</TransitionProvider>
          </AuthProvider>
        </ReduxProvider>
        <Toaster />
      </body>
    </html>
  )
}
