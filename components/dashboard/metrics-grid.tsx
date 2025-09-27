"use client"

import { useAppSelector } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Database, Zap, Users } from "lucide-react"

export function MetricsGrid() {
  const { totalTransformations, successRate, activeConnections } = useAppSelector((state) => state.dashboard)

  const metrics = [
    {
      title: "Total Transformations",
      value: totalTransformations.toLocaleString(),
      change: "+12.5%",
      trend: "up",
      icon: Database,
      color: "text-chart-1",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      change: "+2.1%",
      trend: "up",
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      title: "Active Connections",
      value: activeConnections.toString(),
      change: "-1.2%",
      trend: "down",
      icon: Users,
      color: "text-chart-3",
    },
    {
      title: "Processing Speed",
      value: "847ms",
      change: "-15.3%",
      trend: "up",
      icon: Zap,
      color: "text-chart-4",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {metrics.map((metric, index) => (
        <Card
          key={metric.title}
          className="hover:glow transition-all duration-300"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
            <metric.icon className={`w-5 h-5 ${metric.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground mb-1">{metric.value}</div>
            <div className="flex items-center space-x-2">
              <Badge variant={metric.trend === "up" ? "default" : "secondary"} className="text-xs">
                {metric.trend === "up" ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {metric.change}
              </Badge>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
