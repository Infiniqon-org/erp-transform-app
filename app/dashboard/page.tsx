"use client"

import { useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/lib/store"
import { updateMetrics, addActivity } from "@/lib/features/dashboard/dashboardSlice"
import { MainLayout } from "@/components/layout/main-layout"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { MetricsGrid } from "@/components/dashboard/metrics-grid"
import { SystemHealthCard } from "@/components/dashboard/system-health-card"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { TransformationChart } from "@/components/dashboard/transformation-chart"
import { PerformanceChart } from "@/components/dashboard/performance-chart"
import { AuthGuard } from "@/components/auth/auth-guard"

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const dashboardState = useAppSelector((state) => state.dashboard)

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      dispatch(
        updateMetrics({
          totalTransformations: Math.floor(Math.random() * 10000) + 5000,
          successRate: Math.floor(Math.random() * 20) + 80,
          activeConnections: Math.floor(Math.random() * 50) + 10,
        }),
      )

      // Add random activity
      if (Math.random() > 0.7) {
        const activities = [
          { type: "transform" as const, details: "NetSuite sales_orders transformed" },
          { type: "upload" as const, details: "CSV file uploaded (2.3MB)" },
          { type: "download" as const, details: "Transformed data downloaded" },
        ]
        const activity = activities[Math.floor(Math.random() * activities.length)]
        dispatch(
          addActivity({
            id: Date.now().toString(),
            type: activity.type,
            status: Math.random() > 0.1 ? "success" : "error",
            timestamp: new Date().toISOString(),
            details: activity.details,
          }),
        )
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [dispatch])

  return (
    <AuthGuard>
      <MainLayout>
        <div className="space-y-6 slide-in">
          <DashboardHeader />

          <MetricsGrid />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
            <div className="xl:col-span-2 space-y-4 lg:space-y-6">
              <TransformationChart />
              <PerformanceChart />
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
