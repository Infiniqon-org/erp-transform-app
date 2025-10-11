"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Upload, FileText, CheckCircle, AlertCircle, Info, Database, Play, Archive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface UploadSectionProps {
  uploading: boolean
  uploadProgress: number
  dragActive: boolean
  onDrag: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadSection({
  uploading,
  uploadProgress,
  dragActive,
  onDrag,
  onDrop,
  onFileInput
}: UploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setSelectedFile(file)
      onFileInput(e)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

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
      setSelectedFile(file)
      onDrop(e)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Upload className="w-5 h-5" />
            Upload & Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
              dragActive
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDragEnter={onDrag}
            onDragLeave={onDrag}
            onDragOver={onDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={uploading}
            />

            {uploading ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative">
                    <motion.div
                      className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <Upload className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <p className="text-foreground font-medium mb-2">Processing {selectedFile?.name}</p>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-muted-foreground text-sm mt-2">{uploadProgress}% complete</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-foreground font-medium mb-2">
                    Drop your CSV file here or click to browse
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Files will be automatically processed through our data quality pipeline
                  </p>
                </div>
                <Button variant="outline" className="mt-4">
                  Choose File
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Pipeline Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Info className="w-5 h-5" />
            File Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Supported Formats</h4>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• CSV files only</li>
                <li>• UTF-8 encoding recommended</li>
                <li>• Maximum 100MB per file</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Processing Features</h4>
              <ul className="text-muted-foreground text-sm space-y-1">
                <li>• Automatic data quality scoring</li>
                <li>• Real-time processing status</li>
                <li>• Download clean & quarantine files</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}