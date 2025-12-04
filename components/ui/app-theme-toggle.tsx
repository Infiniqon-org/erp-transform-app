"use client"

import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

import { useTheme } from "next-themes"

export default function AppThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const isDark = (resolvedTheme ?? theme) === "dark"

  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed right-4 bottom-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  )
}
