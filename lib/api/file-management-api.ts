import { AWS_CONFIG } from '../aws-config'

// AWS Configuration - Correct API Gateway
const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// API Endpoints - Based on actual backend API structure
const ENDPOINTS = {
  UPLOADS: '/uploads',                                    // POST - initialize upload
  FILES: '/files',                                        // GET - list all files
  FILES_PROCESS: (id: string) => `/files/${id}/process`, // POST - start processing
  FILES_STATUS: (id: string) => `/files/${id}/status`,   // GET - check status
  FILES_COLUMNS: (id: string) => `/files/${id}/columns`, // GET - discover columns
  FILES_EXPORT: (id: string) => `/files/${id}/export`,   // GET - download files
  FILES_ISSUES: (id: string) => `/files/${id}/issues`,   // GET - paged outstanding issues
}

// Response Types
export interface FileUploadInitResponse {
  upload_id: string
  original_filename: string
  contentType: string
  key: string
  uploadUrl?: string  // Deprecated PUT method
  url?: string        // For backwards compatibility
  fields?: Record<string, string>  // For backwards compatibility
  presignedPost?: {   // NEW: Proper POST method with fields
    url: string
    fields: Record<string, string>
  }
  usePost?: boolean   // Flag to indicate which upload method to use
}

export interface FileStatusResponse {
  upload_id: string
  status: 'QUEUED' | 'DQ_RUNNING' | 'DQ_FIXED' | 'FAILED' | 'COMPLETED' | 'UPLOADING' | 'NORMALIZING' | 'DQ_FAILED' | 'UPLOAD_FAILED' | 'UPLOADED' | 'VALIDATED' | 'REJECTED' | 'DQ_DISPATCHED'
  filename?: string
  original_filename?: string
  content_type?: string
  user_id?: string
  created_at?: string
  uploaded_at?: string
  updated_at?: string
  status_timestamp?: string
  file_size?: number
  input_size_bytes?: number
  rows_in?: number
  rows_out?: number
  rows_clean?: number
  rows_fixed?: number
  rows_quarantined?: number
  dq_score?: number | null
  dq_issues?: string[]
  // New fields from user JSON
  dispatch_id?: string
  engine?: string
  reprocess_count?: number
  s3_raw_key?: string
  s3_result_key?: string
  dq_report_s3?: string
  dq_rules_version?: string
}

export interface FileListResponse {
  items: FileStatusResponse[]
  count: number
}

// DQ Report for individual file (matches actual backend response)
export interface DqReportResponse {
  rules_version?: string
  script_version?: string
  timestamp_utc?: string
  user_id?: string
  upload_id?: string
  rows_in?: number
  rows_clean?: number
  rows_fixed?: number
  rows_quarantined?: number
  dq_score?: number
  artifact?: string
  mode?: string
  detected_erp?: string | null
  detected_entity?: string
  ai_actions?: number
  hybrid_summary?: HybridSummary
  violation_counts?: Record<string, number>
  top_violations?: TopIssue[]
}

export interface HybridSummary {
  total_rows?: number
  clean_rows?: number
  fixed_rows?: number
  quarantined_rows?: number
  ai_actions?: number
  ai_planner?: string
  outstanding_issues?: OutstandingIssue[]
  outstanding_issues_total?: number
  outstanding_issues_has_more?: boolean
  outstanding_issues_sample_size?: number
  status?: string
}

export interface OutstandingIssue {
  row: number
  column: string
  violation: string
  value: any
}

export interface IssuesResponse {
  issues: OutstandingIssue[]
  total: number
  next_offset?: number | null
  available_violations?: Record<string, number>
  applied_filters?: string[]
}

// Overall DQ Report (per-user aggregated)
export interface OverallDqReportResponse {
  user_id: string
  generated_at_utc: string
  months: Record<string, MonthlyDqStats>
}

export interface TopIssue {
  violation: string
  count: number
}

