"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  Upload, FileText, Eye, Download, RefreshCw, Loader2,
  Activity
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/providers/auth-provider'
import { AuthGuard } from '@/components/auth/auth-guard'
import { MainLayout } from '@/components/layout/main-layout'
import { fileManagementAPI, type FileStatusResponse } from '@/lib/api/file-management-api'
import { UploadSection } from '@/components/files/upload-section'
import { FilesSection } from '@/components/files/files-section'
import { MonitoringSection } from '@/components/files/monitoring-section'

// Parse CSV content into headers and rows
const parseCSV = (csvText: string) => {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows: Record<string, any>[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: Record<string, any> = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }
  
  return { headers, rows }
}

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
  const [selectedFile, setSelectedFile] = useState<FileStatusResponse | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [activeTab, setActiveTab] = useState('upload')
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()
  const { idToken } = useAuth()

  // Load files
  const loadFiles = useCallback(async () => {
    if (!idToken) return

    setLoading(true)
    try {
      const response = await fileManagementAPI.getUploads(idToken)
      
      // Preserve existing file_data when updating from API
      setFiles(prevFiles => {
        const apiFiles = response.items || []
        return apiFiles.map(apiFile => {
          const existingFile = prevFiles.find(f => f.upload_id === apiFile.upload_id)
          return existingFile?.file_data ? { ...apiFile, file_data: existingFile.file_data } : apiFile
        })
      })
      
      // Check if any file is currently processing
      const hasProcessing = (response.items || []).some(f => 
        ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status)
      )
      setProcessing(hasProcessing)
      
      toast({
        title: "Files loaded",
        description: `Found ${response.items?.length || 0} file(s)`,
      })
    } catch (error) {
      console.error('Error loading files:', error)
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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!idToken) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // Read the actual file content first
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsText(file)
      })

      // Parse the CSV data
      const parsedData = parseCSV(fileContent)

      // Start the upload process
      setProcessing(true)
      const finalStatus = await fileManagementAPI.uploadFileComplete(
        file,
        idToken,
        (progress: number) => setUploadProgress(progress),
        (status: FileStatusResponse) => {
          // Update file in list as status changes, and include file_data
          setFiles(prev => {
            const existing = prev.find(f => f.upload_id === status.upload_id)
            if (existing) {
              return prev.map(f => f.upload_id === status.upload_id ? { ...status, file_data: parsedData } : f)
            }
            return [...prev, { ...status, file_data: parsedData }]
          })
        }
      )

      // Show success toast for upload completion
      toast({
        title: "Upload Successful! ✅",
        description: `${file.name} has been uploaded successfully`,
      })

      // Switch to monitoring tab
      setActiveTab('monitor')

      // If processing completed successfully, show additional success
      if (finalStatus.status === 'DQ_FIXED' || finalStatus.status === 'COMPLETED') {
        toast({
          title: "Processing Complete! 🎉",
          description: `File processed successfully with DQ score: ${finalStatus.dq_score || 0}%`,
        })
      } else if (finalStatus.status === 'FAILED' || finalStatus.status === 'DQ_FAILED') {
        toast({
          title: "Processing Failed",
          description: "Sorry, processing failed. Please try again or contact support.",
          variant: "destructive",
        })
      }

      await loadFiles()
    } catch (error) {
      console.error('Upload failed:', error)
      toast({
        title: "Upload failed",
        description: "Sorry, the upload failed. Please try again or contact support.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setProcessing(false)
    }
  }

  // Handle file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        })
        return
      }
      handleFileUpload(file)
    }
  }

  // Handle drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  // Handle manual processing
  const handleProcess = async (file: FileStatusResponse) => {
    if (!idToken || processing) {
      toast({
        title: "Unable to Process",
        description: processing ? "Another file is currently being processed. Please wait." : "Not authenticated",
        variant: "destructive",
      })
      return
    }

    try {
      setProcessing(true)
      
      // Start processing
      await fileManagementAPI.startProcessing(file.upload_id, idToken)
      
      toast({
        title: "Processing Started",
        description: `Processing ${file.original_filename || file.filename}...`,
      })

      // Switch to monitoring tab
      setActiveTab('monitor')

      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await fileManagementAPI.getFileStatus(file.upload_id, idToken)
          
          // Update files list
          setFiles(prev => prev.map(f => 
            f.upload_id === file.upload_id ? status : f
          ))

          // Check if processing completed
          if (status.status === 'DQ_FIXED' || status.status === 'COMPLETED') {
            clearInterval(pollInterval)
            setProcessing(false)
            toast({
              title: "Processing Complete! 🎉",
              description: `File processed successfully with DQ score: ${status.dq_score || 0}%`,
            })
          } else if (status.status === 'FAILED' || status.status === 'DQ_FAILED') {
            clearInterval(pollInterval)
            setProcessing(false)
            toast({
              title: "Processing Failed",
              description: "Sorry, processing failed. Please try again or contact support.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error('Error polling status:', error)
        }
      }, 3000) // Poll every 3 seconds

      // Stop polling after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        setProcessing(false)
      }, 600000)

    } catch (error) {
      console.error('Process failed:', error)
      setProcessing(false)
      toast({
        title: "Processing Failed",
        description: "Sorry, unable to start processing. Please try again or contact support.",
        variant: "destructive",
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive",
        })
        return
      }
      handleFileUpload(file)
    }
  }

  // Handle preview
  const handlePreview = async (file: FileStatusResponse) => {
    if (!idToken) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      })
      return
    }

    try {
      let previewDataToSet: any = null

      // If file_data is not available, fetch it
      if (!file.file_data || !file.file_data.rows || file.file_data.rows.length === 0) {
        const previewResponse = await fileManagementAPI.getFilePreview(file.upload_id, idToken)
        
        // Validate API response structure
        if (previewResponse && 
            typeof previewResponse === 'object' &&
            Array.isArray(previewResponse.headers) && 
            previewResponse.headers.length > 0 &&
            Array.isArray(previewResponse.sample_data)) {
          previewDataToSet = previewResponse
        } else {
          console.error('Invalid API preview response:', previewResponse)
          throw new Error('Invalid preview data structure from API')
        }
      } else {
        // Use existing file_data - show ALL data, not sample
        const headers = file.file_data.headers || []
        const rows = file.file_data.rows || []
        
        if (!Array.isArray(headers) || !Array.isArray(rows)) {
          throw new Error('Invalid file data structure')
        }
        
        previewDataToSet = {
          upload_id: file.upload_id,
          headers: headers,
          sample_data: rows, // Show all rows, not sample
          total_rows: rows.length
        }
      }

      // Only set preview data if we have valid data
      if (previewDataToSet && previewDataToSet.headers && previewDataToSet.sample_data) {
        setPreviewData(previewDataToSet)
        setSelectedFile(file)
        toast({
          title: "Preview loaded",
          description: "File preview ready",
        })
      } else {
        throw new Error('No valid preview data available')
      }
    } catch (error) {
      console.error('Preview error:', error)
      toast({
        title: "Error",
        description: "Failed to load preview",
        variant: "destructive",
      })
    }
  }

  // Download file from API (gets processed file from S3)
  const handleDownload = async (file: FileStatusResponse, fileType: 'clean' | 'quarantine' | 'report' | 'original') => {
    if (!idToken) {
      toast({
        title: "Error",
        description: "Not authenticated",
        variant: "destructive",
      })
      return
    }

    setDownloading(`${file.upload_id}-${fileType}`)

    try {
      console.log(`Starting ${fileType} file download from API...`)

      // Map fileType to API parameters
      const dataTypeMap = {
        'clean': 'clean' as const,
        'quarantine': 'quarantine' as const,
        'report': 'raw' as const,
        'original': 'raw' as const,
      }
      const dataType = dataTypeMap[fileType]

      // Get the file blob from API
      const blob = await fileManagementAPI.downloadFile(file.upload_id, 'csv', dataType, idToken)

      console.log('File blob received:', { size: blob.size, type: blob.type })

      // Determine file extension based on type
      let extension = '.csv'
      if (fileType === 'report') extension = '.json'

      // Create filename
      const baseFilename = file.original_filename || file.filename
      const filename = `${baseFilename.replace(/\.[^/.]+$/, '')}_${fileType}${extension}`

      // Trigger download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `${fileType} file downloaded successfully!`,
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive",
      })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">File Management</h1>
          <p className="text-muted-foreground mt-1">
            Upload, process, and manage your data files
          </p>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="upload"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Upload className="w-4 h-4" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <FileText className="w-4 h-4" />
            File Management
          </TabsTrigger>
          <TabsTrigger
            value="monitor"
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Activity className="w-4 h-4" />
            Processing Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          <UploadSection
            uploading={uploading}
            uploadProgress={uploadProgress}
            dragActive={dragActive}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
          />
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <FilesSection
            files={files}
            loading={loading}
            selectedFile={selectedFile}
            previewData={previewData}
            downloading={downloading}
            processing={processing}
            onRefresh={loadFiles}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onProcess={handleProcess}
            onClosePreview={() => {
              setSelectedFile(null)
              setPreviewData(null)
            }}
            idToken={idToken}
          />
        </TabsContent>

        <TabsContent value="monitor" className="mt-6">
          <MonitoringSection files={files} />
        </TabsContent>
      </Tabs>
    </div>
  )
}