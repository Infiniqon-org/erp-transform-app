"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Download, Eye, Trash2, MoreHorizontal, Play, CheckCircle, XCircle, Clock } from "lucide-react"
import { useFileManagerContext } from "@/components/providers/file-manager-provider"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function FileExplorer() {
  const {
    files,
    isLoading,
    deleteFile,
    downloadFile,
    previewFile,
    formatFileSize,
    formatDate,
    startDQProcessing,
    checkProcessingStatus,
    viewResults,
    downloadCleanData,
    downloadQuarantineData,
    downloadDQReport,
    startAutoRefresh,
    stopAutoRefresh,
    autoRefreshEnabled,
    refreshFiles,
    searchQuery,
    selectedFileId,
    setSelectedFileId
  } = useFileManagerContext()
  const { toast } = useToast()

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.status.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const fileCount = filteredFiles.length

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
      case "dq_fixed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "processing":
      case "dq_running":
      case "queued":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "failed":
      case "dq_failed":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "uploaded":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "processed":
      case "dq_fixed":
        return <CheckCircle className="w-4 h-4" />
      case "processing":
      case "dq_running":
      case "queued":
        return <Clock className="w-4 h-4" />
      case "failed":
      case "dq_failed":
        return <XCircle className="w-4 h-4" />
      case "uploaded":
        return <FileText className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
      try {
        await deleteFile(fileId)
        toast({
          title: "File deleted",
          description: `${fileName} has been deleted successfully.`,
        })
      } catch (error) {
        toast({
          title: "Delete failed",
          description: "Failed to delete the file. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDownloadFile = async (file: any) => {
    try {
      await downloadFile(file)
      toast({
        title: "Download started",
        description: `Downloading ${file.name}...`,
      })
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the file. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePreviewFile = (file: any) => {
    previewFile(file)
    setSelectedFileId(file.id)
  }

  const handleStartProcessing = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Processing Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      await startDQProcessing(file.upload_id)
      toast({
        title: "Processing Started",
        description: `Starting data quality processing for ${file.name}...`,
      })
    } catch (error) {
      toast({
        title: "Processing Failed",
        description: "Failed to start data quality processing",
        variant: "destructive",
      })
    }
  }

  const handleCheckStatus = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Status Check Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      const status = await checkProcessingStatus(file.upload_id)
      toast({
        title: "Status Updated",
        description: `Status for ${file.name}: ${status.status}`,
      })
    } catch (error) {
      toast({
        title: "Status Check Failed",
        description: "Failed to check processing status",
        variant: "destructive",
      })
    }
  }

  const handleViewResults = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Results Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      const results = await viewResults(file.upload_id)
      toast({
        title: "Results Loaded",
        description: `DQ Score: ${results.dq_score}%, Rows: ${results.rows_in} → ${results.rows_out}`,
      })
    } catch (error) {
      toast({
        title: "Results Error",
        description: "Failed to load processing results",
        variant: "destructive",
      })
    }
  }

  const handleDownloadClean = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Download Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      await downloadCleanData(file.upload_id)
    } catch (error) {
      // Error handling is done in the function
    }
  }

  const handleDownloadQuarantine = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Download Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      await downloadQuarantineData(file.upload_id)
    } catch (error) {
      // Error handling is done in the function
    }
  }

  const handleDownloadReport = async (file: any) => {
    if (!file.upload_id) {
      toast({
        title: "Download Error",
        description: "File upload ID not available",
        variant: "destructive",
      })
      return
    }

    try {
      await downloadDQReport(file.upload_id)
    } catch (error) {
      // Error handling is done in the function
    }
  }

  const handleRefreshFiles = async () => {
    try {
      await refreshFiles()
      toast({
        title: "Files Refreshed",
        description: "File list has been updated",
      })
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh files",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>Files ({filteredFiles.length}{searchQuery ? ` of ${files.length}` : ''})</span>
            <Badge variant="outline" className="text-xs">
              {filteredFiles.filter(f => f.status === 'processed' || f.status === 'dq_fixed').length} processed
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshFiles}
              disabled={isLoading}
            >
              <Play className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            {!autoRefreshEnabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={startAutoRefresh}
              >
                <Clock className="w-4 h-4 mr-1" />
                Auto Refresh
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={stopAutoRefresh}
                className="bg-yellow-500/10 border-yellow-500/20"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Stop Auto
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">
                {searchQuery ? 'No files match your search' : 'No files uploaded yet'}
              </p>
              <p className="text-xs text-muted-foreground">
                {searchQuery ? 'Try adjusting your search terms' : 'Upload your first file to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFiles.map((file, index) => (
                <div
                  key={file.id}
                  className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                    selectedFileId === file.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handlePreviewFile(file)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="mt-1">
                        {getStatusIcon(file.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="text-sm font-medium truncate">{file.name}</h4>
                          <Badge variant="outline" className={`text-xs ${getStatusColor(file.status)}`}>
                            {file.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {file.dq_score && (
                            <Badge variant="outline" className={`text-xs ${
                              file.dq_score >= 90 ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                              file.dq_score >= 75 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                              'bg-red-500/10 text-red-500 border-red-500/20'
                            }`}>
                              {file.dq_score}% DQ
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Size: {formatFileSize(file.size)}</p>
                          <p>Uploaded: {formatDate(new Date(file.uploaded_at || file.lastModified))}</p>
                          {file.rows_in && (
                            <p>Rows: {file.rows_in} → {file.rows_out} ({file.rows_quarantined} quarantined)</p>
                          )}
                          {file.status === 'processed' || file.status === 'dq_fixed' ? (
                            <p className="text-green-600">✅ Data quality processing completed</p>
                          ) : file.status === 'processing' || file.status === 'dq_running' || file.status === 'queued' ? (
                            <p className="text-yellow-600">🔄 Processing data quality rules...</p>
                          ) : (file.status === 'failed' || file.status === 'dq_failed') && file.last_error ? (
                            <p className="text-red-600">❌ {file.last_error}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        {(file.status === 'uploaded' || file.status === 'dq_failed' || file.status === 'failed') && (
                          <DropdownMenuItem onClick={() => handleStartProcessing(file)}>
                            <Play className="w-4 h-4 mr-2" />
                            Start DQ Processing
                          </DropdownMenuItem>
                        )}
                        {(file.status === 'processing' || file.status === 'dq_running' || file.status === 'queued') && (
                          <DropdownMenuItem onClick={() => handleCheckStatus(file)}>
                            <Clock className="w-4 h-4 mr-2" />
                            Check Status
                          </DropdownMenuItem>
                        )}
                        {(file.status === 'processed' || file.status === 'dq_fixed') && (
                          <DropdownMenuItem onClick={() => handleViewResults(file)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Results
                          </DropdownMenuItem>
                        )}
                        {(file.status === 'processed' || file.status === 'dq_fixed') && (
                          <DropdownMenuItem onClick={() => handleDownloadClean(file)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Clean Data
                          </DropdownMenuItem>
                        )}
                        {(file.status === 'processed' || file.status === 'dq_fixed') && file.rows_quarantined && file.rows_quarantined > 0 && (
                          <DropdownMenuItem onClick={() => handleDownloadQuarantine(file)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Quarantine
                          </DropdownMenuItem>
                        )}
                        {(file.status === 'processed' || file.status === 'dq_fixed') && (
                          <DropdownMenuItem onClick={() => handleDownloadReport(file)}>
                            <FileText className="w-4 h-4 mr-2" />
                            Download DQ Report
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteFile(file.id, file.name)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
