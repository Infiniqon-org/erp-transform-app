"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Download, Settings, LogOut } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"

export function DashboardHeader() {
  const { user, logout, isAuthenticated } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          {isAuthenticated && user ? `Welcome back, ${user.email}` : 'Real-time insights into your ERP data transformation pipeline'}
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <Badge variant="outline" className="pulse-glow">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Live Data
        </Badge>

        <Button variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>

        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>

        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Configure
        </Button>

        {isAuthenticated && (
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        )}
      </div>
    </div>
  )
}
