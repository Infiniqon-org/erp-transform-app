import { AWS_CONFIG } from '../aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// ── Response Types ──────────────────────────────────────────────────────────

export interface StorageFile {
  id: string
  name: string
  mimeType: string
  size: number | null
  modifiedTime: string
  iconLink?: string
}

export interface StorageFolder {
  id: string
  name: string
}

export interface StorageFilesResponse {
  files: StorageFile[]
  next_page_token: string | null
}

export interface StorageFoldersResponse {
  folders: StorageFolder[]
}

export interface StorageImportResponse {
  upload_id: string
  filename: string
  status: string
  message: string
}

export interface StorageConnectionStatus {
  connected: boolean
  connection?: {
    user_id: string
    provider: string
    category: string
    connection_status: string
    linked_at?: string
    email?: string
  }
  post_auth_config?: unknown[]
}

export interface StorageConnectResponse {
  auth_url: string
}

export interface StorageProvider {
  provider_id: string
  display_name: string
  category: string
  capabilities: {
    supports_import: boolean
    supports_export: boolean
    supports_oauth: boolean
  }
}

// ── API Client ──────────────────────────────────────────────────────────────

class StorageConnectorAPI {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    try {
      const tokensStr = localStorage.getItem('authTokens')
      if (tokensStr) {
        const tokens = JSON.parse(tokensStr)
        return tokens.idToken || null
      }
    } catch {
      // Ignore parse errors
    }
    return null
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
    }

    return await response.json()
  }

  // ── OAuth ───────────────────────────────────────────────────────────────

  async connect(provider: string): Promise<StorageConnectResponse> {
    return this.makeRequest<StorageConnectResponse>(
      `/connectors/${provider}/connect`,
      { method: 'POST', body: JSON.stringify({}) }
    )
  }

  async getConnectionStatus(provider: string): Promise<StorageConnectionStatus> {
    try {
      return await this.makeRequest<StorageConnectionStatus>(
        `/connectors/${provider}/connections`,
        { method: 'GET' }
      )
    } catch {
      return { connected: false }
    }
  }

  async disconnect(provider: string): Promise<void> {
    await this.makeRequest(`/connectors/${provider}/disconnect`, { method: 'DELETE' })
  }

  async openOAuthPopup(provider: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const response = await this.connect(provider)

        if (!response.auth_url) {
          resolve({ success: false, error: 'No auth URL received' })
          return
        }

        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const authWindow = window.open(
          response.auth_url,
          `${displayName} OAuth`,
          `width=${width},height=${height},top=${top},left=${left}`
        )

        const messageHandler = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return
          if (event.data.type === `${provider}-auth-success`) {
            window.removeEventListener('message', messageHandler)
            resolve({ success: true })
          } else if (event.data.type === `${provider}-auth-error`) {
            window.removeEventListener('message', messageHandler)
            resolve({ success: false, error: event.data.error })
          }
        }

        window.addEventListener('message', messageHandler)

        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow)
            window.removeEventListener('message', messageHandler)
            resolve({ success: true })
          }
        }, 500)
      } catch (error) {
        resolve({ success: false, error: (error as Error).message })
      }
    })
  }

  // ── File & Folder Browsing ──────────────────────────────────────────────

  async listFiles(provider: string, folderId?: string, pageToken?: string): Promise<StorageFilesResponse> {
    const params = new URLSearchParams()
    if (folderId) params.set('folder_id', folderId)
    if (pageToken) params.set('page_token', pageToken)
    const qs = params.toString()
    return this.makeRequest<StorageFilesResponse>(
      `/connectors/storage/${provider}/files${qs ? `?${qs}` : ''}`
    )
  }

  async listFolders(provider: string, parentFolderId?: string): Promise<StorageFoldersResponse> {
    const params = new URLSearchParams()
    if (parentFolderId) params.set('parent_folder_id', parentFolderId)
    const qs = params.toString()
    return this.makeRequest<StorageFoldersResponse>(
      `/connectors/storage/${provider}/folders${qs ? `?${qs}` : ''}`
    )
  }

  // ── Import ──────────────────────────────────────────────────────────────

  async importFile(provider: string, fileId: string): Promise<StorageImportResponse> {
    return this.makeRequest<StorageImportResponse>(
      `/connectors/storage/${provider}/import`,
      { method: 'POST', body: JSON.stringify({ file_id: fileId }) }
    )
  }
}

export const storageConnectorAPI = new StorageConnectorAPI()
export default storageConnectorAPI
