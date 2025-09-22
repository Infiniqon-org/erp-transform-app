"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useFileManagerContext } from "@/components/providers/file-manager-provider"
import { CheckCircle, AlertTriangle, TrendingUp } from "lucide-react"

export function DQSummary() {
  const { files } = useFileManagerContext()

  const completedFiles = files.filter(f =>
    f.status === 'processed' || f.status === 'dq_fixed'
  )

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 100000) {
      return `${(num / 1000).toFixed(0)}K`
    } else if (num >= 10000) {
      return `${(num / 1000).toFixed(1)}K`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`
    }
    return num.toLocaleString()
  }

  if (completedFiles.length === 0) {
    return (
      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Data Quality Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Data Quality Results Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Process files to see comprehensive data quality analysis and scores here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const summaryStats = completedFiles.reduce((acc, file) => {
    acc.totalFiles++
    acc.totalRowsIn += file.rows_in || 0
    acc.totalRowsOut += file.rows_out || 0
    acc.totalQuarantined += file.rows_quarantined || 0
    acc.avgDQScore += file.dq_score || 0
    return acc
  }, { totalFiles: 0, totalRowsIn: 0, totalRowsOut: 0, totalQuarantined: 0, avgDQScore: 0 })

  summaryStats.avgDQScore = summaryStats.avgDQScore / summaryStats.totalFiles
  const dataRetentionRate = summaryStats.totalRowsIn > 0 ? (summaryStats.totalRowsOut / summaryStats.totalRowsIn) * 100 : 0

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-4 h-4" />
    if (score >= 75) return <TrendingUp className="w-4 h-4" />
    return <AlertTriangle className="w-4 h-4" />
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>Data Quality Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-2xl font-bold text-primary mb-1">{summaryStats.totalFiles}</div>
            <div className="text-xs text-muted-foreground font-medium">Files Processed</div>
          </div>

          <div className="text-center p-3 bg-green-500/5 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {formatNumber(summaryStats.totalRowsIn)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Total Rows</div>
          </div>

          <div className="text-center p-3 bg-blue-500/5 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {formatNumber(summaryStats.totalRowsOut)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Clean Rows</div>
          </div>

          <div className="text-center p-3 bg-orange-500/5 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {formatNumber(summaryStats.totalQuarantined)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Quarantined</div>
          </div>

          <div className="text-center p-3 bg-purple-500/5 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {dataRetentionRate.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground font-medium">Data Retention</div>
          </div>

          <div className="text-center p-3 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-lg border">
            <div className="flex items-center justify-center space-x-1 mb-1">
              {getScoreIcon(summaryStats.avgDQScore)}
              <span className="text-2xl font-bold text-green-600">
                {summaryStats.avgDQScore.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-medium">Avg DQ Score</div>
            <Progress value={summaryStats.avgDQScore} className="mt-2 h-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
