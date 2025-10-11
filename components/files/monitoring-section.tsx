"use client"

import { motion } from 'framer-motion'
import { Activity, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { fileManagementAPI, type FileStatusResponse } from '@/lib/api/file-management-api'

interface MonitoringSectionProps {
  files: FileStatusResponse[]
}

export function MonitoringSection({ files }: MonitoringSectionProps) {
  const runningFiles = files.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status))

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'UPLOADING': return '10%'
      case 'QUEUED': return '20%'
      case 'NORMALIZING': return '40%'
      case 'DQ_RUNNING': return '70%'
      default: return '90%'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
            Processing Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runningFiles.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {runningFiles.map((file, index) => (
                <motion.div
                  key={file.upload_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border border-border rounded-lg p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h4 className="font-medium text-sm sm:text-base truncate flex-1">{file.original_filename}</h4>
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 text-xs flex-shrink-0">
                      <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin mr-1 sm:mr-2" />
                      {file.status}
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <motion.div
                      className="bg-yellow-500 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: getProgressWidth(file.status) }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs text-muted-foreground">
                    <span>Status: {file.status}</span>
                    <span>Rows: {file.rows_in || 0}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">No Active Processing</h3>
              <p className="text-sm text-muted-foreground px-4">Upload a file to see processing status here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Stats */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Processing Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-0">
                <div className="text-xl sm:text-2xl font-bold text-blue-400">{files.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Total Files</div>
              </div>
              <div className="text-center p-2 sm:p-0">
                <div className="text-xl sm:text-2xl font-bold text-green-400">
                  {files.filter(f => f.status === 'DQ_FIXED').length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-2 sm:p-0">
                <div className="text-xl sm:text-2xl font-bold text-yellow-400">
                  {files.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status)).length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-2 sm:p-0">
                <div className="text-xl sm:text-2xl font-bold text-red-400">
                  {files.filter(f => ['DQ_FAILED', 'FAILED'].includes(f.status)).length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}