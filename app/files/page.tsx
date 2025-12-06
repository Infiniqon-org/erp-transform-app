"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Upload,
  FileText,
  RefreshCw,
  Loader2,
  Trash2,
  Eye,
  Search,
  Filter,
  Download,
  CloudUpload,
  Network,
  Play,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/providers/auth-provider"
import { AuthGuard } from "@/components/auth/auth-guard"
import { MainLayout } from "@/components/layout/main-layout"
import { fileManagementAPI, type FileStatusResponse } from "@/lib/api/file-management-api"
import { AWS_CONFIG } from "@/lib/aws-config"
import { cn, formatBytes, formatToIST } from "@/lib/utils"
import { DownloadFormatModal } from "@/components/files/download-format-modal"
import { ERPTransformationModal } from "@/components/files/erp-transformation-modal"
import { FileDetailsDialog } from "@/components/files/file-details-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import QuickBooksImport from "@/components/quickbooks/quickbooks-import"
import UnifiedBridgeImport from "@/components/unified-bridge/unified-bridge-import"
import { PushToERPModal } from "@/components/files/push-to-erp-modal"

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Uploaded", value: "UPLOADED" },
  { label: "Processed", value: "DQ_FIXED" },
  { label: "Processing", value: "DQ_RUNNING" },
  { label: "Queued", value: "QUEUED" },
  { label: "Failed", value: "FAILED" },
]

const SOURCE_OPTIONS = [
  { label: "Local Directory", value: "local" },
  { label: "Unified Bridge", value: "unified-bridge" },
  { label: "ERP", value: "erp" },
]

const ERP_OPTIONS = [
  { label: "QuickBooks Online", value: "quickbooks" },
  { label: "Oracle Fusion", value: "oracle" },
  { label: "SAP ERP", value: "sap" },
  { label: "Microsoft Dynamics", value: "dynamics" },
  { label: "NetSuite", value: "netsuite" },
  { label: "Workday", value: "workday" },
  { label: "Infor M3", value: "infor-m3" },
  { label: "Infor LN", value: "infor-ln" },
  { label: "Epicor Kinetic", value: "epicor" },
  { label: "QAD ERP", value: "qad" },
  { label: "IFS Cloud", value: "ifs" },
  { label: "Sage Intacct", value: "sage" },
]

export default function FilesPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <FilesPageContent />
      </MainLayout>
    </AuthGuard>
  )
}

