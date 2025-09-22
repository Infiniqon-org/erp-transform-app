"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useFileManagerContext } from "@/components/providers/file-manager-provider"
import { CheckCircle, AlertTriangle, FileText, TrendingUp, Eye, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function DQResults() {
  const { files, selectedFileId, setSelectedFileId } = useFileManagerContext()
  const { toast } = useToast()

  const {
    downloadCleanData,
    downloadQuarantineData,
    downloadDQReport,
    downloadFile
  } = useFileManagerContext()

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

  const getDQScoreClass = (score: number) => {
    if (score >= 90) return 'bg-green-500/10 text-green-500 border-green-500/20'
    if (score >= 75) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    return 'bg-red-500/10 text-red-500 border-red-500/20'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="w-4 h-4" />
    if (score >= 75) return <TrendingUp className="w-4 h-4" />
    return <AlertTriangle className="w-4 h-4" />
  }

  const selectedFile = selectedFileId ? completedFiles.find(f => f.id === selectedFileId) : null

  const handleDownloadClean = async () => {
    if (selectedFile) {
      try {
        await downloadCleanData(selectedFile.id)
        toast({
          title: "Download started",
          description: "Clean data download has been initiated.",
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Failed to download clean data. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDownloadQuarantine = async () => {
    if (selectedFile) {
      try {
        await downloadQuarantineData(selectedFile.id)
        toast({
          title: "Download started",
          description: "Quarantine data download has been initiated.",
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Failed to download quarantine data. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDownloadReport = async () => {
    if (selectedFile) {
      try {
        await downloadDQReport(selectedFile.id)
        toast({
          title: "Download started",
          description: "DQ report download has been initiated.",
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Failed to download DQ report. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDownloadOriginal = async () => {
    if (selectedFile) {
      try {
        await downloadFile(selectedFile)
        toast({
          title: "Download started",
          description: "Original file download has been initiated.",
        })
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Failed to download original file. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  if (completedFiles.length === 0) {
    return (
      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <span>Individual File Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Processed Files Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload and process files to see individual data quality results here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-500" />
          <span>Individual File Results</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <h4 className="text-lg font-semibold">{selectedFile.name}</h4>
              </div>

              {/* DQ Score Overview */}
              <div className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Data Quality Score</span>
                  <Badge className={`flex items-center space-x-1 ${getDQScoreClass(selectedFile.dq_score || 0)}`}>
                    {getScoreIcon(selectedFile.dq_score || 0)}
                    <span>{selectedFile.dq_score}%</span>
                  </Badge>
                </div>
                <Progress value={selectedFile.dq_score || 0} className="h-3" />
              </div>

              {/* Processing Statistics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-500/5 rounded-lg border">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {formatNumber(selectedFile.rows_in || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Input Rows</div>
                </div>
                <div className="text-center p-3 bg-blue-500/5 rounded-lg border">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {formatNumber(selectedFile.rows_out || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Clean Rows</div>
                </div>
                <div className="text-center p-3 bg-orange-500/5 rounded-lg border">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {formatNumber(selectedFile.rows_quarantined || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Quarantined</div>
                </div>
              </div>

              {/* Data Retention Rate */}
              <div className="p-3 bg-purple-500/5 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Data Retention Rate</span>
                  <span className="text-lg font-bold text-purple-600">
                    {selectedFile.rows_in && selectedFile.rows_in > 0
                      ? ((selectedFile.rows_out || 0) / selectedFile.rows_in * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>

              {/* Download Actions */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground">Download Options:</h5>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadClean}>
                    <Download className="w-4 h-4 mr-2" />
                    Clean Data
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                    <Download className="w-4 h-4 mr-2" />
                    DQ Report
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadQuarantine}>
                    <Download className="w-4 h-4 mr-2" />
                    Quarantine
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadOriginal}>
                    <Download className="w-4 h-4 mr-2" />
                    Original
                  </Button>
                </div>
              </div>

              {/* DQ Issues */}
              {selectedFile.dq_issues && selectedFile.dq_issues.length > 0 ? (
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-muted-foreground">Data Quality Issues Found:</h5>
                  <div className="space-y-2">
                    {selectedFile.dq_issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-red-700">{issue.rule}</span>
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/30">
                            {formatNumber(issue.violations)} violations
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-500/5 rounded-lg border border-green-500/20 text-center">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-green-700 font-medium">No Data Quality Issues Found</p>
                  <p className="text-xs text-muted-foreground mt-1">This file passed all quality checks</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <Eye className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Select a file from the Files section to view detailed results</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
