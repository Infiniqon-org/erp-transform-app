import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileText,
  Hash,
  Loader2,
  PieChart as PieChartIcon,
  Server,
  Table as TableIcon,
  XCircle,
  Cpu,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FileStatusResponse, DqReportResponse, fileManagementAPI } from "@/lib/api/file-management-api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatBytes, formatToIST } from "@/lib/utils"
import { useEffect, useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"

interface FileDetailsDialogProps {
  file: FileStatusResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileDetailsDialog({ file, open, onOpenChange }: FileDetailsDialogProps) {
  const ISSUES_PAGE_SIZE = 50
  const [activeTab, setActiveTab] = useState<'details' | 'preview' | 'dq-report'>('details')
  const [previewData, setPreviewData] = useState<{ headers: string[], sample_data: any[], total_rows: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [dqReport, setDqReport] = useState<DqReportResponse | null>(null)
  const [dqReportLoading, setDqReportLoading] = useState(false)
  const [dqReportError, setDqReportError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [issues, setIssues] = useState<{ row: number; column: string; violation: string; value: any }[]>([])
  const [issuesTotal, setIssuesTotal] = useState<number | null>(null)
  const [issuesNextOffset, setIssuesNextOffset] = useState<number | null>(null)
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [availableViolations, setAvailableViolations] = useState<Record<string, number>>({})
  const [selectedViolations, setSelectedViolations] = useState<Set<string>>(new Set())
  const [previewPage, setPreviewPage] = useState(1)
  const PREVIEW_PAGE_SIZE = 20
  const { toast } = useToast()

  useEffect(() => {
    if (open && file && activeTab === 'preview' && !previewData) {
      loadPreview()
    }
    if (open && file && activeTab === 'dq-report' && !dqReport) {
      loadDqReport()
    }
  }, [open, file, activeTab])

  useEffect(() => {
    if (!open) {
      setActiveTab('details')
      setPreviewData(null)
      setPreviewError(null)
      setDqReport(null)
      setDqReportError(null)
      setIssues([])
      setIssuesTotal(null)
      setIssuesNextOffset(null)
      setAvailableViolations({})
      setSelectedViolations(new Set())
      setPreviewPage(1)
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

  const loadDqReport = async () => {
    if (!file) return
    setDqReportLoading(true)
    setDqReportError(null)
    try {
      const authTokens = JSON.parse(localStorage.getItem('authTokens') || '{}')
      const token = authTokens.idToken
      if (!token) throw new Error('Not authenticated')
      const report = await fileManagementAPI.downloadDqReport(file.upload_id, token)
      setDqReport(report)
      const sampleIssues = report?.hybrid_summary?.outstanding_issues || []
      // Always cap initial render to a single page to avoid loading thousands of rows at once.
      const initialIssues = sampleIssues.slice(0, ISSUES_PAGE_SIZE)
      setIssues(initialIssues)
      const totalIssues = report?.hybrid_summary?.outstanding_issues_total ?? sampleIssues.length
      setIssuesTotal(totalIssues)
      const hasMore = totalIssues > initialIssues.length
      const sampleSize = report?.hybrid_summary?.outstanding_issues_sample_size ?? sampleIssues.length
      // If we have more than the first page, start the cursor at the page size (or sample size if smaller).
      const nextOffset = hasMore ? Math.min(sampleSize, ISSUES_PAGE_SIZE) : null
      setIssuesNextOffset(nextOffset)
      setAvailableViolations(report?.violation_counts || {})
    } catch (err: any) {
      setDqReportError(err.message || 'Failed to load DQ report')
    } finally {
      setDqReportLoading(false)
    }
  }

  const fetchIssues = async (reset: boolean = false) => {
    if (!file) return
    if (!reset && issuesNextOffset === null) return
    setIssuesLoading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem('authTokens') || '{}')
      const token = authTokens.idToken
      if (!token) throw new Error('Not authenticated')
      const resp = await fileManagementAPI.getFileIssues(
        file.upload_id,
        token,
        {
          offset: reset ? 0 : issuesNextOffset || 0,
          violations: Array.from(selectedViolations),
        }
      )
      if (reset) {
        setIssues(resp.issues || [])
      } else {
        setIssues(prev => [...prev, ...(resp.issues || [])])
      }
      setIssuesTotal(resp.total ?? (resp.issues ? resp.issues.length : 0))
      setIssuesNextOffset(resp.next_offset === undefined ? null : resp.next_offset)
      if (resp.available_violations) {
        setAvailableViolations(resp.available_violations)
      }
    } catch (err: any) {
      setDqReportError(err.message || 'Failed to load issues')
    } finally {
      setIssuesLoading(false)
    }
  }

  const handleDownloadDqReport = async () => {
    if (!file) return
    setDownloading(true)
    try {
      const authTokens = JSON.parse(localStorage.getItem('authTokens') || '{}')
      const token = authTokens.idToken
      if (!token) throw new Error('Not authenticated')
      const report = await fileManagementAPI.downloadDqReport(file.upload_id, token)
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dq_report_${file.original_filename || file.filename || file.upload_id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: "Downloaded",
        description: "DQ report downloaded successfully",
      })
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err.message || 'Failed to download DQ report',
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
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
              {(file.status === 'DQ_FIXED' || file.status === 'COMPLETED') && (
                <button
                  onClick={() => setActiveTab('dq-report')}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    activeTab === 'dq-report'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PieChart className="h-3.5 w-3.5" />
                  DQ Report
                </button>
              )}
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
                      <span className="text-sm font-medium">Validated</span>
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
                      <p className="text-xs text-muted-foreground mb-1">Processing Time</p>
                      <p className="font-mono text-sm font-medium">2h 15m</p>
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
                      {/* <span className="text-sm font-medium">{file.engine || 'Standard'}</span> */}
                      <span className="text-sm font-medium">CleanAI 1.0</span>
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
                          {(() => {
                            const startIdx = (previewPage - 1) * PREVIEW_PAGE_SIZE
                            const endIdx = startIdx + PREVIEW_PAGE_SIZE
                            const pageData = previewData.sample_data?.slice(startIdx, endIdx) || []
                            return pageData.map((row, idx) => (
                              <tr key={startIdx + idx} className="border-b hover:bg-muted/50 transition-colors">
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
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t bg-muted/10 shrink-0 space-y-3">
                      <div className="text-xs text-muted-foreground text-center">
                        {(() => {
                          const startRow = (previewPage - 1) * PREVIEW_PAGE_SIZE + 1
                          const endRow = Math.min(previewPage * PREVIEW_PAGE_SIZE, previewData.total_rows)
                          return `Showing rows ${startRow}-${endRow} of ${previewData.total_rows} total records`
                        })()}
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {(() => {
                          const totalPages = Math.ceil(previewData.total_rows / PREVIEW_PAGE_SIZE)
                          const pages = []
                          
                          // Always show first page
                          pages.push(1)
                          
                          // Show pages around current page
                          const startPage = Math.max(2, previewPage - 1)
                          const endPage = Math.min(totalPages - 1, previewPage + 1)
                          
                          if (startPage > 2) pages.push('...')
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(i)
                          }
                          if (endPage < totalPages - 1) pages.push('...')
                          
                          // Always show last page
                          if (totalPages > 1) pages.push(totalPages)
                          
                          return (
                            <>
                              <button
                                onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                                disabled={previewPage === 1}
                                className="px-2 py-1 text-xs border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Prev
                              </button>
                              {pages.map((page, idx) => (
                                <div key={idx}>
                                  {page === '...' ? (
                                    <span className="px-1 text-muted-foreground">...</span>
                                  ) : (
                                    <button
                                      onClick={() => setPreviewPage(Number(page))}
                                      className={cn(
                                        "px-2 py-1 text-xs border rounded transition-colors",
                                        page === previewPage
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "hover:bg-muted"
                                      )}
                                    >
                                      {page}
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                onClick={() => setPreviewPage(prev => Math.min(Math.ceil(previewData.total_rows / PREVIEW_PAGE_SIZE), prev + 1))}
                                disabled={previewPage === Math.ceil(previewData.total_rows / PREVIEW_PAGE_SIZE)}
                                className="px-2 py-1 text-xs border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </>
                          )
                        })()}
                      </div>
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

            {activeTab === 'dq-report' && (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6">
                  {dqReportLoading && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading DQ report...</p>
                      </div>
                    </div>
                  )}

                  {dqReportError && (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                      <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Report Unavailable</h3>
                      <p className="text-muted-foreground max-w-md">{dqReportError}</p>
                    </div>
                  )}

                  {!dqReportLoading && !dqReportError && (
                    <>
                      {/* Download Button */}
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleDownloadDqReport} 
                          disabled={downloading}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          {downloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          Download Report
                        </Button>
                      </div>

                      {/* DQ Score Card */}
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-xl border">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">Data Quality Score</h3>
                            <p className="text-sm text-muted-foreground">Overall quality assessment</p>
                          </div>
                          <div className="text-right">
                            <div className="text-4xl font-bold text-primary">
                              {dqReport?.dq_score !== undefined ? `${dqReport.dq_score}%` : (file.dq_score !== undefined ? `${file.dq_score}%` : 'N/A')}
                            </div>
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "mt-1",
                                (dqReport?.dq_score ?? file.dq_score ?? 0) >= 90 ? "bg-emerald-100 text-emerald-700" :
                                (dqReport?.dq_score ?? file.dq_score ?? 0) >= 70 ? "bg-amber-100 text-amber-700" :
                                "bg-rose-100 text-rose-700"
                              )}
                            >
                              {(dqReport?.dq_score ?? file.dq_score ?? 0) >= 90 ? 'Excellent' :
                               (dqReport?.dq_score ?? file.dq_score ?? 0) >= 70 ? 'Good' : 'Needs Attention'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Detection Info */}
                      {(dqReport?.detected_erp || dqReport?.detected_entity) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {dqReport?.detected_erp && (
                            <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
                              <div className="p-2 bg-sky-100 rounded-lg">
                                <Cpu className="w-5 h-5 text-sky-600" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Detected ERP</p>
                                <p className="font-medium">{dqReport.detected_erp}</p>
                              </div>
                            </div>
                          )}
                          {dqReport?.detected_entity && (
                            <div className="bg-muted/50 p-4 rounded-lg border flex items-center gap-3">
                              <div className="p-2 bg-violet-100 rounded-lg">
                                <Database className="w-5 h-5 text-violet-600" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Detected Entity</p>
                                <p className="font-medium capitalize">{dqReport.detected_entity.replace(/_/g, ' ')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Row Distribution Pie Chart */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <PieChartIcon className="w-4 h-4" />
                          Row Distribution
                        </h4>
                        {(() => {
                          const total = dqReport?.rows_in ?? file.rows_in ?? 0
                          const clean = dqReport?.rows_clean ?? file.rows_clean ?? 0
                          const fixed = dqReport?.rows_fixed ?? file.rows_fixed ?? 0
                          const quarantined = dqReport?.rows_quarantined ?? file.rows_quarantined ?? 0
                          
                          const pieData = [
                            { name: 'Clean', value: clean, color: '#22C55E' },
                            { name: 'Fixed', value: fixed, color: '#EAB308' },
                            { name: 'Quarantined', value: quarantined, color: '#EF4444' },
                          ].filter(d => d.value > 0)

                          if (pieData.length === 0) {
                            return (
                              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                                No data available
                              </div>
                            )
                          }

                          return (
                            <div className="bg-muted/30 rounded-lg p-6">
                              {/* Total rows centered at top */}
                              <div className="text-center mb-4">
                                <p className="text-3xl font-bold">{total.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">Total Rows</p>
                              </div>
                              
                              {/* Pie Chart centered */}
                              <div className="flex justify-center">
                                <div style={{ width: 220, height: 220 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={85}
                                        paddingAngle={3}
                                        dataKey="value"
                                      >
                                        {pieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                      </Pie>
                                      <Tooltip 
                                        formatter={(value: number) => [value.toLocaleString(), 'Rows']}
                                        contentStyle={{ 
                                          borderRadius: '8px', 
                                          border: '1px solid hsl(var(--border))',
                                          backgroundColor: 'hsl(var(--background))',
                                          padding: '8px 12px',
                                          fontSize: '13px'
                                        }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                              
                              {/* Legend below chart */}
                              <div className="flex justify-center gap-6 mt-4">
                                {pieData.map((item) => (
                                  <div key={item.name} className="flex flex-col items-center">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span className="text-sm font-medium">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {item.value.toLocaleString()} ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Top Violations */}
                      {(() => {
                        const topViolations = dqReport?.top_violations
                          ?? (dqReport?.violation_counts
                            ? Object.entries(dqReport.violation_counts)
                                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                                .slice(0, 5)
                                .map(([violation, count]) => ({ violation, count }))
                            : [])

                        if (!topViolations || topViolations.length === 0) return null

                        return (
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              Top Violations
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {topViolations.map((item) => (
                                <div key={item.violation} className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
                                  <span className="text-sm truncate" title={item.violation}>
                                    {item.violation.replace(/_/g, ' ')}
                                  </span>
                                  <Badge variant="secondary">{item.count.toLocaleString()}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Row-wise Outstanding Issues */}
                      {issues && issues.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-medium flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Outstanding Issues
                              </h4>
                              <Badge variant="secondary">
                                Showing {issues.length.toLocaleString()} of {(issuesTotal ?? issues.length).toLocaleString()}
                              </Badge>
                              {issuesNextOffset !== null && (
                                <Badge variant="outline">More available</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              {Object.keys(availableViolations).length > 0 && (
                                <div className="flex flex-wrap gap-2 items-center">
                                  {Object.entries(availableViolations).map(([code, count]) => (
                                    <label key={code} className="flex items-center gap-1 text-xs">
                                      <Checkbox
                                        checked={selectedViolations.has(code)}
                                        onCheckedChange={(checked) => {
                                          const next = new Set(selectedViolations)
                                          if (checked) next.add(code); else next.delete(code)
                                          setSelectedViolations(next)
                                        }}
                                      />
                                      <span className="truncate max-w-[140px]" title={code}>{code}</span>
                                      <Badge variant="outline" className="text-[10px]">{count}</Badge>
                                    </label>
                                  ))}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => fetchIssues(true)}
                                    disabled={issuesLoading}
                                  >
                                    {issuesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply filters'}
                                  </Button>
                                </div>
                              )}
                              {issuesNextOffset !== null && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => fetchIssues(false)}
                                  disabled={issuesLoading}
                                >
                                  {issuesLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Load more'}
                                </Button>
                              )}
                            </div>
                          </div>

                          <RowWiseIssues
                            issues={issues}
                            total={issuesTotal || undefined}
                            hasMore={issuesNextOffset !== null}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Row-wise Issues Component with smart grouping and expandable view
function RowWiseIssues({
  issues,
  total,
  hasMore,
}: {
  issues: { row: number; column: string; violation: string; value: any }[]
  total?: number
  hasMore?: boolean
}) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Group issues by row
  const issuesByRow = issues.reduce((acc, issue) => {
    if (!acc[issue.row]) {
      acc[issue.row] = []
    }
    acc[issue.row].push(issue)
    return acc
  }, {} as Record<number, typeof issues>)

  // Group issues by violation type for summary
  const issuesByType = issues.reduce((acc, issue) => {
    if (!acc[issue.violation]) {
      acc[issue.violation] = 0
    }
    acc[issue.violation]++
    return acc
  }, {} as Record<string, number>)

  const toggleRow = (row: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(row)) {
      newExpanded.delete(row)
    } else {
      newExpanded.add(row)
    }
    setExpandedRows(newExpanded)
  }

  const expandAll = () => {
    setExpandedRows(new Set(Object.keys(issuesByRow).map(Number)))
  }

  const collapseAll = () => {
    setExpandedRows(new Set())
  }

  const getViolationColor = (violation: string) => {
    if (violation.includes('missing') || violation.includes('required')) return 'text-red-500 bg-red-500/10 border-red-500/20'
    if (violation.includes('invalid') || violation.includes('duplicate')) return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
    if (violation.includes('format') || violation.includes('type')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
    return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Outstanding Issues
          <Badge variant="secondary" className="bg-red-500/10 text-red-500">
            {issues.length} issues in {Object.keys(issuesByRow).length} rows
          </Badge>
        </h4>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
            Collapse All
          </Button>
        </div>
      </div>

      {/* Sampling note */}
      {(hasMore || (total && total > issues.length)) && (
        <div className="text-xs text-muted-foreground">
          Showing {issues.length.toLocaleString()} of {(total ?? issues.length).toLocaleString()} issues. 
          {hasMore ? " Load more from backend to see full list." : ""}
        </div>
      )}

      {/* Issue Type Summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(issuesByType).map(([type, count]) => (
          <Badge key={type} variant="outline" className={cn("text-xs", getViolationColor(type))}>
            {type.replace(/_/g, ' ')}: {count}
          </Badge>
        ))}
      </div>

      {/* Row-wise expandable list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {Object.entries(issuesByRow).map(([rowNum, rowIssues]) => (
          <Collapsible 
            key={rowNum} 
            open={expandedRows.has(Number(rowNum))}
            onOpenChange={() => toggleRow(Number(rowNum))}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/70 transition-colors">
                <div className="flex items-center gap-3">
                  {expandedRows.has(Number(rowNum)) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Badge variant="outline" className="font-mono">Row {rowNum}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {rowIssues.length} {rowIssues.length === 1 ? 'issue' : 'issues'}
                  </span>
                </div>
                <div className="flex gap-1">
                  {rowIssues.slice(0, 3).map((issue, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className={cn("text-[10px] px-1.5", getViolationColor(issue.violation))}
                    >
                      {issue.column}
                    </Badge>
                  ))}
                  {rowIssues.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5">
                      +{rowIssues.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 ml-7 space-y-2">
                {rowIssues.map((issue, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-3 rounded-lg border-l-4 bg-muted/30",
                      issue.violation.includes('missing') || issue.violation.includes('required') ? 'border-l-red-500' :
                      issue.violation.includes('invalid') || issue.violation.includes('duplicate') ? 'border-l-orange-500' :
                      issue.violation.includes('format') ? 'border-l-yellow-500' : 'border-l-blue-500'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">{issue.column}</code>
                          <Badge variant="outline" className={cn("text-xs", getViolationColor(issue.violation))}>
                            {issue.violation.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Value: <code className="bg-muted px-1 rounded">{issue.value === null ? 'null' : issue.value === '' ? '(empty)' : String(issue.value)}</code>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}