function FilesPageContent() {
  const [files, setFiles] = useState<FileStatusResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [useAI, setUseAI] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileStatusResponse | null>(null)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadModalFile, setDownloadModalFile] = useState<FileStatusResponse | null>(null)
  const [erpModalConfig, setErpModalConfig] = useState<{
    file: FileStatusResponse
    format: "csv" | "excel" | "json"
  } | null>(null)
  const [showErpModal, setShowErpModal] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(null)
  const [pushQBModalOpen, setPushQBModalOpen] = useState(false)
  const [fileToPush, setFileToPush] = useState<FileStatusResponse | null>(null)
  const [activeSection, setActiveSection] = useState<"upload" | "explorer">("upload")
  const [selectedSource, setSelectedSource] = useState("local")
  const [selectedErp, setSelectedErp] = useState("quickbooks")
  const [sortField, setSortField] = useState<"name" | "score" | "status" | "uploaded" | "updated">("uploaded")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [useCustomRules, setUseCustomRules] = useState(false)
  const [customRulePrompt, setCustomRulePrompt] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { idToken } = useAuth()

  const loadFiles = useCallback(async () => {
    if (!idToken) return
    setLoading(true)
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      setFiles(response.items || [])
    } catch (error) {
      console.error("Error loading files:", error)
      toast({
        title: "Error",
        description: "Failed to load files",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [idToken, toast])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const filteredFiles = files
    .filter((file) => {
      const name = (file.original_filename || file.filename || "").toLowerCase()
      const matchesSearch = name.includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || file.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "name":
          const nameA = (a.original_filename || a.filename || "").toLowerCase()
          const nameB = (b.original_filename || b.filename || "").toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        case "score":
          const scoreA = a.dq_score ?? -1
          const scoreB = b.dq_score ?? -1
          comparison = scoreA - scoreB
          break
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "")
          break
        case "uploaded":
          const uploadedA = new Date(a.uploaded_at || a.created_at || 0).getTime()
          const uploadedB = new Date(b.uploaded_at || b.created_at || 0).getTime()
          comparison = uploadedA - uploadedB
          break
        case "updated":
          const updatedA = new Date(a.updated_at || a.status_timestamp || 0).getTime()
          const updatedB = new Date(b.updated_at || b.status_timestamp || 0).getTime()
          comparison = updatedA - updatedB
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

  const handleSort = (field: "name" | "score" | "status" | "uploaded" | "updated") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ field }: { field: "name" | "score" | "status" | "uploaded" | "updated" }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const handleFileUpload = async (file: File) => {
    if (!idToken) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      })
      return
    }

    const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`
    const validExtensions = [".csv", ".xlsx", ".xls", ".json"]

    if (!validExtensions.includes(extension)) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV, Excel, or JSON file",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const finalStatus = await fileManagementAPI.uploadFileComplete(
        file,
        idToken,
        useAI,
        (progress) => setUploadProgress(progress),
        (status) => {
          setFiles((prev) => {
            const existing = prev.find((f) => f.upload_id === status.upload_id)
            if (existing) {
              return prev.map((f) => (f.upload_id === status.upload_id ? status : f))
            }
            return [status, ...prev]
          })
        },
        false // Don't auto-process
      )

      toast({
        title: "Upload Complete",
        description: "File uploaded successfully. Click the play button to start processing.",
      })

      await loadFiles()
    } catch (error) {
      console.error("Upload failed:", error)
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true)
    } else if (event.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handleViewDetails = (file: FileStatusResponse) => {
    setSelectedFile(file)
    setDetailsOpen(true)
  }

  const handlePushToQuickBooks = (file: FileStatusResponse) => {
    setFileToPush(file)
    setPushQBModalOpen(true)
  }

  const handleQuickBooksImportComplete = async (uploadId: string) => {
    // Refresh file list - user will manually start processing
    loadFiles()
    toast({
      title: "Import Complete",
      description: "File imported successfully. Click the play button to start processing.",
    })
  }

  const handleStartProcessing = async (file: FileStatusResponse) => {
    if (!idToken) return

    try {
      await fileManagementAPI.startProcessing(file.upload_id, idToken, {
        use_custom_rules: useCustomRules,
        custom_rule_prompt: useCustomRules ? customRulePrompt.trim() || null : null,
      })
      toast({
        title: "Processing Started",
        description: `Starting data quality processing for ${file.original_filename || file.filename}...`,
      })
      loadFiles()
    } catch (error) {
      console.error("Processing failed:", error)
      toast({
        title: "Processing Failed",
        description: "Failed to start data quality processing",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = (file: FileStatusResponse) => {
    setFileToDelete(file)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!fileToDelete || !idToken) return

    setDeleting(fileToDelete.upload_id)
    setShowDeleteModal(false)

    try {
      await fileManagementAPI.deleteUpload(fileToDelete.upload_id, idToken)
      toast({
        title: "File deleted",
        description: "File removed successfully",
      })
      await loadFiles()
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Delete failed",
        description: "Unable to delete file",
        variant: "destructive",
      })
    } finally {
      setDeleting(null)
      setFileToDelete(null)
    }
  }

  const handleDownloadClick = (file: FileStatusResponse) => {
    setDownloadModalFile(file)
    setShowDownloadModal(true)
  }

  const handleFormatSelected = (format: "csv" | "excel" | "json", dataType: "original" | "clean") => {
    if (!downloadModalFile) return
    setShowDownloadModal(false)

    if (dataType === "clean") {
      setErpModalConfig({ file: downloadModalFile, format })
      setShowErpModal(true)
    } else {
      handleDirectDownload(downloadModalFile, format, dataType)
    }
  }

  const handleDirectDownload = async (
    file: FileStatusResponse,
    format: "csv" | "excel" | "json",
    dataType: "original" | "clean"
  ) => {
    if (!idToken) return

    setDownloadingFormat(`${file.upload_id}-${format}`)
    setDownloading(file.upload_id)

    try {
      const typeParam = format === "excel" ? "excel" : format === "json" ? "json" : "csv"
      const downloadUrl = `${AWS_CONFIG.API_BASE_URL}/files/${file.upload_id}/export?type=${typeParam}&data=${dataType}`

      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      })

      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)

      const blob = await response.blob()
      const baseFilename = (file.original_filename || file.filename || "file").replace(/\.[^/.]+$/, "")
      const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv"
      const dataSuffix = dataType === "original" ? "_original" : "_clean"
      const filename = `${baseFilename}${dataSuffix}${extension}`

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({ title: "Success", description: "File downloaded" })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download failed",
        description: "Unable to download file",
        variant: "destructive",
      })
    } finally {
      setDownloadingFormat(null)
      setDownloading(null)
    }
  }

  const handleDownloadWithErp = async (targetErp: string | null) => {
    if (!erpModalConfig || !idToken) return

    const { file, format } = erpModalConfig
    setDownloadingFormat(`${file.upload_id}-${format}`)
    setDownloading(file.upload_id)
    setShowErpModal(false)

    try {
      const typeParam = format === "excel" ? "excel" : format === "json" ? "json" : "csv"
      let downloadUrl = `${AWS_CONFIG.API_BASE_URL}/files/${file.upload_id}/export?type=${typeParam}&data=all`
      if (targetErp) downloadUrl += `&erp=${encodeURIComponent(targetErp)}`

      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${idToken}` },
      })

      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)

      const blob = await response.blob()
      const baseFilename = (file.original_filename || file.filename || "file").replace(/\.[^/.]+$/, "")
      const extension = format === "excel" ? ".xlsx" : format === "json" ? ".json" : ".csv"
      const erpSuffix = targetErp ? `_${targetErp.replace(/\s+/g, "_").toLowerCase()}` : ""
      const filename = `${baseFilename}_clean${erpSuffix}${extension}`

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: targetErp ? `Downloaded with ${targetErp}` : "File downloaded",
      })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download failed",
        description: "Unable to download file",
        variant: "destructive",
      })
    } finally {
      setDownloadingFormat(null)
      setDownloading(null)
      setErpModalConfig(null)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "DQ_FIXED":
      case "COMPLETED":
        return "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/30"
      case "FAILED":
      case "DQ_FAILED":
      case "REJECTED":
        return "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
      case "DQ_RUNNING":
      case "NORMALIZING":
        return "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-500/30"
      case "QUEUED":
      case "UPLOADED":
      case "DQ_DISPATCHED":
        return "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
      default:
        return "bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-500/30"
    }
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) {
      return "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400 border-green-300 dark:border-green-500/30"
    } else if (score >= 70) {
      return "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30"
    } else {
      return "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400 border-red-300 dark:border-red-500/30"
    }
  }

  const tableEmpty = filteredFiles.length === 0

  return (
    <TooltipProvider>
      <div className="space-y-4 p-3 sm:p-0">
        {/* Segmented Tab Navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border bg-muted p-1 flex-1 sm:flex-none">
            <button
              onClick={() => setActiveSection("upload")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none",
                activeSection === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden xs:inline">File</span> Upload
            </button>
            <button
              onClick={() => setActiveSection("explorer")}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-md px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all flex-1 sm:flex-none",
                activeSection === "explorer"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4" />
              <span className="hidden xs:inline">File</span> Explorer
              {files.length > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 sm:px-2 py-0.5 text-xs">
                  {files.length}
                </span>
              )}
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={loadFiles} disabled={loading} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {/* File Upload Section */}
        {activeSection === "upload" && (
          <div className="space-y-4">
            {/* Header Row: Source selector + ERP dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-muted-foreground shrink-0">Source:</span>
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSource === "erp" && (
                  <Select value={selectedErp} onValueChange={setSelectedErp}>
                    <SelectTrigger className="w-full sm:w-[180px] h-9">
                      <SelectValue placeholder="Select ERP" />
                    </SelectTrigger>
                    <SelectContent>
                      {ERP_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Custom Rules Section */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use-custom-rules"
                      checked={useCustomRules}
                      onCheckedChange={(checked) => setUseCustomRules(checked === true)}
                    />
                    <Label htmlFor="use-custom-rules" className="text-sm font-medium cursor-pointer">
                      Use custom rules (LLM)
                    </Label>
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Applied after deterministic + hybrid checks
                  </span>
                </div>
                <Textarea
                  className="min-h-[80px] text-sm resize-none"
                  disabled={!useCustomRules}
                  placeholder="Example: For any row where product_type is a TV and tv_cost < 10000, add invalid_tv_price and set status to Suspended."
                  value={customRulePrompt}
                  onChange={(e) => setCustomRulePrompt(e.target.value)}
                />
              </div>
            </div>

            {/* Content Area */}
            {selectedSource === "local" ? (
              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 transition-all cursor-pointer",
                  dragActive 
                    ? "border-primary bg-primary/5 scale-[1.01]" 
                    : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
                )}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-4 sm:gap-6 lg:gap-8">
                    <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 lg:h-20 lg:w-20 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-medium">Uploading...</p>
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mt-1 sm:mt-2">{uploadProgress}%</p>
                    </div>
                    <Progress value={uploadProgress} className="w-48 sm:w-60 lg:w-72 h-2 sm:h-3" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 sm:gap-4 lg:gap-6 text-center">
                    <div className="rounded-full bg-primary/10 p-4 sm:p-6 lg:p-8">
                      <Upload className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-primary" />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <p className="text-base sm:text-lg lg:text-xl font-medium">Upload your ERP data for transformation</p>
                      <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">Drag & drop or click to browse</p>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,.sql"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            ) : selectedSource === "erp" && selectedErp === "quickbooks" ? (
              <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
                <QuickBooksImport
                  onImportComplete={handleQuickBooksImportComplete}
                  onNotification={(message, type) => {
                    toast({
                      title: type === "success" ? "Success" : "Error",
                      description: message,
                      variant: type === "error" ? "destructive" : "default",
                    })
                  }}
                />
              </div>
            ) : selectedSource === "unified-bridge" ? (
              <div className="min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] rounded-xl border bg-card p-4">
                <UnifiedBridgeImport
                  onImportComplete={handleQuickBooksImportComplete}
                  onNotification={(message, type) => {
                    toast({
                      title: type === "success" ? "Success" : "Error",
                      description: message,
                      variant: type === "error" ? "destructive" : "default",
                    })
                  }}
                />
              </div>
            ) : selectedSource === "erp" ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-6 sm:p-12 lg:p-20 border-2 border-dashed rounded-xl bg-muted/5">
                <div className="rounded-full bg-muted p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8">
                  <Network className="h-8 w-8 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl lg:text-2xl font-medium mb-2 sm:mb-3 lg:mb-4 text-center">
                  {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
                </h3>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-6 sm:mb-8 lg:mb-10 max-w-lg text-center px-4">
                  Connect your {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label} account to import data directly.
                </p>
                <Button disabled size="lg" className="px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base">Connect</Button>
              </div>
            ) : null}
          </div>
        )}

        {/* File Explorer Section */}
        {activeSection === "explorer" && (
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-9 w-full sm:w-48 pl-8 text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-32 sm:w-36 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(searchQuery || statusFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 shrink-0"
                    onClick={() => { setSearchQuery(""); setStatusFilter("all") }}
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead 
                        className="text-xs cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <span className="flex items-center">File<SortIcon field="name" /></span>
                      </TableHead>
                      <TableHead 
                        className="text-xs hidden xl:table-cell cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("score")}
                      >
                        <span className="flex items-center">Score<SortIcon field="score" /></span>
                      </TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Rows</TableHead>
                      <TableHead 
                        className="text-xs cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("status")}
                      >
                        <span className="flex items-center">Status<SortIcon field="status" /></span>
                      </TableHead>
                      <TableHead 
                        className="text-xs hidden lg:table-cell cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("uploaded")}
                      >
                        <span className="flex items-center">Uploaded<SortIcon field="uploaded" /></span>
                      </TableHead>
                      <TableHead 
                        className="text-xs hidden lg:table-cell cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort("updated")}
                      >
                        <span className="flex items-center">Updated<SortIcon field="updated" /></span>
                      </TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && files.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && tableEmpty && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                          <FileText className="h-6 w-6 mx-auto mb-1 opacity-50" />
                          No files found
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredFiles.map((file) => (
                      <TableRow key={file.upload_id} className="hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <p className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[200px]">
                              {file.original_filename || file.filename || "Untitled"}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {formatBytes(file.input_size_bytes || file.file_size || 0)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {typeof file.dq_score === "number" ? (
                            <Badge variant="outline" className={cn(
                              "w-[58px] justify-center text-xs tabular-nums font-medium",
                              getScoreBadgeColor(file.dq_score)
                            )}>
                              {file.dq_score.toFixed(1)}%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular-nums">
                          {file.rows_clean || file.rows_in || 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs font-medium whitespace-nowrap px-2 py-0.5", getStatusBadgeColor(file.status))}>
                            {file.status || "UNKNOWN"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground tabular-nums">
                          {formatToIST(file.uploaded_at || file.created_at)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground tabular-nums">
                          {formatToIST(file.updated_at || file.status_timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5 sm:gap-1">
                            {(file.status === "UPLOADED" || file.status === "DQ_FAILED" || file.status === "FAILED" || file.status === "UPLOAD_FAILED") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 sm:h-8 sm:w-8 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => handleStartProcessing(file)}
                                  >
                                    <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Start Processing</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleViewDetails(file)}>
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => handleDownloadClick(file)}
                                  disabled={downloading === file.upload_id}
                                >
                                  {downloading === file.upload_id ? (
                                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                            {(file.status === "DQ_FIXED" || file.status === "COMPLETED") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 sm:h-8 sm:w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handlePushToQuickBooks(file)}
                                  >
                                    <CloudUpload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Push to ERP</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8"
                                  onClick={() => handleDeleteClick(file)}
                                  disabled={deleting === file.upload_id}
                                >
                                  {deleting === file.upload_id ? (
                                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredFiles.length > 0 && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-t">
                  Timestamps in IST (UTC+5:30)
                </p>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete file?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove {fileToDelete?.original_filename || fileToDelete?.filename}. The action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <FileDetailsDialog file={selectedFile} open={detailsOpen} onOpenChange={setDetailsOpen} />

        <DownloadFormatModal
          open={showDownloadModal}
          onOpenChange={setShowDownloadModal}
          file={downloadModalFile}
          onDownload={handleFormatSelected}
          downloading={Boolean(downloadingFormat)}
        />

        <ERPTransformationModal
          open={showErpModal}
          onOpenChange={setShowErpModal}
          onDownload={handleDownloadWithErp}
          downloading={Boolean(downloadingFormat)}
          filename={
            downloadModalFile?.original_filename ||
            downloadModalFile?.filename ||
            erpModalConfig?.file.original_filename ||
            erpModalConfig?.file.filename ||
            "selected file"
          }
        />

        <PushToERPModal
          open={pushQBModalOpen}
          onOpenChange={setPushQBModalOpen}
          file={fileToPush}
          onSuccess={() => {
            toast({
              title: "Success",
              description: "Data pushed to ERP successfully",
            })
            setPushQBModalOpen(false)
            setFileToPush(null)
          }}
          onError={(error) => {
            toast({
              title: "Push failed",
              description: error,
              variant: "destructive",
            })
          }}
        />
      </div>
    </TooltipProvider>
  )
}

