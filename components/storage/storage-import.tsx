'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileSpreadsheet,
  ChevronRight,
  ArrowLeft,
  Download,
  HardDrive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import storageConnectorAPI, {
  type StorageFile,
  type StorageFolder,
  type StorageConnectionStatus,
} from '@/lib/api/storage-connector-api'
import { formatBytes } from '@/lib/utils'

// ── Provider config (extend when backend adds more providers) ───────────

interface ProviderConfig {
  id: string
  displayName: string
  icon: typeof HardDrive
  color: string
  hoverColor: string
  bgColor: string
}

const STORAGE_PROVIDERS: ProviderConfig[] = [
  {
    id: 'googledrive',
    displayName: 'Google Drive',
    icon: HardDrive,
    color: 'text-blue-600',
    hoverColor: 'hover:bg-blue-700',
    bgColor: 'bg-blue-600',
  },
  // Add more providers here when backend registers them:
  // { id: 'onedrive', displayName: 'OneDrive', icon: HardDrive, color: 'text-sky-600', ... },
  // { id: 'dropbox', displayName: 'Dropbox', icon: HardDrive, color: 'text-indigo-600', ... },
]

// ── Breadcrumb type ─────────────────────────────────────────────────────

interface BreadcrumbItem {
  id: string | null
  name: string
}

// ── Component Props ─────────────────────────────────────────────────────

interface StorageImportProps {
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: 'success' | 'error') => void
}

