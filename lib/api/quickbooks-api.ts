import { AWS_CONFIG } from '../aws-config'

const API_BASE_URL = AWS_CONFIG.API_BASE_URL

// QuickBooks API Response Types
export interface QuickBooksConnectResponse {
  auth_url: string
  state: string
}

export interface QuickBooksConnectionStatus {
  connected: boolean
  realm_id?: string
  company_name?: string
  linked_at?: string
  expires_at?: string
}

export interface QuickBooksImportResponse {
  success: boolean
  upload_id: string
  filename: string
  records_imported: number
  entity: string
  message: string
}

export interface QuickBooksExportResponse {
  success: boolean
  message: string
  records_exported?: number
  entity?: string
}

export interface QuickBooksImportFilters {
  limit?: number
  date_from?: string
  date_to?: string
}

/**
 * QuickBooks ERP Service
 * Handles all QuickBooks integration operations
 */
class QuickBooksService {
  private baseURL: string

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
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

    // Add auth token unless skipping
    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    console.log('📡 QuickBooks API Request:', url, options.method || 'GET')

    try {
      const response = await fetch(url, { ...options, headers })
      console.log('📥 Response:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('❌ QuickBooks API Error:', error)
      throw error
    }
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

  /**
   * Connect to QuickBooks - Get OAuth URL
   */
  async connect(): Promise<QuickBooksConnectResponse> {
    try {
      const response = await this.makeRequest<QuickBooksConnectResponse>('/quickbooks/connect', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return response
    } catch (error) {
      console.error('QuickBooks connect error:', error)
      throw error
    }
  }

  /**
   * Handle OAuth callback
   * Note: This endpoint does NOT require authentication - user_id comes from state parameter
   */
  async handleCallback(code: string, realmId: string, state: string): Promise<any> {
    try {
      const response = await this.makeRequest(
        `/quickbooks/callback?code=${code}&realmId=${realmId}&state=${state}`,
        { method: 'GET' },
        true // skipAuth - callback endpoint is public
      )
      return response
    } catch (error) {
      console.error('QuickBooks callback error:', error)
      throw error
    }
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<QuickBooksConnectionStatus> {
    try {
      const response = await this.makeRequest<QuickBooksConnectionStatus>('/quickbooks/connections', {
        method: 'GET',
      })
      return response
    } catch (error) {
      console.error('Get connection status error:', error)
      return { connected: false }
    }
  }

  /**
   * Disconnect from QuickBooks
   */
  async disconnect(): Promise<void> {
    try {
      await this.makeRequest('/quickbooks/disconnect', {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('QuickBooks disconnect error:', error)
      throw error
    }
  }

  /**
   * Import data from QuickBooks
   * @param entity - Entity type (customers, invoices, vendors, items)
   * @param filters - Optional filters (limit, date_from, date_to)
   */
  async importData(
    entity: 'customers' | 'invoices' | 'vendors' | 'items',
    filters: QuickBooksImportFilters = {}
  ): Promise<QuickBooksImportResponse> {
    try {
      const response = await this.makeRequest<QuickBooksImportResponse>('/quickbooks/import', {
        method: 'POST',
        body: JSON.stringify({
          entity,
          filters,
        }),
      })
      return response
    } catch (error) {
      console.error('QuickBooks import error:', error)
      throw error
    }
  }

  /**
   * Export/Upload cleaned data to QuickBooks
   * @param uploadId - The upload ID of cleaned data
   */
  async exportToQuickBooks(uploadId: string): Promise<QuickBooksExportResponse> {
    try {
      const response = await this.makeRequest<QuickBooksExportResponse>('/quickbooks/export', {
        method: 'POST',
        body: JSON.stringify({
          upload_id: uploadId,
        }),
      })
      return response
    } catch (error) {
      console.error('QuickBooks export error:', error)
      throw error
    }
  }

  /**
   * Open QuickBooks OAuth in popup window
   * Returns a promise that resolves when auth completes
   */
  async openOAuthPopup(): Promise<{ success: boolean; realmId?: string; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        const response = await this.connect()

        if (!response.auth_url) {
          resolve({ success: false, error: 'No auth URL received' })
          return
        }

        // Open popup
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2

        const authWindow = window.open(
          response.auth_url,
          'QuickBooks OAuth',
          `width=${width},height=${height},top=${top},left=${left}`
        )

        // Listen for message from callback window
        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'quickbooks-auth-success') {
            window.removeEventListener('message', messageHandler)
            resolve({ success: true, realmId: event.data.realmId })
          } else if (event.data.type === 'quickbooks-auth-error') {
            window.removeEventListener('message', messageHandler)
            resolve({ success: false, error: event.data.error })
          }
        }

        window.addEventListener('message', messageHandler)

        // Poll for window closure as fallback
        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow)
            window.removeEventListener('message', messageHandler)
            // Return success with unknown status (will recheck connection)
            resolve({ success: true })
          }
        }, 500)
      } catch (error) {
        resolve({ success: false, error: (error as Error).message })
      }
    })
  }
}

export const quickBooksAPI = new QuickBooksService()
export default quickBooksAPI
