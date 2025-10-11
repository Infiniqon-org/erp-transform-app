"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, FileText, Loader2, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { fadeInUp, staggerContainer } from "@/components/ui/motion"

interface FileUploadProps {
  onFileUploaded?: (file: File) => void
  uploadFile?: (file: File) => Promise<any>
  maxFileSize?: number // in MB
  acceptedTypes?: string[]
}

export function FileUpload({ onFileUploaded, uploadFile: externalUploadFile, maxFileSize = 500, acceptedTypes = ['.csv', '.xlsx', '.xls', '.json', '.parquet'] }: FileUploadProps) {
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
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        animate={{
          borderColor: isDragOver ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.25)',
          backgroundColor: isDragOver ? 'hsl(var(--primary) / 0.05)' : 'transparent'
        }}
        transition={{ duration: 0.2 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <motion.div
          animate={{
            y: isDragOver ? [0, -5, 0] : 0,
            rotate: isDragOver ? [0, 5, -5, 0] : 0
          }}
          transition={{ duration: 0.5 }}
        >
          <Upload className={`mx-auto h-12 w-12 mb-4 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        </motion.div>
        <motion.h3
          className="text-lg font-medium mb-2"
          animate={{ scale: isDragOver ? 1.05 : 1 }}
          transition={{ duration: 0.2 }}
        >
          {isDragOver ? 'Drop files here' : 'Upload ERP Files'}
        </motion.h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag & drop files here or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Supported formats: {acceptedTypes.join(', ')} • Max size: {maxFileSize}MB
        </p>
      </motion.div>

      {/* Selected Files */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Selected Files ({selectedFiles.length})</h4>
              <Button variant="ghost" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>

            <motion.div
              className="space-y-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {selectedFiles.map((file, index) => {
                const uploadStatus = uploadingFiles.find(item => item.file === file)
                return (
                  <motion.div
                    key={`${file.name}-${file.size}`}
                    variants={fadeInUp}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center space-x-3 p-3 border rounded-lg bg-card/50"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <AnimatePresence>
                        {uploadStatus && (
                          <motion.div
                            className="mt-2"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Progress value={uploadStatus.progress} className="h-1" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {uploadStatus.status === 'uploading' && `Uploading... ${uploadStatus.progress}%`}
                              {uploadStatus.status === 'completed' && 'Upload completed'}
                              {uploadStatus.status === 'error' && `Error: ${uploadStatus.error}`}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center space-x-1">
                      <AnimatePresence>
                        {uploadStatus?.status === 'uploading' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          </motion.div>
                        )}
                        {uploadStatus?.status === 'completed' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </motion.div>
                        )}
                        {uploadStatus?.status === 'error' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