export default function StorageImport({
  onImportComplete,
  onNotification,
}: StorageImportProps) {
  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(
    STORAGE_PROVIDERS.length === 1 ? STORAGE_PROVIDERS[0] : null
  )

  // Connection state
  const [connected, setConnected] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<StorageConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  // File browser state
  const [folders, setFolders] = useState<StorageFolder[]>([])
  const [files, setFiles] = useState<StorageFile[]>([])
  const [browsing, setBrowsing] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Drive' }])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // Import state
  const [importingFileId, setImportingFileId] = useState<string | null>(null)

  // Error/success
  const [error, setError] = useState<string | null>(null)

  // ── Check connection on mount / provider change ───────────────────────

  useEffect(() => {
    if (selectedProvider) {
      checkConnection()
    } else {
      setLoading(false)
    }

    const messageHandler = (event: MessageEvent) => {
      if (!selectedProvider) return
      if (
        event.data.type === `${selectedProvider.id}-auth-success` ||
        event.data.type === `${selectedProvider.id}-connection-updated`
      ) {
        setTimeout(() => checkConnection(), 500)
      }
    }

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && selectedProvider) {
        checkConnection()
      }
    }

    window.addEventListener('message', messageHandler)
    document.addEventListener('visibilitychange', visibilityHandler)
    return () => {
      window.removeEventListener('message', messageHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [selectedProvider?.id])

  // ── Load folder contents when breadcrumbs change ──────────────────────

  useEffect(() => {
    if (connected && selectedProvider) {
      loadFolderContents()
    }
  }, [connected, breadcrumbs.length])

  // ── API calls ─────────────────────────────────────────────────────────

  const checkConnection = useCallback(async () => {
    if (!selectedProvider) return
    try {
      setLoading(true)
      const status = await storageConnectorAPI.getConnectionStatus(selectedProvider.id)
      setConnected(status.connected)
      setConnectionInfo(status)
    } catch {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [selectedProvider?.id])

  const loadFolderContents = useCallback(async (pageToken?: string) => {
    if (!selectedProvider) return
    const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id ?? undefined

    try {
      if (pageToken) {
        setLoadingMore(true)
      } else {
        setBrowsing(true)
        setFiles([])
        setFolders([])
        setNextPageToken(null)
      }
      setError(null)

      const [foldersResp, filesResp] = await Promise.all([
        pageToken ? Promise.resolve({ folders: [] }) : storageConnectorAPI.listFolders(selectedProvider.id, currentFolderId),
        storageConnectorAPI.listFiles(selectedProvider.id, currentFolderId, pageToken),
      ])

      if (pageToken) {
        setFiles(prev => [...prev, ...filesResp.files])
      } else {
        setFolders(foldersResp.folders)
        setFiles(filesResp.files)
      }
      setNextPageToken(filesResp.next_page_token)
    } catch (err) {
      const msg = (err as Error).message || 'Failed to load files'
      setError(msg)
    } finally {
      setBrowsing(false)
      setLoadingMore(false)
    }
  }, [selectedProvider?.id, breadcrumbs])

  // ── Actions ───────────────────────────────────────────────────────────

  const handleConnect = async () => {
    if (!selectedProvider) return
    try {
      setError(null)
      setConnecting(true)
      const result = await storageConnectorAPI.openOAuthPopup(selectedProvider.id, selectedProvider.displayName)

      if (result.success) {
        onNotification?.(`${selectedProvider.displayName} connected successfully!`, 'success')
        checkConnection()
      } else if (result.error) {
        setError(result.error)
        onNotification?.(`Connection failed: ${result.error}`, 'error')
      }
    } catch (err) {
      const message = (err as Error).message || 'Failed to connect'
      setError(message)
      onNotification?.(`Failed to connect to ${selectedProvider.displayName}`, 'error')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!selectedProvider) return
    if (!confirm(`Are you sure you want to disconnect ${selectedProvider.displayName}?`)) return

    try {
      await storageConnectorAPI.disconnect(selectedProvider.id)
      setConnected(false)
      setConnectionInfo(null)
      setFiles([])
      setFolders([])
      setBreadcrumbs([{ id: null, name: 'My Drive' }])
      onNotification?.(`Disconnected from ${selectedProvider.displayName}`, 'success')
    } catch (err) {
      setError((err as Error).message)
      onNotification?.(`Failed to disconnect from ${selectedProvider.displayName}`, 'error')
    }
  }

  const navigateToFolder = (folder: StorageFolder) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1))
  }

  const importFile = async (file: StorageFile) => {
    if (!selectedProvider) return
    try {
      setImportingFileId(file.id)
      setError(null)
      const result = await storageConnectorAPI.importFile(selectedProvider.id, file.id)
      onNotification?.(`Importing "${file.name}" — it will appear in your file list shortly.`, 'success')
      onImportComplete?.(result.upload_id)
    } catch (err) {
      const msg = (err as Error).message || 'Import failed'
      setError(msg)
      onNotification?.(`Import failed: ${msg}`, 'error')
    } finally {
      setImportingFileId(null)
    }
  }

  // ── Render: Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] py-8">
        <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Render: Provider selection (if multiple providers) ────────────────

  if (!selectedProvider) {
    return (
      <div className="space-y-4 min-h-[300px] sm:min-h-[400px] p-4 sm:p-6">
        <h3 className="text-lg font-medium">Select a storage provider</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STORAGE_PROVIDERS.map(provider => {
            const Icon = provider.icon
            return (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider)}
                className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${provider.color}`} />
                </div>
                <span className="font-medium">{provider.displayName}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const ProviderIcon = selectedProvider.icon

  // ── Render: Not connected ─────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="space-y-4 sm:space-y-6 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-4 sm:p-6 lg:p-8">
        {error && (
          <Alert variant="destructive" className="py-2 sm:py-3">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <AlertDescription className="text-sm sm:text-base">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 text-center">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 sm:mb-5 lg:mb-6`}>
            <ProviderIcon className={`h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 ${selectedProvider.color}`} />
          </div>
          <h3 className="text-lg sm:text-xl font-medium mb-2">{selectedProvider.displayName}</h3>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground mb-4 sm:mb-5 lg:mb-6 max-w-md px-4">
            Connect your {selectedProvider.displayName} account to browse and import files directly
          </p>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            size="lg"
            className={`${selectedProvider.bgColor} ${selectedProvider.hoverColor} px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base text-white`}
          >
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            )}
            Connect {selectedProvider.displayName}
          </Button>
          {STORAGE_PROVIDERS.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProvider(null)}
              className="mt-4 text-muted-foreground"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Choose another provider
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Render: Connected — file browser ──────────────────────────────────

  return (
    <div className="space-y-3 sm:space-y-4 min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] p-4 sm:p-6">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Connected status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-900 dark:text-green-300">
            {selectedProvider.displayName} Connected
          </span>
          {connectionInfo?.connection?.email && (
            <span className="text-xs text-green-700 dark:text-green-400 truncate max-w-[200px]">
              ({connectionInfo.connection.email})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 self-end sm:self-auto"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Disconnect
        </Button>
      </div>

      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center shrink-0">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-0.5" />}
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className={`px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${
                index === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* File/folder listing */}
      {browsing ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Loading files...</span>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">This folder is empty</p>
          <p className="text-xs text-muted-foreground mt-1">
            Only CSV, Excel, and Google Sheets files are shown
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
          {/* Folders */}
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => navigateToFolder(folder)}
              className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <FolderOpen className="h-4.5 w-4.5 text-amber-500 shrink-0" />
              <span className="text-sm font-medium truncate">{folder.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
            </button>
          ))}

          {/* Files */}
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.size != null ? formatBytes(file.size) : 'Unknown size'}
                  {file.modifiedTime && (
                    <> &middot; {new Date(file.modifiedTime).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => importFile(file)}
                disabled={importingFileId === file.id}
                className="h-7 text-xs shrink-0"
              >
                {importingFileId === file.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Import
                  </>
                )}
              </Button>
            </div>
          ))}

          {/* Load more */}
          {nextPageToken && (
            <div className="px-3 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadFolderContents(nextPageToken)}
                disabled={loadingMore}
                className="w-full h-8 text-xs"
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                Load more files
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
