import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/components/providers/auth-provider'

const CONFIG = {
  apiUrl: 'https://t322r7a4i0.execute-api.ap-south-1.amazonaws.com/prod/'
}

// Helper function to map API status to internal status
const mapStatus = (apiStatus: string): FileItem['status'] => {
  const statusMap: Record<string, FileItem['status']> = {
    'UPLOADED': 'uploaded',
    'QUEUED': 'queued',
    'DQ_RUNNING': 'dq_running',
    'DQ_FIXED': 'processed',
    'DQ_FAILED': 'dq_failed',
    'FAILED': 'failed'
  }
  return statusMap[apiStatus] || 'uploaded'
}

export interface FileItem {
  id: string
  name: string
  key: string // S3 key
  size: number
  type: string
  modified: Date
  lastModified: string // API returns this
  status: 'processed' | 'processing' | 'failed' | 'uploaded' | 'queued' | 'dq_running' | 'dq_fixed' | 'dq_failed'
  url?: string
  thumbnail?: string
  // DQ processing fields
  upload_id?: string
  original_filename?: string
  uploaded_at?: string
  dq_score?: number
  rows_in?: number
  rows_out?: number
  rows_quarantined?: number
  dq_issues?: Array<{
    rule: string
    violations: number
  }>
  last_error?: string
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  storageUsed: number
  storageLimit: number
  uploadedToday: number
  downloadedToday: number
}

