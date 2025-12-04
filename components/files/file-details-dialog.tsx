import { useState, useEffect } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Hash,
  Server,
  XCircle,
  Table as TableIcon,
  Loader2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBytes, formatToIST, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { FileStatusResponse, fileManagementAPI } from "@/lib/api/file-management-api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface FileDetailsDialogProps {
  file: FileStatusResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileDetailsDialog({ file, open, onOpenChange }: FileDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'preview'>('details')
  const [previewData, setPreviewData] = useState<{ headers: string[], sample_data: any[], total_rows: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (open && file && activeTab === 'preview' && !previewData) {
      loadPreview()
    }
  }, [open, file, activeTab])

  useEffect(() => {
    if (!open) {
      setActiveTab('details')
      setPreviewData(null)
      setPreviewError(null)
    }
  }, [open])

  const loadPreview = async () => {
    if (!file) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const authTokens = JSON.parse(localStorage.getItem('authTokens') || '{}')
      const token = authTokens.idToken
      if (!token) throw new Error('Not authenticated')
      const data = await fileManagementAPI.getFilePreview(file.upload_id, token)
      setPreviewData(data)
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (!file) return null

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase() || ''
    if (s.includes('FIXED') || s.includes('COMPLETED') || s.includes('PROCESSED')) return 'bg-green-500/10 text-green-500 border-green-500/20'
    if (s.includes('FAILED')) return 'bg-red-500/10 text-red-500 border-red-500/20'
    if (s.includes('RUNNING') || s.includes('PROCESSING') || s.includes('QUEUED')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} >
      <DialogContent className="w-[98vw] h-[80vh] max-w-6xl max-h-none p-0 flex flex-col gap-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-left gap-4">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold truncate">
                <FileText className="w-5 h-5 text-primary shrink-0" />
                <span className="truncate">{file.original_filename || file.filename || 'File'}</span>
              </DialogTitle>
              <Badge className={cn("shrink-0", getStatusColor(file.status))} variant="outline">
                {file.status}
              </Badge>
            </div>
          </DialogHeader>

          {/* Tab Navigation */}
          <div className="px-6 py-2 border-b shrink-0 bg-muted/10">
            <div className="inline-flex rounded-lg border bg-muted p-1">
              <button
                onClick={() => setActiveTab('details')}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeTab === 'details'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Server className="h-3.5 w-3.5" />
                Details
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeTab === 'preview'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'details' && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                {/* Processing Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Hash className="w-4 h-4" />
                      <span className="text-sm font-medium">Rows</span>
                    </div>
                    <div className="text-2xl font-bold">{file.rows_in || 0}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Clean</span>
                    </div>
                    <div className="text-2xl font-bold">{file.rows_clean || 0}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-600 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Fixed</span>
                    </div>
                    <div className="text-2xl font-bold">{file.rows_fixed || 0}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Quarantined</span>
                    </div>
                    <div className="text-2xl font-bold">{file.rows_quarantined || 0}</div>
                  </div>
                </div>

                {/* DQ Score & Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-5 rounded-lg flex items-center justify-between border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Quality Score</div>
                        <div className="text-xs text-muted-foreground">Overall data health</div>
                      </div>
                    </div>
                    <span className="text-3xl font-bold text-primary">
                      {typeof file.dq_score === 'number' ? `${file.dq_score.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-muted/50 p-5 rounded-lg flex items-center justify-between border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">File Size</div>
                        <div className="text-xs text-muted-foreground">Original input size</div>
                      </div>
                    </div>
                    <span className="text-xl font-mono font-medium">
                      {formatBytes(file.input_size_bytes || file.file_size || 0)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Timestamps */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline (IST)
                  </h4>
                  <div className="grid gap-4 text-sm sm:grid-cols-3">
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <p className="text-xs text-muted-foreground mb-1">Uploaded</p>
                      <p className="font-mono text-sm font-medium">{formatToIST(file.uploaded_at || file.created_at)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                      <p className="font-mono text-sm font-medium">{formatToIST(file.updated_at)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <p className="text-xs text-muted-foreground mb-1">Status Changed</p>
                      <p className="font-mono text-sm font-medium">{formatToIST(file.status_timestamp)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* System Details */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    System Info
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-muted/30 p-3 rounded border">
                      <span className="text-xs text-muted-foreground block mb-1">Upload ID</span>
                      <code className="text-xs font-mono block truncate select-all" title={file.upload_id}>
                        {file.upload_id}
                      </code>
                    </div>
                    <div className="bg-muted/30 p-3 rounded border">
                      <span className="text-xs text-muted-foreground block mb-1">Engine</span>
                      <span className="text-sm font-medium">{file.engine || 'Standard'}</span>
                    </div>
                  </div>
                </div>
              </div>
              </ScrollArea>
            )}

            {activeTab === 'preview' && (
              <div className="h-full flex flex-col">
                {previewLoading && (
                  <div className="flex items-center justify-center flex-1">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-muted-foreground">Loading preview data...</p>
                    </div>
                  </div>
                )}
                
                {previewError && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
                    <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Preview Unavailable</h3>
                    <p className="text-muted-foreground max-w-md">{previewError}</p>
                  </div>
                )}

                {!previewLoading && !previewError && previewData && (
                  <>
                    <div className="flex-1 overflow-auto relative bg-background mx-4 my-4 border rounded-lg">
                      <table className="w-full border-collapse text-sm">
                        <thead className="sticky top-0 z-20 bg-muted shadow-sm " >
                          <tr>
                            {previewData.headers?.map((header) => (
                              <th 
                                key={header} 
                                className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap border-b border-r last:border-r-0 bg-muted select-none"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.sample_data?.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                              {previewData.headers?.map((header) => (
                                <td 
                                  key={header} 
                                  className="px-4 py-2.5 whitespace-nowrap border-r last:border-r-0 max-w-[300px] truncate"
                                  title={row && typeof row === 'object' ? String(row[header] ?? '') : ''}
                                >
                                  {row && typeof row === 'object' ? String(row[header] ?? '') : ''}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2 border-t bg-muted/10 text-xs text-muted-foreground text-center shrink-0">
                      Showing first {previewData.sample_data?.length} rows of {previewData.total_rows} total records
                    </div>
                  </>
                )}

                {!previewLoading && !previewError && !previewData && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center">
                    <TableIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                    <p className="text-muted-foreground">No preview data available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
