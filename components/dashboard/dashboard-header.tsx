"use client"

import { Download, LogOut, RefreshCw, Settings } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { useAuth } from "@/components/providers/auth-provider"

export function DashboardHeader() {
  const { user, logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = '/auth/login'
  }

  return (
    <motion.div
      className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          {isAuthenticated && user ? `Welcome back, ${user.email}` : 'Real-time insights into your ERP data transformation pipeline'}
        </p>
      </motion.div>

      <motion.div
        className="flex flex-wrap items-center gap-2 sm:space-x-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
      >
        <Badge variant="outline" className="pulse-glow">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Live Data
        </Badge>

        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </motion.div>

        {isAuthenticated && (
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
