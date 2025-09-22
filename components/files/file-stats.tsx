"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { HardDrive, FileText, Upload, Download } from "lucide-react"
import { useFileManagerContext } from "@/components/providers/file-manager-provider"

export function FileStats() {
  const { stats, formatFileSize } = useFileManagerContext()

  const storagePercentage = (stats.storageUsed / stats.storageLimit) * 100

  const statItems = [
    {
      title: "Storage Used",
      value: formatFileSize(stats.storageUsed),
      total: formatFileSize(stats.storageLimit),
      percentage: storagePercentage,
      icon: HardDrive,
    },
    {
      title: "Total Files",
      value: stats.totalFiles.toString(),
      icon: FileText,
    },
    {
      title: "Uploaded Today",
      value: stats.uploadedToday.toString(),
      icon: Upload,
    },
    {
      title: "Downloaded Today",
      value: stats.downloadedToday.toString(),
      icon: Download,
    },
  ]

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle>Storage Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statItems.map((stat, index) => (
          <div
            key={stat.title}
            className="space-y-2 animate-in slide-in-from-left"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{stat.title}</span>
              </div>
              <span className="text-sm font-semibold">{stat.value}</span>
            </div>
            {stat.percentage !== undefined && (
              <div className="space-y-1">
                <Progress value={stat.percentage} className="h-2" />
                <div className="text-xs text-muted-foreground text-right">
                  {stat.total} total
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
