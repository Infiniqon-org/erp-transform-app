"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Clock, Download, FileText, Upload, XCircle } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppSelector } from "@/lib/store"

export function ActivityFeed() {
  const { recentActivity } = useAppSelector((state) => state.dashboard)

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "transform":
        return FileText
      case "upload":
        return Upload
      case "download":
        return Download
      default:
        return FileText
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return CheckCircle
      case "error":
        return XCircle
      case "pending":
      default:
        return Clock
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-green-500"
      case "error":
        return "text-red-500"
      case "pending":
        return "text-yellow-500"
      default:
        return "text-gray-500"
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    
    // Get current time in IST
    const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    // Get target date in IST
    const dateIST = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    
    const diff = nowIST.getTime() - dateIST.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Recent Activity</CardTitle>
          {recentActivity.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground">{recentActivity.length} updates</span>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 sm:h-80 pr-1">
            {recentActivity.length === 0 ? (
              <div key="empty" className="text-center text-muted-foreground py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.type)
                  const StatusIcon = getStatusIcon(activity.status)

                  return (
                    <li
                      key={activity.id}
                      className="p-4 border rounded-lg bg-background/40 backdrop-blur"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-primary/10 p-2 mt-1 text-primary">
                          <ActivityIcon className="h-5 w-5" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground capitalize">{activity.type}</span>
                            <StatusIcon className={`h-4 w-4 ${getStatusColor(activity.status)}`} />
                          </div>
                          <p className="text-sm text-muted-foreground">{activity.details}</p>
                          <p className="text-xs text-muted-foreground/80">{formatTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