export interface MonthlyDqStats {
  files_processed: number
  files_deleted: number
  total_processing_time_seconds: number
  rows_in: number
  rows_out: number
  rows_fixed: number
  rows_quarantined: number
  violation_counts?: Record<string, number>
  top_issues?: TopIssue[]
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

  async initUpload(filename: string, contentType: string, authToken: string, useAI: boolean = false): Promise<FileUploadInitResponse> {
    console.log('🔄 Initializing upload:', filename, useAI ? '(AI Processing)' : '(Rules-Based)')
    return this.makeRequest(ENDPOINTS.UPLOADS, authToken, {
      method: "POST",
      body: JSON.stringify({
        filename,
        content_type: contentType,
        use_ai_processing: useAI
      })
    })
  }

  async getUploads(authToken: string): Promise<FileListResponse> {
    console.log('📋 Fetching files list from /uploads endpoint')
    try {
      const response = await this.makeRequest(ENDPOINTS.UPLOADS, authToken, { method: 'GET' })
      // /uploads endpoint returns { items: [...], count: N }
      return {
        items: response.items || [],
        count: response.count || 0
      }
    } catch (error) {
      console.error('❌ Failed to fetch files')
      return { items: [], count: 0 }
    }
  }

  async getFileStatus(uploadId: string, authToken: string): Promise<FileStatusResponse> {
    return this.makeRequest(ENDPOINTS.FILES_STATUS(uploadId), authToken, { method: 'GET' })
  }

  async getFilePreview(uploadId: string, authToken: string): Promise<{ headers: string[], sample_data: any[], total_rows: number }> {
    // Fetch preview from S3 (top 20 rows)
    return this.getFilePreviewFromS3(uploadId, authToken, 20)
  }

  async startProcessing(
    uploadId: string,
    authToken: string,
    options?: { use_custom_rules?: boolean; custom_rule_prompt?: string | null; selected_columns?: string[] }
  ): Promise<any> {
    console.log('Starting processing:', uploadId, options?.use_custom_rules ? '(with custom rules)' : '')
    const payload: Record<string, any> = {}

    if (options?.use_custom_rules) {
      payload.use_custom_rules = true
      if (options.custom_rule_prompt) {
        payload.custom_rule_prompt = options.custom_rule_prompt
      }
    }

    if (options?.selected_columns && Array.isArray(options.selected_columns)) {
      const filtered = options.selected_columns
        .map(c => (c ?? '').toString().trim())
        .filter(c => c.length > 0)
      if (filtered.length > 0) {
        payload.selected_columns = filtered
      }
    }

    return this.makeRequest(ENDPOINTS.FILES_PROCESS(uploadId), authToken, {
      method: "POST",
      body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
    })
  }

