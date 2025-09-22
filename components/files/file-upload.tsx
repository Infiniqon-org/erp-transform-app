"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FileUploadProps {
  onFileUploaded?: (file: File) => void
  uploadFile?: (file: File) => Promise<any>
  maxFileSize?: number // in MB
  acceptedTypes?: string[]
}

export function FileUpload({ onFileUploaded, uploadFile: externalUploadFile, maxFileSize = 50, acceptedTypes = ['.csv', '.xlsx', '.xls', '.json', '.parquet'] }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    file: File
    progress: number
    status: 'uploading' | 'completed' | 'error'
    error?: string
  }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size exceeds ${maxFileSize}MB limit`
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(fileExtension)) {
      return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`
    }

    return null
  }

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      toast({
        title: "File validation failed",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    setUploadingFiles(prev => [...prev, {
      file,
      progress: 0,
      status: 'uploading'
    }])

    try {
      // Start progress tracking
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map(item =>
          item.file === file && item.status === 'uploading'
            ? { ...item, progress: Math.min(item.progress + 10, 90) }
            : item
        ))
      }, 200)

      // Use external upload function if provided, otherwise simulate
      if (externalUploadFile) {
        await externalUploadFile(file)
      } else {
        // Fallback to simulation for backward compatibility
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      clearInterval(progressInterval)

      setUploadingFiles(prev => prev.map(item =>
        item.file === file
          ? { ...item, progress: 100, status: 'completed' }
          : item
      ))

      // Call the callback if provided AND no external upload function was used
      if (onFileUploaded && !externalUploadFile) {
        onFileUploaded(file)
      }

      // Remove from uploading list after a delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(item => item.file !== file))
      }, 2000)

    } catch (error) {
      setUploadingFiles(prev => prev.map(item =>
        item.file === file
          ? { ...item, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : item
      ))

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
    }
  }, [externalUploadFile, onFileUploaded, toast])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return

    const validFiles: File[] = []
    Array.from(files).forEach(file => {
      const validationError = validateFile(file)
      if (!validationError) {
        validFiles.push(file)
      } else {
        toast({
          title: "File validation failed",
          description: `${file.name}: ${validationError}`,
          variant: "destructive",
        })
      }
    })

    setSelectedFiles(prev => [...prev, ...validFiles])
    validFiles.forEach(file => uploadFile(file))
  }, [uploadFile, toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFiles])

  const removeFile = (fileToRemove: File) => {
    setSelectedFiles(prev => prev.filter(file => file !== fileToRemove))
    setUploadingFiles(prev => prev.filter(item => item.file !== fileToRemove))
  }

  const clearAll = () => {
    setSelectedFiles([])
    setUploadingFiles([])
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <h3 className="text-lg font-medium mb-2">
          {isDragOver ? 'Drop files here' : 'Upload ERP Files'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag & drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supported formats: {acceptedTypes.join(', ')} • Max size: {maxFileSize}MB
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>

          {selectedFiles.map((file, index) => {
            const uploadStatus = uploadingFiles.find(item => item.file === file)
            return (
              <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {uploadStatus && (
                    <div className="mt-2">
                      <Progress value={uploadStatus.progress} className="h-1" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {uploadStatus.status === 'uploading' && `Uploading... ${uploadStatus.progress}%`}
                        {uploadStatus.status === 'completed' && 'Upload completed'}
                        {uploadStatus.status === 'error' && `Error: ${uploadStatus.error}`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-1">
                  {uploadStatus?.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {uploadStatus?.status === 'completed' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {uploadStatus?.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(file)
                    }}
                    disabled={uploadStatus?.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Summary */}
      {uploadingFiles.length > 0 && (
        <Alert>
          <AlertDescription>
            {uploadingFiles.filter(f => f.status === 'completed').length} of {uploadingFiles.length} files uploaded successfully
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