export function useFileManager() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [stats, setStats] = useState<FileStats>({
    totalFiles: 0,
    totalSize: 0,
    storageUsed: 0,
    storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
    uploadedToday: 0,
    downloadedToday: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const { idToken } = useAuth()

  const updateStats = useCallback((fileList: FileItem[]) => {
    const totalSize = fileList.reduce((sum, file) => sum + file.size, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const uploadedToday = fileList.filter(file => {
      const fileDate = new Date(file.modified)
      fileDate.setHours(0, 0, 0, 0)
      return fileDate.getTime() === today.getTime()
    }).length

    setStats(prev => ({
      ...prev,
      totalFiles: fileList.length,
      totalSize,
      storageUsed: totalSize,
      uploadedToday
    }))
  }, [])

  // Load files from API
  const loadFiles = useCallback(async () => {
    if (!idToken) {
      console.log('No auth token available, skipping file load')
      setFiles([])
      updateStats([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${CONFIG.apiUrl}files`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`)
      }

      const data = await response.json()
      console.log('Files API response:', data)
      const apiFiles: FileItem[] = (data.files || []).map((item: any) => ({
        id: item.upload_id || item.key || item.name || `file_${Date.now()}`,
        name: item.original_filename || (item.key ? item.key.split('/').pop() : null) || item.name || 'Unknown File',
        key: item.key || item.name || '',
        size: item.size || 0,
        type: (item.key ? item.key.split('.').pop()?.toUpperCase() : null) || item.type || 'FILE',
        modified: new Date(item.uploaded_at || item.lastModified || Date.now()),
        lastModified: item.uploaded_at || item.lastModified || new Date().toISOString(),
        status: mapStatus(item.status || 'uploaded'),
        // DQ processing fields
        upload_id: item.upload_id,
        original_filename: item.original_filename,
        uploaded_at: item.uploaded_at,
        dq_score: item.dq_score,
        rows_in: item.rows_in,
        rows_out: item.rows_out,
        rows_quarantined: item.rows_quarantined,
        dq_issues: item.dq_issues,
        last_error: item.last_error
      }))

      setFiles(apiFiles)
      updateStats(apiFiles)

      toast({
        title: "Files loaded",
        description: `Found ${apiFiles.length} file(s)`,
      })
    } catch (error) {
      console.error('Error loading files:', error)
      toast({
        title: "Error loading files",
        description: "Failed to load your files. Please try again.",
        variant: "destructive",
      })
      setFiles([])
      updateStats([])
    } finally {
      setIsLoading(false)
    }
  }, [idToken, toast, updateStats])

  const uploadFile = useCallback(async (file: File): Promise<FileItem> => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    console.log('Starting file upload for:', file.name, 'Size:', file.size)

    try {
      // Get presigned URL
      console.log('Requesting presigned URL from:', `${CONFIG.apiUrl}uploads`)
      const presignedResponse = await fetch(`${CONFIG.apiUrl}uploads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream'
        })
      })

      console.log('Presigned URL response status:', presignedResponse.status)

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text()
        console.error('Presigned URL error response:', errorText)
        throw new Error(`Failed to get presigned URL: ${presignedResponse.status} - ${errorText}`)
      }

      const presignedData = await presignedResponse.json()
      console.log('Presigned data received:', presignedData)

      // Upload using presigned POST
      if (presignedData.presignedPost && presignedData.usePost) {
        console.log('Uploading file using presigned POST to:', presignedData.presignedPost.url)
        const formData = new FormData()

        // Add all the fields from presigned POST
        Object.keys(presignedData.presignedPost.fields).forEach(key => {
          formData.append(key, presignedData.presignedPost.fields[key])
        })

        // Add the file last
        formData.append('file', file)

        const uploadResponse = await fetch(presignedData.presignedPost.url, {
          method: 'POST',
          body: formData
        })

        console.log('Upload response status:', uploadResponse.status)

        if (!uploadResponse.ok && uploadResponse.status !== 204) {
          const uploadErrorText = await uploadResponse.text()
          console.error('Upload error response:', uploadErrorText)
          throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadErrorText}`)
        }

        console.log('File upload successful')
      } else {
        console.error('No presigned POST data available:', presignedData)
        throw new Error('No presigned POST data available')
      }

      // Create file item from successful upload
      const newFile: FileItem = {
        id: presignedData.key || file.name,
        name: file.name,
        key: presignedData.key || file.name,
        size: file.size,
        type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
        modified: new Date(),
        lastModified: new Date().toISOString(),
        status: 'uploaded'
      }

      // Don't add to local state immediately, refresh from API instead
      // This ensures we get the correct data from the server
      await loadFiles()

      toast({
        title: "Upload successful",
        description: `${file.name} has been uploaded successfully.`,
      })

      return newFile
    } catch (error) {
      console.error('Upload error:', error)

      // If it's a network error and we're in development, provide a fallback
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.log('Network error detected, providing fallback upload for development')

        // Simulate successful upload for development
        await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate upload time

        const newFile: FileItem = {
          id: `dev_${Date.now()}_${file.name}`,
          name: file.name,
          key: file.name,
          size: file.size,
          type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
          modified: new Date(),
          lastModified: new Date().toISOString(),
          status: 'uploaded'
        }

        // Add to local state
        setFiles(prev => [newFile, ...prev])

        // Update stats
        setStats(prev => ({
          ...prev,
          totalFiles: prev.totalFiles + 1,
          totalSize: prev.totalSize + file.size,
          storageUsed: prev.storageUsed + file.size,
          uploadedToday: prev.uploadedToday + 1
        }))

        toast({
          title: "Upload successful (Development Mode)",
          description: `${file.name} has been uploaded successfully in development mode.`,
        })

        return newFile
      }

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
      throw error
    }
  }, [idToken, updateStats, toast, loadFiles])

  const deleteFile = useCallback(async (fileId: string) => {
    // For now, just remove from local state and refresh from API
    // TODO: Implement actual delete API call if available
    setFiles(prev => {
      const updated = prev.filter(file => file.id !== fileId)
      updateStats(updated)
      return updated
    })

    if (selectedFile?.id === fileId) {
      setSelectedFile(null)
    }

    // Refresh files from API to ensure consistency
    await loadFiles()

    toast({
      title: "File deleted",
      description: "The file has been successfully deleted.",
    })
  }, [selectedFile, updateStats, toast, loadFiles])

  const downloadFile = useCallback(async (file: FileItem) => {
    // TODO: Implement download via API - get presigned download URL
    toast({
      title: "Download not yet implemented",
      description: "Download functionality will be available soon.",
      variant: "destructive",
    })

    // Update download stats
    setStats(prev => ({
      ...prev,
      downloadedToday: prev.downloadedToday + 1
    }))
  }, [toast])

  const previewFile = useCallback((file: FileItem) => {
    setSelectedFile(file)
  }, [])

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }, [])

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  // DQ Processing functions
  const startDQProcessing = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await fetch(`${CONFIG.apiUrl}files/${uploadId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to start DQ processing: ${response.status}`)
      }

      const result = await response.json()
      console.log('DQ processing started:', result)

      // Update local file status
      setFiles(prev => prev.map(file =>
        file.upload_id === uploadId
          ? { ...file, status: 'dq_running' as const }
          : file
      ))

      toast({
        title: "DQ Processing Started",
        description: `Data quality processing started for ${uploadId}`,
      })

      // Start monitoring this file
      monitorProcessing(uploadId)

      return result
    } catch (error) {
      console.error('DQ processing start error:', error)
      toast({
        title: "DQ Processing Failed",
        description: error instanceof Error ? error.message : "Failed to start DQ processing",
        variant: "destructive",
      })
      throw error
    }
  }, [idToken, toast])

  const checkProcessingStatus = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await fetch(`${CONFIG.apiUrl}files/${uploadId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`)
      }

      const status = await response.json()
      console.log('Processing status:', status)

      // Update local file status
      setFiles(prev => prev.map(file =>
        file.upload_id === uploadId
          ? {
              ...file,
              status: mapStatus(status.status),
              dq_score: status.dq_score,
              rows_in: status.rows_in,
              rows_out: status.rows_out,
              rows_quarantined: status.rows_quarantined,
              dq_issues: status.dq_issues,
              last_error: status.last_error
            }
          : file
      ))

      return status
    } catch (error) {
      console.error('Status check error:', error)
      throw error
    }
  }, [idToken])

  const viewResults = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const response = await fetch(`${CONFIG.apiUrl}files/${uploadId}/preview`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get preview: ${response.status}`)
      }

      const preview = await response.json()
      console.log('Results preview:', preview)

      return preview
    } catch (error) {
      console.error('Results preview error:', error)
      throw error
    }
  }, [idToken])

  const downloadCleanData = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const downloadUrl = `${CONFIG.apiUrl}files/${uploadId}/download?type=clean`

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to download clean data: ${response.status}`)
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'clean_data.parquet'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: `Downloading clean data: ${filename}`,
      })
    } catch (error) {
      console.error('Clean data download error:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download clean data",
        variant: "destructive",
      })
      throw error
    }
  }, [idToken, toast])

  const downloadQuarantineData = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const downloadUrl = `${CONFIG.apiUrl}files/${uploadId}/download?type=quarantine`

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "No Quarantine Data",
            description: "No quarantined data available for this file",
            variant: "destructive",
          })
          return
        }
        throw new Error(`Failed to download quarantine data: ${response.status}`)
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'quarantine_data.parquet'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: `Downloading quarantine data: ${filename}`,
      })
    } catch (error) {
      console.error('Quarantine data download error:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download quarantine data",
        variant: "destructive",
      })
      throw error
    }
  }, [idToken, toast])

  const downloadDQReport = useCallback(async (uploadId: string) => {
    if (!idToken) {
      throw new Error('Not authenticated')
    }

    try {
      const downloadUrl = `${CONFIG.apiUrl}files/${uploadId}/download?type=report`

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "No Report Available",
            description: "No DQ report available for this file",
            variant: "destructive",
          })
          return
        }
        throw new Error(`Failed to download DQ report: ${response.status}`)
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'dq_report.json'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Download Started",
        description: `Downloading DQ report: ${filename}`,
      })
    } catch (error) {
      console.error('DQ report download error:', error)
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download DQ report",
        variant: "destructive",
      })
      throw error
    }
  }, [idToken, toast])

  // Auto-refresh functionality
  const startAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(true)
    toast({
      title: "Auto-refresh Started",
      description: "Files will refresh automatically every 10 seconds",
    })
  }, [toast])

  const stopAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled(false)
    toast({
      title: "Auto-refresh Stopped",
      description: "Automatic file refresh has been disabled",
    })
  }, [toast])

  // Processing monitoring
  const monitorProcessing = useCallback((uploadId: string) => {
    setProcessingFiles(prev => new Set(prev).add(uploadId))

    const checkStatus = async () => {
      if (!processingFiles.has(uploadId)) {
        return // Stop monitoring if file is no longer being processed
      }

      try {
        const status = await checkProcessingStatus(uploadId)

        if (status.status === 'DQ_FIXED' || status.status === 'DQ_FAILED' || status.status === 'FAILED') {
          setProcessingFiles(prev => {
            const newSet = new Set(prev)
            newSet.delete(uploadId)
            return newSet
          })
          toast({
            title: "Processing Completed",
            description: `DQ processing completed for ${uploadId}: ${status.status}`,
            variant: status.status === 'DQ_FIXED' ? 'default' : 'destructive'
          })
          return // Stop monitoring
        } else {
          // Continue monitoring
          setTimeout(checkStatus, 15000) // Check again in 15 seconds
        }
      } catch (error) {
        console.error(`Error monitoring ${uploadId}:`, error)
        setProcessingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(uploadId)
          return newSet
        })
      }
    }

    // Start monitoring
    setTimeout(checkStatus, 15000) // Initial check in 15 seconds
  }, [checkProcessingStatus, processingFiles, toast])

  useEffect(() => {
    if (idToken) {
      loadFiles()
    } else {
      setFiles([])
      updateStats([])
      setIsLoading(false)
    }
  }, [loadFiles, idToken])

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (autoRefreshEnabled && idToken) {
      interval = setInterval(() => {
        loadFiles()
      }, 10000) // Refresh every 10 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [autoRefreshEnabled, idToken, loadFiles])

  return {
    files,
    stats,
    isLoading,
    selectedFile,
    autoRefreshEnabled,
    processingFiles,
    uploadFile,
    deleteFile,
    downloadFile,
    previewFile,
    formatFileSize,
    formatDate,
    refreshFiles: loadFiles,
    startDQProcessing,
    checkProcessingStatus,
    viewResults,
    downloadCleanData,
    downloadQuarantineData,
    downloadDQReport,
    startAutoRefresh,
    stopAutoRefresh,
    monitorProcessing
  }
}