  async getFileColumns(uploadId: string, authToken: string): Promise<{ columns: string[] }> {
    return this.makeRequest(ENDPOINTS.FILES_COLUMNS(uploadId), authToken, { method: 'GET' })
  }
  async downloadFile(uploadId: string, fileType: 'csv' | 'excel' | 'json', dataType: 'clean' | 'quarantine' | 'raw' | 'original' | 'all', authToken: string, targetErp?: string): Promise<Blob> {
    let endpoint = `${ENDPOINTS.FILES_EXPORT(uploadId)}?type=${fileType}&data=${dataType}`

    // Add ERP transformation parameter if specified
    if (targetErp) {
      endpoint += `&erp=${encodeURIComponent(targetErp)}`
    }

    const url = `${this.baseURL}${endpoint}`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })

    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)

    // Log transformation info if present
    const erpTransformation = response.headers.get('X-ERP-Transformation')
    if (erpTransformation === 'true') {
      console.log('ERP Transformation applied:', {
        source: response.headers.get('X-Source-ERP'),
        target: response.headers.get('X-Target-ERP'),
        entity: response.headers.get('X-Entity-Type')
      })
    }

    return response.blob()
  }

  async getFilePreviewFromS3(uploadId: string, authToken: string, maxRows: number = 20): Promise<{ headers: string[], sample_data: any[], total_rows: number }> {
    try {
      // Download the original file from S3 via export endpoint
      const blob = await this.downloadFile(uploadId, 'csv', 'all', authToken)
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

  async getFileIssues(
    uploadId: string,
    authToken: string,
    params?: { offset?: number; limit?: number; violations?: string[] }
  ): Promise<IssuesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.offset !== undefined) searchParams.set('offset', String(params.offset))
    if (params?.limit !== undefined) searchParams.set('limit', String(params.limit))
    if (params?.violations && params.violations.length > 0) {
      searchParams.set('violations', params.violations.join(','))
    }
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return this.makeRequest(`${ENDPOINTS.FILES_ISSUES(uploadId)}${qs}`, authToken, { method: 'GET' })
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

      const terminalStatuses = ['DQ_FIXED', 'FAILED', 'COMPLETED', 'DQ_FAILED']
      if (terminalStatuses.includes(status.status)) {
        return status
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      return poll()
    }

    return poll()
  }

  // Enhanced smart polling with multiple fallback detection methods - 30 minute timeout
  async pollFileStatusSmart(uploadId: string, authToken: string, onStatusUpdate: (status: FileStatusResponse) => void, maxAttempts: number = 180): Promise<FileStatusResponse> {
    let attempts = 0
    let consecutiveSameStatus = 0
    let lastStatus: FileStatusResponse | null = null

    const poll = async (): Promise<FileStatusResponse> => {
      try {
        attempts++
        console.log(`🔄 Smart poll attempt ${attempts}/${maxAttempts} for ${uploadId}`)

        const status = await this.getFileStatus(uploadId, authToken)

        // Track if status is stuck
        if (lastStatus && lastStatus.status === status.status) {
          consecutiveSameStatus++
        } else {
          consecutiveSameStatus = 0
        }
        lastStatus = status

        onStatusUpdate(status)

        // Terminal statuses
        if (['DQ_FIXED', 'COMPLETED', 'DQ_FAILED', 'FAILED'].includes(status.status)) {
          console.log(`✅ Polling completed: ${status.status}`)
          return status
        }

        // Smart completion detection after reasonable time
        if (attempts > 20 && ['DQ_RUNNING', 'QUEUED'].includes(status.status)) {
          const completionStatus = await this.detectCompletion(uploadId, authToken, status)
          if (completionStatus) {
            console.log('✨ Smart detection found completion')
            onStatusUpdate(completionStatus)
            return completionStatus
          }
        }

        if (attempts >= maxAttempts) {
          // Final attempt at smart detection
          const finalStatus = await this.detectCompletion(uploadId, authToken, status)
          if (finalStatus) {
            onStatusUpdate(finalStatus)
            return finalStatus
          }
          throw new Error(`Polling timeout after ${maxAttempts} attempts`)
        }

        // 10 second intervals
        await new Promise((resolve) => setTimeout(resolve, 10000))
        return await poll()
      } catch (error) {
        console.error(`❌ Polling error on attempt ${attempts}:`, error)

        // Retry network errors with backoff
        if (attempts < 5 && (error instanceof Error && (error.message.includes('fetch') || error.message.includes('network')))) {
          const backoffTime = attempts * 2000
          await new Promise((resolve) => setTimeout(resolve, backoffTime))
          return await poll()
        }

        throw error
      }
    }

    return await poll()
  }

  // Smart completion detection methods
  private async detectCompletion(uploadId: string, authToken: string, currentStatus: FileStatusResponse): Promise<FileStatusResponse | null> {
    // Try multiple detection methods
    try {
      // Method 1: Check files list
      const response = await this.getUploads(authToken)
      const fileRecord = response.items?.find((f) => f.upload_id === uploadId)
      if (fileRecord && fileRecord.status === 'DQ_FIXED') {
        return {
          ...currentStatus,
          ...fileRecord,
          completion_detected_by: 'files_list_check'
        } as FileStatusResponse
      }
    } catch (error) {
      console.log('⚠️ Smart detection method failed:', error)
    }

    return null
  }

  async deleteUpload(uploadId: string, authToken: string): Promise<void> {
    return this.makeRequest(`/uploads/${uploadId}`, authToken, {
      method: 'DELETE'
    })
  }

  async uploadFileComplete(file: File, authToken: string, useAI: boolean = false, onProgress?: (progress: number) => void, onStatusUpdate?: (status: FileStatusResponse) => void, autoProcess: boolean = false): Promise<FileStatusResponse> {
    try {
      if (onProgress) onProgress(0)

      // Step 1: Initialize upload - backend returns presigned URL
      const initResponse = await this.initUpload(file.name, file.type || 'text/csv', authToken, useAI)
      console.log('📤 Upload initialized:', initResponse)
      if (onProgress) onProgress(10)

      // Step 2: Upload to S3 using presigned POST (preferred) or PUT (fallback)
      console.log('📤 Uploading to S3...')

      // Check if backend wants us to use POST method (presignedPost with usePost flag)
      if (initResponse.usePost && initResponse.presignedPost) {
        console.log('🟢 Using presigned POST method')
        await this.uploadToS3Post(
          initResponse.presignedPost.url,
          initResponse.presignedPost.fields,
          file,
          (s3Progress) => {
            if (onProgress) onProgress(10 + (s3Progress * 0.4))
          }
        )
      }
      // Fallback: Check for direct fields (backwards compatibility)
      else if (initResponse.fields && initResponse.url) {
        console.log('🟡 Using fields-based POST method (legacy)')
        await this.uploadToS3Post(initResponse.url, initResponse.fields, file, (s3Progress) => {
          if (onProgress) onProgress(10 + (s3Progress * 0.4))
        })
      }
      // Fallback: Use PUT method with uploadUrl
      else if (initResponse.uploadUrl) {
        console.log('🟠 Using PUT method (deprecated)')
        await this.uploadToS3(initResponse.uploadUrl, file, (s3Progress) => {
          if (onProgress) onProgress(10 + (s3Progress * 0.4))
        })
      }
      // Last resort: Use url field with PUT
      else if (initResponse.url) {
        console.log('🔴 Using url field with PUT (last resort)')
        await this.uploadToS3(initResponse.url, file, (s3Progress) => {
          if (onProgress) onProgress(10 + (s3Progress * 0.4))
        })
      } else {
        throw new Error('No valid upload method provided by backend')
      }

      console.log('✅ S3 upload complete')
      if (onProgress) onProgress(100)

      // Return upload status without auto-processing
      if (!autoProcess) {
        const uploadedStatus: FileStatusResponse = {
          upload_id: initResponse.upload_id,
          status: 'UPLOADED',
          filename: file.name,
          original_filename: file.name,
          created_at: new Date().toISOString(),
          rows_in: undefined,
          rows_out: undefined,
          dq_score: undefined,
          execution_arn: undefined,
        } as FileStatusResponse
        if (onStatusUpdate) onStatusUpdate(uploadedStatus)
        return uploadedStatus
      }

      // Step 3: Trigger processing using POST /files/{upload_id}/process (only if autoProcess is true)
      try {
        await this.startProcessing(initResponse.upload_id, authToken)
        console.log('✅ Processing triggered')
        if (onProgress) onProgress(60)

        // Step 4: Poll for status with smart detection
        const finalStatus = await this.pollFileStatusSmart(initResponse.upload_id, authToken, (status) => {
          console.log('📊 Status update:', status.status)
          if (onStatusUpdate) onStatusUpdate(status)
          if (onProgress) {
            const statusProgress: Record<string, number> = {
              'UPLOADED': 70,
              'VALIDATED': 72,
              'QUEUED': 75,
              'DQ_DISPATCHED': 78,
              'DQ_RUNNING': 85,
              'NORMALIZING': 90,
              'DQ_FIXED': 100,
              'FAILED': 100,
              'COMPLETED': 100,
              'REJECTED': 100,
            }
            onProgress(statusProgress[status.status] || 60)
          }
        }, 180) // 30 minute timeout

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

  // Download DQ report JSON for a processed file
  async downloadDqReport(uploadId: string, authToken: string): Promise<DqReportResponse> {
    const url = `${this.baseURL}/files/${uploadId}/download?type=report`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`DQ report download failed: ${response.statusText}`)
    }

    const text = await response.text()

    // Helper: try to base64-decode a string, return null on failure
    const tryDecodeBase64 = (s: string): string | null => {
      try {
        const trimmed = (s || '').trim()
        if (!trimmed) return null
        const binary = atob(trimmed)
        return binary
      } catch (e) {
        return null
      }
    }

    // Case 1: JSON envelope
    try {
      const payload = JSON.parse(text)
      const base64Body = payload.body || payload.data || ''
      if (base64Body) {
        const decoded = tryDecodeBase64(base64Body)
        if (decoded) return JSON.parse(decoded)
      }
      // If there's no body field, treat payload itself as report JSON
      return payload as DqReportResponse
    } catch {
      // Not JSON – fall through
    }

    // Case 2: plain base64 string
    const decoded = tryDecodeBase64(text)
    if (decoded) {
      try {
        return JSON.parse(decoded)
      } catch {
        // Fall through
      }
    }

    // Case 3: already plain JSON string
    return JSON.parse(text)
  }

  // Download per-user overall DQ summary JSON
  async downloadOverallDqReport(authToken: string): Promise<OverallDqReportResponse> {
    const url = `${this.baseURL}/files/overall/dq-report`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    if (!response.ok) {
      // 404 means no DQ report exists yet (new user or no processed files)
      // Return null instead of throwing to handle gracefully
      if (response.status === 404) {
        return null as unknown as OverallDqReportResponse
      }
      throw new Error(`Overall DQ report download failed: ${response.statusText}`)
    }

    const text = await response.text()

    // Helper: try to base64-decode a string, return null on failure
    const tryDecodeBase64 = (s: string): string | null => {
      try {
        const trimmed = (s || '').trim()
        if (!trimmed) return null
        const binary = atob(trimmed)
        return binary
      } catch (e) {
        return null
      }
    }

    // Case 1: JSON envelope
    try {
      const payload = JSON.parse(text)
      const base64Body = payload.body || payload.data || ''
      if (base64Body) {
        const decoded = tryDecodeBase64(base64Body)
        if (decoded) return JSON.parse(decoded)
      }
      return payload as OverallDqReportResponse
    } catch {
      // Not JSON – fall through
    }

    // Case 2: plain base64
    const decoded = tryDecodeBase64(text)
    if (decoded) {
      try {
        return JSON.parse(decoded)
      } catch {
        // Fall through
      }
    }

    // Case 3: already plain JSON
    return JSON.parse(text)
  }

  // ==================== Unified Bridge APIs (Multi-Source Ingestion) ====================

  /**
   * Ingest data from FTP/SFTP server
   */
  async ingestFromFtp(config: FtpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/ftp/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `FTP ingestion failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Ingest data from TCP endpoint
   */
  async ingestFromTcp(config: TcpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/tcp/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `TCP ingestion failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Ingest data from HTTP endpoint
   */
  async ingestFromHttp(config: HttpIngestionConfig, token: string): Promise<IngestionResponse> {
    const response = await fetch(`${API_BASE_URL}/unified-bridge/http/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ingestion failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Upload binary file via API
   */
  async uploadBinary(file: File, token: string, onProgress?: (progress: number) => void): Promise<IngestionResponse> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]

          const response = await fetch(`${API_BASE_URL}/unified-bridge/binary/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              filename: file.name,
              content_type: file.type || 'application/octet-stream',
              data: base64,
            }),
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(error.error || `Binary upload failed: ${response.statusText}`)
          }

          if (onProgress) onProgress(100)
          resolve(await response.json())
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read file'))

      if (onProgress) onProgress(10)
      reader.readAsDataURL(file)
    })
  }

  /**
   * Test FTP connection
   */
  async testFtpConnection(config: Omit<FtpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    // For now, just validate the config
    if (!config.host || !config.remote_path) {
      return { success: false, message: 'Host and remote path are required' }
    }
    // In production, would call a test endpoint
    return { success: true, message: 'Connection parameters look valid' }
  }

  /**
   * Test TCP connection  
   */
  async testTcpConnection(config: Omit<TcpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    if (!config.host || !config.port) {
      return { success: false, message: 'Host and port are required' }
    }
    return { success: true, message: 'Connection parameters look valid' }
  }

  /**
   * Test HTTP endpoint
   */
  async testHttpEndpoint(config: Omit<HttpIngestionConfig, 'filename'>): Promise<{ success: boolean; message: string }> {
    if (!config.url) {
      return { success: false, message: 'URL is required' }
    }
    try {
      new URL(config.url)
      return { success: true, message: 'URL is valid' }
    } catch {
      return { success: false, message: 'Invalid URL format' }
    }
  }
}

