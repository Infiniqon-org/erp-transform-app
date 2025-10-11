// AWS Configuration - Correct API Gateway
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://t322r7a4i0.execute-api.ap-south-1.amazonaws.com/prod"

// API Endpoints - Based on actual backend API structure
const ENDPOINTS = {
  UPLOADS: '/uploads',                                    // POST - initialize upload
  FILES: '/files',                                        // GET - list all files
  FILES_PROCESS: (id: string) => `/files/${id}/process`, // POST - start processing
  FILES_STATUS: (id: string) => `/files/${id}/status`,   // GET - check status
  FILES_EXPORT: (id: string) => `/files/${id}/export`,   // GET - download files
}

// Response Types
export interface FileUploadInitResponse {
  upload_id: string
  url: string
  fields?: Record<string, string>
}

export interface FileStatusResponse {
  upload_id: string
  status: 'QUEUED' | 'DQ_RUNNING' | 'DQ_FIXED' | 'FAILED' | 'COMPLETED' | 'UPLOADING' | 'NORMALIZING' | 'DQ_FAILED' | 'UPLOAD_FAILED' | 'UPLOADED'
  filename: string
  original_filename?: string
  created_at: string
  uploaded_at?: string
  file_size?: number
  rows_in?: number
  rows_out?: number
  rows_quarantined?: number
  dq_score?: number | null
  dq_issues?: string[]
  execution_arn?: string
  processing_time?: number
  last_error?: string
  file_data?: {
    headers: string[]
    rows: Record<string, any>[]
  }
}

export interface FileListResponse {
  items: FileStatusResponse[]  // GET /uploads returns items
}

