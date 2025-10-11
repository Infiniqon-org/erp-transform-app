"use client"

import { useEffect, useState, useCallback } from "react"
import { useAppDispatch, useAppSelector } from "@/lib/store"
import { updateMetrics, addActivity } from "@/lib/features/dashboard/dashboardSlice"
import { MainLayout } from "@/components/layout/main-layout"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { MetricsGrid } from "@/components/dashboard/metrics-grid"
import { SystemHealthCard } from "@/components/dashboard/system-health-card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { AnalyticsSection } from "@/components/dashboard/analytics-section"
import { AuthGuard } from "@/components/auth/auth-guard"
import { useAuth } from "@/components/providers/auth-provider"
import { fileManagementAPI, type FileStatusResponse } from "@/lib/api/file-management-api"
import { useToast } from "@/hooks/use-toast"

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const dashboardState = useAppSelector((state) => state.dashboard)
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const { idToken } = useAuth()
  const { toast } = useToast()

  // Load files for analytics
  const loadFiles = useCallback(async () => {
    if (!idToken) return

    try {
      const response = await fileManagementAPI.getUploads(idToken)
      setFiles(response.items || [])
    } catch (error) {
      console.error('Error loading files for analytics:', error)
    }
  }, [idToken])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  useEffect(() => {
    // Update metrics based on real file data
    const completedFiles = files.filter(f => f.status === 'DQ_FIXED')
    const processingFiles = files.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status))
    const failedFiles = files.filter(f => ['DQ_FAILED', 'UPLOAD_FAILED'].includes(f.status))

    const totalTransformations = completedFiles.length
    const successRate = files.length > 0 ? Math.round((completedFiles.length / files.length) * 100) : 0
    const activeConnections = processingFiles.length + 1 // Add 1 for the current connection

    dispatch(
      updateMetrics({
        totalTransformations,
        successRate,
        activeConnections,
      }),
    )

    // Add real activity based on recent files
    const recentFiles = files
      .filter(f => f.uploaded_at || f.created_at)
      .sort((a, b) => {
        const timeA = a.uploaded_at || a.created_at
        const timeB = b.uploaded_at || b.created_at
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })
      .slice(0, 3)

    recentFiles.forEach(file => {
      const activityType = file.status === 'DQ_FIXED' ? 'transform' as const :
                          ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(file.status) ? 'upload' as const :
                          'download' as const

      const activityId = `${file.upload_id}-${file.status}-${Date.now()}`

      dispatch(
        addActivity({
          id: activityId,
          type: activityType,
          status: file.status === 'DQ_FIXED' ? 'success' : file.status.includes('FAILED') ? 'error' : 'success',
          timestamp: file.uploaded_at || file.created_at,
          details: `${file.original_filename || file.filename} - ${file.status.replace(/_/g, ' ')}`,
        }),
      )
    })
  }, [files, dispatch])

  return (
    <AuthGuard>
      <MainLayout>
        <div className="space-y-6 slide-in">
          <DashboardHeader />

          <MetricsGrid />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
            <div className="xl:col-span-2 space-y-4 lg:space-y-6">
              <AnalyticsSection files={files} />
            </div>

            <div className="space-y-4 lg:space-y-6">
              <SystemHealthCard />
              <ActivityFeed />
            </div>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
