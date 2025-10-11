"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Eye, Download, RefreshCw, Loader2, X, FileSpreadsheet, FileJson, File, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { fileManagementAPI, type FileStatusResponse } from '@/lib/api/file-management-api'
import { formatFileSize, formatDate, getStatusColor } from '@/lib/utils/file-utils'

interface FilesSectionProps {
  files: FileStatusResponse[]
  loading: boolean
  selectedFile: FileStatusResponse | null
  previewData: any
  downloading: string | null
  processing: boolean
  onRefresh: () => void
  onPreview: (file: FileStatusResponse) => void
  onDownload: (file: FileStatusResponse, fileType: 'clean' | 'quarantine' | 'report' | 'original') => void
  onProcess: (file: FileStatusResponse) => void
  onClosePreview: () => void
  idToken?: string | null
}

export function FilesSection({
  files,
  loading,
  selectedFile,
  previewData,
  downloading,
  processing,
  onRefresh,
  onPreview,
  onDownload,
  onProcess,
  onClosePreview,
  idToken
}: FilesSectionProps) {
  const { toast } = useToast()
  const [selectedFileDetail, setSelectedFileDetail] = useState<FileStatusResponse | null>(null)

  const handleDownload = async (file: FileStatusResponse, fileType: 'clean' | 'quarantine' | 'report' | 'original') => {
    try {
      await onDownload(file, fileType)
    } catch (error) {
      console.error('Download error:', error)
    }
  }

  const handleFileClick = (file: FileStatusResponse) => {
    setSelectedFileDetail(file)
  }

  const handleDownloadFormat = async (file: FileStatusResponse, format: 'csv' | 'excel' | 'json') => {
    if (!file.file_data) {
      toast({
        title: "Error",
        description: "No file data available for download",
        variant: "destructive",
      })
      return
    }

    try {
      const baseFilename = (file.original_filename || file.filename || 'file').replace('.csv', '')
      let content: string
      let mimeType: string
      let extension: string

      switch (format) {
        case 'csv':
          content = convertToCSV(file.file_data)
          mimeType = 'text/csv'
          extension = '.csv'
          break
        case 'json':
          content = convertToJSON(file.file_data)
          mimeType = 'application/json'
          extension = '.json'
          break
        case 'excel':
          // For Excel, we'll download as CSV with .xlsx extension
          content = convertToCSV(file.file_data)
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          extension = '.xlsx'
          break
        default:
          throw new Error('Unsupported format')
      }

      downloadFile(content, `${baseFilename}_processed${extension}`, mimeType)

      toast({
        title: "Success",
        description: `${format.toUpperCase()} file downloaded successfully!`,
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive",
      })
    }
  }

  const convertToCSV = (data: { headers: string[], rows: Record<string, any>[] }) => {
    if (!data || !data.headers || !data.rows) return ''
    
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => 
        data.headers.map(header => {
          const value = row[header] || ''
          // Escape commas and quotes in CSV
          return value.includes(',') || value.includes('"') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value
        }).join(',')
      )
    ].join('\n')
    
    return csvContent
  }

  const convertToJSON = (data: { headers: string[], rows: Record<string, any>[] }) => {
    if (!data || !data.rows) return '[]'
    return JSON.stringify(data.rows, null, 2)
  }

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            File Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your uploaded and processed files
          </p>
        </div>
        <Button onClick={onRefresh} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Files List */}
      <Card>
        <CardContent className="p-6">
          {files.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Files Uploaded</h3>
              <p className="text-muted-foreground">Upload a CSV file to see it here with real data analysis</p>
            </div>
          ) : (
            <div className="space-y-4">
              {files.map((file, index) => (
                <motion.div
                  key={file.upload_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="border rounded-lg p-6 hover:bg-muted/50 transition-all cursor-pointer"
                  onClick={() => handleFileClick(file)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <FileText className="w-5 h-5 text-primary mt-1" />
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">{file.original_filename || file.filename}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>Uploaded: {formatDate(file.uploaded_at || file.created_at)}</span>
                          {file.file_size && <span>Size: {formatFileSize(file.file_size)}</span>}
                          {file.processing_time && <span>Processed in: {file.processing_time.toFixed(1)}s</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Rows: {file.rows_in || 0} → {file.rows_out || file.rows_in || 0}
                          </span>
                          {(file.rows_quarantined ?? 0) > 0 && (
                            <span className="text-yellow-600">
                              Quarantined: {file.rows_quarantined}
                            </span>
                          )}
                          {file.dq_score !== null && (
                            <span className="text-green-600">
                              DQ Score: {file.dq_score}%
                            </span>
                          )}
                        </div>
                        {file.dq_issues && file.dq_issues.length > 0 && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Issues: </span>
                            {file.dq_issues.map((issue, i) => (
                              <span key={issue} className="text-orange-400">
                                {issue.replace(/_/g, ' ')}{i < (file.dq_issues?.length ?? 0) - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(file.status)}>
                        {file.status}
                      </Badge>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Process Button - Only show for UPLOADED status */}
                        {file.status === 'UPLOADED' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => onProcess(file)}
                                  disabled={processing}
                                  className="h-8 w-8"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {processing ? "Another file is being processed" : "Start Processing"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {/* Download Original Button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => onDownload(file, 'original')}
                                disabled={downloading === `${file.upload_id}-original`}
                                className="h-8 w-8"
                              >
                                {downloading === `${file.upload_id}-original` ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download Original File</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        {/* Download Clean Button - Only if processed */}
                        {(file.status === 'DQ_FIXED' || file.status === 'COMPLETED') && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => onDownload(file, 'clean')}
                                  disabled={downloading === `${file.upload_id}-clean`}
                                  className="h-8 w-8 text-green-600"
                                >
                                  {downloading === `${file.upload_id}-clean` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileSpreadsheet className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download Cleaned Data</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Detail Dialog */}
      <Dialog open={!!selectedFileDetail} onOpenChange={() => setSelectedFileDetail(null)}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedFileDetail?.original_filename || selectedFileDetail?.filename}
            </DialogTitle>
          </DialogHeader>

          {selectedFileDetail && (
            <div className="space-y-6 overflow-y-auto pr-2">
              {/* File Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Upload ID</div>
                  <div className="text-sm font-mono">{selectedFileDetail.upload_id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Original Filename</div>
                  <div className="text-sm font-medium">{selectedFileDetail.original_filename || selectedFileDetail.filename}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Uploaded At</div>
                  <div className="text-sm">{formatDate(selectedFileDetail.uploaded_at || selectedFileDetail.created_at)}</div>
                </div>
                {selectedFileDetail.processing_time && (
                  <div>
                    <div className="text-sm text-muted-foreground">Processing Time</div>
                    <div className="text-sm">{selectedFileDetail.processing_time.toFixed(2)} seconds</div>
                  </div>
                )}
              </div>

              {/* File Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {selectedFileDetail.file_size ? formatFileSize(selectedFileDetail.file_size) : 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground">File Size</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{selectedFileDetail.rows_in || 0}</div>
                  <div className="text-sm text-muted-foreground">Input Rows</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{selectedFileDetail.rows_out || 0}</div>
                  <div className="text-sm text-muted-foreground">Output Rows</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{selectedFileDetail.dq_score || 0}%</div>
                  <div className="text-sm text-muted-foreground">DQ Score</div>
                </div>
              </div>

              {/* File Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Processing Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(selectedFileDetail.status)}>
                        {selectedFileDetail.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uploaded:</span>
                      <span>{formatDate(selectedFileDetail.uploaded_at || selectedFileDetail.created_at)}</span>
                    </div>
                    {selectedFileDetail.processing_time && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processing Time:</span>
                        <span>{selectedFileDetail.processing_time.toFixed(1)}s</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quarantined Rows:</span>
                      <span className={selectedFileDetail.rows_quarantined ? 'text-yellow-600' : ''}>
                        {selectedFileDetail.rows_quarantined || 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Quality Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedFileDetail.dq_issues && selectedFileDetail.dq_issues.length > 0 ? (
                      <div className="space-y-2">
                        {selectedFileDetail.dq_issues.map((issue, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <span className="text-sm">{issue.replace(/_/g, ' ')}</span>
                            <Badge variant="outline" className="text-xs">
                              Issue
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No data quality issues found
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setSelectedFileDetail(null)
                    onPreview(selectedFileDetail!)
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview Data
                </Button>
              </div>

              {/* Download Options */}
              {selectedFileDetail.status === 'DQ_FIXED' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Download Options</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Download your processed data in different formats
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Button
                        onClick={() => handleDownloadFormat(selectedFileDetail, 'csv')}
                        className="flex items-center gap-2 h-12"
                        variant="outline"
                      >
                        <File className="w-4 h-4" />
                        <div className="text-left">
                          <div className="font-medium">CSV</div>
                          <div className="text-xs text-muted-foreground">Clean Data</div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => handleDownloadFormat(selectedFileDetail, 'excel')}
                        className="flex items-center gap-2 h-12"
                        variant="outline"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <div className="text-left">
                          <div className="font-medium">Excel</div>
                          <div className="text-xs text-muted-foreground">Spreadsheet</div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => handleDownloadFormat(selectedFileDetail, 'json')}
                        className="flex items-center gap-2 h-12"
                        variant="outline"
                      >
                        <FileJson className="w-4 h-4" />
                        <div className="text-left">
                          <div className="font-medium">JSON</div>
                          <div className="text-xs text-muted-foreground">Report</div>
                        </div>
                      </Button>
                    </div>

                    <Separator className="my-4" />
                    <div className="text-sm text-muted-foreground mb-2">Additional Downloads:</div>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleDownload(selectedFileDetail, 'original')}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Original File
                      </Button>
                      
                      {selectedFileDetail.rows_quarantined && selectedFileDetail.rows_quarantined > 0 && (
                        <Button
                          onClick={() => handleDownload(selectedFileDetail, 'quarantine')}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Quarantined Data ({selectedFileDetail.rows_quarantined} rows)
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Error Display */}
              {selectedFileDetail.last_error && (
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Processing Error</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-600">Sorry, processing failed. Please try again or contact support.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {selectedFile && previewData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background border rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Data Preview - {selectedFile.original_filename || selectedFile.filename}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {previewData.headers && previewData.sample_data && previewData.headers.length > 0
                    ? `Showing all ${previewData.total_rows || 0} rows`
                    : 'Loading preview data...'
                  }
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClosePreview}
                className="text-foreground hover:text-foreground/70"
              >
                ✕
              </Button>
            </div>
            <ScrollArea className="h-96">
              {previewData.headers && previewData.sample_data && previewData.headers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {previewData.headers.map((header: string) => (
                        <th key={header} className="text-left p-2 text-muted-foreground font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.sample_data.map((row: any, index: number) => (
                      <tr key={index} className="border-b">
                        {previewData.headers.map((header: string, cellIndex: number) => (
                          <td key={cellIndex} className="p-2 text-foreground">
                            {row && typeof row === 'object' && row[header] !== undefined ? String(row[header]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading preview data...</p>
                  </div>
                </div>
              )}
            </ScrollArea>
            <div className="mt-4 text-xs text-muted-foreground">
              Preview shows actual data from your uploaded CSV file
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}