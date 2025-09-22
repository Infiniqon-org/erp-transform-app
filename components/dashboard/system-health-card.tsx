"use client"

import { useAppSelector } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Server, Database, HardDrive } from "lucide-react"

export function SystemHealthCard() {
  const { systemHealth } = useAppSelector((state) => state.dashboard)

  const healthItems = [
    {
      name: "API Server",
      status: systemHealth.api,
      icon: Server,
      uptime: 99.9,
    },
    {
      name: "Database",
      status: systemHealth.database,
      icon: Database,
      uptime: 99.7,
    },
    {
      name: "Storage",
      status: systemHealth.storage,
      icon: HardDrive,
      uptime: 99.8,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500"
      case "degraded":
        return "bg-yellow-500"
      case "down":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "healthy":
        return "default"
      case "degraded":
        return "secondary"
      case "down":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>System Health</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {healthItems.map((item) => (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{item.name}</span>
              </div>
              <Badge variant={getStatusVariant(item.status)} className="text-xs">
                {item.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uptime</span>
                <span>{item.uptime}%</span>
              </div>
              <Progress value={item.uptime} className="h-2" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