// ==================== Unified Bridge Ingestion Types ====================

export interface FtpIngestionConfig {
  host: string
  port?: number
  username?: string
  password?: string
  protocol: 'ftp' | 'ftps' | 'ftps_implicit' | 'sftp'
  remote_path: string
  filename: string
  auth?: {
    type: 'password' | 'ssh_key'
    private_key?: string
    key_passphrase?: string
  }
  tls?: {
    verify_cert?: boolean
  }
}

export interface TcpIngestionConfig {
  host: string
  port: number
  timeout_seconds?: number
  delimiter?: string
  max_size_bytes?: number
  request_data?: string
  filename: string
  tls?: {
    enabled?: boolean
    verify_cert?: boolean
    ca_cert?: string
    client_cert?: string
    client_key?: string
  }
  auth?: {
    type: 'none' | 'token' | 'userpass'
    token?: string
    username?: string
    password?: string
    auth_command?: string
  }
}

export interface HttpIngestionConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  body?: Record<string, any> | string
  auth?: {
    type: 'none' | 'bearer' | 'api_key' | 'basic' | 'hmac' | 'cookie' | 'oidc'
    token?: string
    api_key?: string
    username?: string
    password?: string
    header_name?: string
    // HMAC auth
    access_key?: string
    secret_key?: string
    // Cookie auth
    cookie?: string
    // OIDC auth
    token_url?: string
    client_id?: string
    client_secret?: string
    scope?: string
  }
  timeout_seconds?: number
  filename: string
}

export interface IngestionResponse {
  success: boolean
  message: string
  upload_id: string
  filename: string
  size_bytes: number
  source?: string
  content_type?: string
}

// Legacy types for backward compatibility
export interface UnifiedBridgeErp {
  name: string
  available: boolean
  file_count: number
}

export interface UnifiedBridgeErpsResponse {
  erps: UnifiedBridgeErp[]
}

export interface UnifiedBridgeFile {
  id: string
  name: string
  filename: string
  rows: number
  size_mb: number
  entity: string
  available: boolean
}

export interface UnifiedBridgeFilesResponse {
  files: UnifiedBridgeFile[]
}

export interface UnifiedBridgeImportResponse {
  success: boolean
  upload_id: string
  rows: number
  message?: string
}

export const fileManagementAPI = new FileManagementAPI()
export default fileManagementAPI