class FileManagementAPI {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    console.log('�� FileManagementAPI initialized:', this.baseURL)
  }

  private async makeRequest(endpoint: string, authToken: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    console.log('📡 API Request:', url, options.method || 'GET')

    try {
      const response = await fetch(url, { ...options, headers })
      console.log('📥 Response:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ API Error:', error)
      throw error
    }
  }

  async initUpload(filename: string, contentType: string, authToken: string): Promise<FileUploadInitResponse> {
    console.log('🔄 Initializing upload:', filename)
    return this.makeRequest(ENDPOINTS.UPLOADS, authToken, {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType })
    })
  }

  async getUploads(authToken: string): Promise<FileListResponse> {
    console.log('📋 Fetching files list from /files endpoint')
    try {
      const response = await this.makeRequest(ENDPOINTS.FILES, authToken, { method: 'GET' })
      // /files endpoint returns { files: [...], count: N }
      return {
        items: response.files || []
      }
    } catch (error) {
      console.error('❌ Failed to fetch files')
      return { items: [] }
    }
  }

  async getFileStatus(uploadId: string, authToken: string): Promise<FileStatusResponse> {
    return this.makeRequest(ENDPOINTS.FILES_STATUS(uploadId), authToken, { method: 'GET' })
  }

  async getFilePreview(uploadId: string, authToken: string): Promise<{ headers: string[], sample_data: any[], total_rows: number }> {
    // Fetch preview from S3 (top 20 rows)
    return this.getFilePreviewFromS3(uploadId, authToken, 20)
  }

  async startProcessing(uploadId: string, authToken: string): Promise<any> {
    console.log('▶️ Starting processing:', uploadId)
    return this.makeRequest(ENDPOINTS.FILES_PROCESS(uploadId), authToken, { 
      method: "POST"
    })
  }

  async downloadFile(uploadId: string, fileType: 'csv' | 'excel' | 'json', dataType: 'clean' | 'quarantine' | 'raw' | 'original', authToken: string): Promise<Blob> {
    const endpoint = `${ENDPOINTS.FILES_EXPORT(uploadId)}?type=${fileType}&data=${dataType}`
    const url = `${this.baseURL}${endpoint}`
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)
    return response.blob()
  }

  async getFilePreviewFromS3(uploadId: string, authToken: string, maxRows: number = 20): Promise<{ headers: string[], sample_data: any[], total_rows: number }> {
    try {
      // Download the original file from S3 via export endpoint
      const blob = await this.downloadFile(uploadId, 'csv', 'raw', authToken)
      const text = await blob.text()
      
      // Parse CSV
      const lines = text.trim().split('\n')
      if (lines.length === 0) {
        return { headers: [], sample_data: [], total_rows: 0 }
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const previewLines = lines.slice(1, Math.min(maxRows + 1, lines.length))
      
      const sample_data = previewLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, any> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })
      
      return {
        headers,
        sample_data,
        total_rows: lines.length - 1 // Exclude header
      }
    } catch (error) {
      console.error('❌ Failed to fetch file preview from S3:', error)
      return { headers: [], sample_data: [], total_rows: 0 }
    }
  }

  async uploadToS3(presignedUrl: string, file: File, onProgress?: (progress: number) => void): Promise<void> {
    if (!presignedUrl || presignedUrl === 'undefined') {
      console.error('❌ Invalid presigned URL:', presignedUrl)
      throw new Error('Invalid presigned URL received from server')
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100))
          }
        })
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          resolve()
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.open('PUT', presignedUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.send(file)
    })
  }

  async uploadToS3Post(presignedUrl: string, fields: Record<string, string>, file: File, onProgress?: (progress: number) => void): Promise<void> {
    if (!presignedUrl || presignedUrl === 'undefined') {
      console.error('❌ Invalid presigned URL:', presignedUrl)
      throw new Error('Invalid presigned URL received from server')
    }

    return new Promise((resolve, reject) => {
      const formData = new FormData()
      
      Object.keys(fields).forEach(key => formData.append(key, fields[key]))
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100))
          }
        })
      }

      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 204) {
          resolve()
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.open('POST', presignedUrl)
      xhr.send(formData)
    })
  }

  async pollFileStatus(uploadId: string, authToken: string, onStatusUpdate: (status: FileStatusResponse) => void, maxAttempts: number = 60, intervalMs: number = 2000): Promise<FileStatusResponse> {
    let attempts = 0

    const poll = async (): Promise<FileStatusResponse> => {
      if (attempts >= maxAttempts) throw new Error('Polling timeout')

      attempts++
      const status = await this.getFileStatus(uploadId, authToken)
      onStatusUpdate(status)

      const terminalStatuses = ['DQ_FIXED', 'FAILED', 'COMPLETED']
      if (terminalStatuses.includes(status.status)) {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      return poll()
    }

    return poll()
  }

  async uploadFileComplete(file: File, authToken: string, onProgress?: (progress: number) => void, onStatusUpdate?: (status: FileStatusResponse) => void): Promise<FileStatusResponse> {
    try {
      if (onProgress) onProgress(0)
      
      // Step 1: Initialize upload - backend returns presigned URL
      const initResponse = await this.initUpload(file.name, file.type || 'text/csv', authToken)
      console.log('📤 Upload initialized:', initResponse)
      if (onProgress) onProgress(10)

      // Step 2: Upload to S3 using presigned URL
      if (initResponse.url) {
        console.log('📤 Uploading to S3...')
        if (initResponse.fields) {
          await this.uploadToS3Post(initResponse.url, initResponse.fields, file, (s3Progress) => {
            if (onProgress) onProgress(10 + (s3Progress * 0.4))
          })
        } else {
          await this.uploadToS3(initResponse.url, file, (s3Progress) => {
            if (onProgress) onProgress(10 + (s3Progress * 0.4))
          })
        }
        console.log('✅ S3 upload complete')
      }
      if (onProgress) onProgress(50)

      // Step 3: Trigger processing using POST /files/{upload_id}/process
      try {
        await this.startProcessing(initResponse.upload_id, authToken)
        console.log('✅ Processing triggered')
        if (onProgress) onProgress(60)

        // Step 4: Poll for status
        const finalStatus = await this.pollFileStatus(initResponse.upload_id, authToken, (status) => {
          console.log('📊 Status update:', status.status)
          if (onStatusUpdate) onStatusUpdate(status)
          if (onProgress) {
            const statusProgress: Record<string, number> = {
              'UPLOADED': 70,
              'QUEUED': 75,
              'DQ_RUNNING': 85,
              'DQ_FIXED': 100,
              'FAILED': 100,
              'COMPLETED': 100,
            }
            onProgress(statusProgress[status.status] || 60)
          }
        }, 60, 2000)

        return finalStatus
      } catch (processingError) {
        console.error('⚠️ Processing failed but upload succeeded:', processingError)
        // Return a status object for successful upload even if processing fails
        return {
          upload_id: initResponse.upload_id,
          status: 'UPLOADED',
          filename: file.name,
          created_at: new Date().toISOString(),
          rows_in: undefined,
          rows_out: undefined,
          dq_score: undefined,
          execution_arn: undefined,
        } as FileStatusResponse
      }
    } catch (error) {
      console.error('❌ Upload workflow failed:', error)
      throw error
    }
  }
}

export const fileManagementAPI = new FileManagementAPI()
export default fileManagementAPI
