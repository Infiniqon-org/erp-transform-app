"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, FileSpreadsheet, FileJson, Database, AlertCircle } from "lucide-react"
import { useFileManagerContext } from "@/components/providers/file-manager-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Eye } from "lucide-react"

export function FilePreview() {
  const { selectedFile, formatFileSize, formatDate, downloadFile } = useFileManagerContext()

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return <FileSpreadsheet className="w-8 h-8 text-green-500" />
      case 'json':
        return <FileJson className="w-8 h-8 text-blue-500" />
      case 'parquet':
        return <Database className="w-8 h-8 text-purple-500" />
      default:
        return <FileText className="w-8 h-8 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "processing":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "uploaded":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const handleDownload = async () => {
    if (selectedFile) {
      await downloadFile(selectedFile)
    }
  }

  if (!selectedFile) {
    return (
      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle>File Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-2">Select a file to preview</p>
            <p className="text-xs text-muted-foreground">File details and content will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:glow transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>File Preview</span>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Info */}
        <div className="flex items-start space-x-4">
          {getFileIcon(selectedFile.type)}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate" title={selectedFile.name}>
              {selectedFile.name}
            </h3>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline" className={`text-xs ${getStatusColor(selectedFile.status)}`}>
                {selectedFile.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Modified: {formatDate(selectedFile.modified)}
            </p>
          </div>
        </div>

        {/* File Content Preview */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center space-x-2 mb-3">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Content Preview</span>
          </div>

          {selectedFile.type.toLowerCase() === 'json' ? (
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto max-h-48">
              {JSON.stringify({
                fileName: selectedFile.name,
                size: formatFileSize(selectedFile.size),
                type: selectedFile.type,
                status: selectedFile.status,
                lastModified: formatDate(selectedFile.modified)
              }, null, 2)}
            </pre>
          ) : selectedFile.type.toLowerCase().includes('csv') || selectedFile.type.toLowerCase().includes('xlsx') || selectedFile.type.toLowerCase().includes('xls') ? (
            <div className="text-center py-4">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Spreadsheet file preview not available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Download the file to view its contents
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                File preview not available for this format
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Download the file to view its contents
              </p>
            </div>
          )}
        </div>

        {/* File Actions */}
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download File
          </Button>
        </div>

        {/* File Status */}
        {selectedFile.status === 'failed' && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-800">Processing Failed</p>
              <p className="text-xs text-red-600">This file could not be processed. Please check the file format and try again.</p>
            </div>
          </div>
        )}

        {selectedFile.status === 'processing' && (
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500"></div>
            <div>
              <p className="text-sm font-medium text-yellow-800">Processing...</p>
              <p className="text-xs text-yellow-600">This file is being processed. Please wait.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
