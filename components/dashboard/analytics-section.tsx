"use client"

import { motion } from 'framer-motion'
import { BarChart3, FileText, Gauge, TrendingUp, Target, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fileManagementAPI, type FileStatusResponse } from '@/lib/api/file-management-api'

interface AnalyticsSectionProps {
  files: FileStatusResponse[]
}

export function AnalyticsSection({ files }: AnalyticsSectionProps) {
  const completedFiles = files.filter(f => f.status === 'DQ_FIXED')
  const processingFiles = files.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status))
  const failedFiles = files.filter(f => ['DQ_FAILED', 'UPLOAD_FAILED'].includes(f.status))

  const avgDqScore = completedFiles.length > 0
    ? completedFiles.reduce((sum, f) => sum + (f.dq_score || 0), 0) / completedFiles.length
    : 0
  const totalRowsProcessed = completedFiles.reduce((sum, f) => sum + (f.rows_out || 0), 0)
  const totalQuarantined = completedFiles.reduce((sum, f) => sum + (f.rows_quarantined || 0), 0)

  // Collect all DQ issues from completed files
  const allIssues = completedFiles.flatMap(f => f.dq_issues || [])
  const issueCount: Record<string, number> = {}
  allIssues.forEach(issue => {
    issueCount[issue] = (issueCount[issue] || 0) + 1
  })

  const topIssues = Object.entries(issueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({
      issue: issue.replace(/_/g, ' '),
      count,
      severity: issue.includes('duplicate_primary_key') || issue.includes('invalid_calendar_date') ? 'Fatal' :
                issue.includes('missing_required') || issue.includes('schema_drift') ? 'High' : 'Medium'
    }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Files',
            value: files.length.toString(),
            change: files.length > 0 ? '+100%' : '0%',
            icon: FileText,
            color: 'text-blue-400'
          },
          {
            title: 'Avg DQ Score',
            value: `${avgDqScore.toFixed(1)}%`,
            change: avgDqScore > 90 ? '+5%' : avgDqScore > 70 ? '+2%' : '0%',
            icon: Gauge,
            color: 'text-green-400'
          },
          {
            title: 'Rows Processed',
            value: totalRowsProcessed.toLocaleString(),
            change: totalRowsProcessed > 0 ? '+100%' : '0%',
            icon: TrendingUp,
            color: 'text-purple-400'
          },
          {
            title: 'Success Rate',
            value: files.length > 0 ? `${Math.round((completedFiles.length / files.length) * 100)}%` : '0%',
            change: completedFiles.length > 0 ? '+100%' : '0%',
            icon: Target,
            color: 'text-orange-400'
          }
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </motion.div>
                  <span>{stat.title}</span>
                </CardTitle>
                <Badge
                  variant="default"
                  className="text-[10px] font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30"
                >
                  {stat.change}
                </Badge>
              </CardHeader>
              <CardContent>
                <motion.div
                  className="text-3xl font-bold mb-1"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-xs text-muted-foreground">vs last period</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* DQ Issues Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Data Quality Issues Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topIssues.length > 0 ? topIssues.map((issue, index) => (
              <div key={issue.issue} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <span className="font-medium">{issue.issue}</span>
                  <Badge variant="secondary" className={
                    issue.severity === 'Fatal' ? "bg-red-500/20 text-red-400 ml-2" :
                    issue.severity === 'High' ? "bg-orange-500/20 text-orange-400 ml-2" :
                    "bg-yellow-500/20 text-yellow-400 ml-2"
                  }>
                    {issue.severity}
                  </Badge>
                </div>
                <span className="text-muted-foreground">{issue.count} occurrences</span>
              </div>
            )) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2">No Issues Found</h4>
                <p className="text-muted-foreground">Upload and process files to see data quality analysis</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Summary */}
      {files.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>File Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-green-400">Completed</span>
                  <span>{completedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">Processing</span>
                  <span>{processingFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400">Failed</span>
                  <span>{failedFiles.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Quality Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Rows</span>
                  <span>{files.reduce((sum, f) => sum + (f.rows_in || 0), 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">Clean Rows</span>
                  <span>{totalRowsProcessed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-yellow-400">Quarantined</span>
                  <span>{totalQuarantined}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Processing Time</span>
                  <span>
                    {completedFiles.length > 0
                      ? `${(completedFiles.reduce((sum, f) => sum + (f.processing_time || 0), 0) / completedFiles.length).toFixed(1)}s`
                      : '0s'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Files Processed</span>
                  <span>{completedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span>
                    {files.length > 0 ? `${Math.round((completedFiles.length / files.length) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  )
}