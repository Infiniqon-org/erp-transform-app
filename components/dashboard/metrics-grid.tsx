"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, TrendingDown, TrendingUp, Users, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { useAppSelector } from "@/lib/store"
import { staggerContainer, cardHover, fadeInUp } from "@/components/ui/motion"

export function MetricsGrid() {
  const { totalTransformations, successRate, activeConnections } = useAppSelector((state) => state.dashboard)

  const metrics = [
    {
      title: "Total Transformations",
      value: totalTransformations.toLocaleString(),
      change: "+12.5%",
      trend: "up" as const,
      icon: Database,
      color: "text-chart-1",
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      change: "+2.1%",
      trend: "up" as const,
      icon: TrendingUp,
      color: "text-chart-2",
    },
    {
      title: "Active Connections",
      value: activeConnections.toString(),
      change: "-1.2%",
      trend: "down" as const,
      icon: Users,
      color: "text-chart-3",
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {metrics.map((metric, index) => (
        <motion.article
          key={metric.title}
          variants={fadeInUp}
          custom={index}
          whileHover="whileHover"
          whileTap="whileTap"
          className="cursor-pointer"
        >
          <Card className="hover:shadow-lg transition-all duration-300 h-full border-0 shadow-sm bg-gradient-to-br from-card to-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </motion.div>
                <span>{metric.title}</span>
                <Badge
                  variant={metric.trend === "up" ? "default" : "secondary"}
                  className="text-[10px] font-medium"
                >
                  {metric.trend === "up" ? "↑" : "↓"} {metric.change}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                className="text-2xl font-bold mb-1"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
              >
                {metric.value}
              </motion.div>
              <p className="text-xs text-muted-foreground">Compared to last month</p>
            </CardContent>
          </Card>
        </motion.article>
      ))}
    </motion.div>
  )
}
