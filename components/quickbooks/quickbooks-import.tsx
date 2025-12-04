'use client'

import { useState, useEffect } from 'react'
import {
  Network,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import quickBooksAPI, {
  QuickBooksConnectionStatus,
  QuickBooksImportResponse,
} from '@/lib/api/quickbooks-api'

interface QuickBooksImportProps {
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: 'success' | 'error') => void
}

export default function QuickBooksImport({
  onImportComplete,
  onNotification,
}: QuickBooksImportProps) {
  const [connected, setConnected] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<QuickBooksConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)

  // Import configuration
  const [importConfig, setImportConfig] = useState({
    entity: 'invoices' as 'customers' | 'invoices' | 'vendors' | 'items',
    dateFrom: '',
    dateTo: '',
    limit: 1000,
  })

  const [importResult, setImportResult] = useState<QuickBooksImportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()

    // Listen for messages from callback window or tab visibility changes
    const messageHandler = (event: MessageEvent) => {
      if (
        event.data.type === 'quickbooks-auth-success' ||
        event.data.type === 'quickbooks-connection-updated'
      ) {
        console.log('Received auth success message, refreshing connection status')
        setTimeout(() => checkConnection(), 500)
      }
    }

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, rechecking connection')
        checkConnection()
      }
    }

    window.addEventListener('message', messageHandler)
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      window.removeEventListener('message', messageHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }, [])

  const checkConnection = async () => {
    try {
      setLoading(true)
      const status = await quickBooksAPI.getConnectionStatus()
      setConnected(status.connected)
      setConnectionInfo(status)
    } catch (err) {
      console.error('Error checking connection:', err)
    } finally {
      setLoading(false)
    }
  }

  const connectQuickBooks = async () => {
    try {
      setError(null)
      const result = await quickBooksAPI.openOAuthPopup()

      if (result.success) {
        onNotification?.('QuickBooks connected successfully!', 'success')
        checkConnection()
      } else if (result.error) {
        setError(result.error)
        onNotification?.(`Connection failed: ${result.error}`, 'error')
      }
    } catch (err) {
      console.error('Error connecting QuickBooks:', err)
      const message = (err as Error).message || 'Failed to connect to QuickBooks'
      setError(message)
      onNotification?.('Failed to connect to QuickBooks', 'error')
    }
  }

  const disconnectQuickBooks = async () => {
    if (!confirm('Are you sure you want to disconnect QuickBooks?')) {
      return
    }

    try {
      await quickBooksAPI.disconnect()
      setConnected(false)
      setConnectionInfo(null)
      onNotification?.('Disconnected from QuickBooks', 'success')
    } catch (err) {
      console.error('Error disconnecting QuickBooks:', err)
      const message = (err as Error).message
      setError(message)
      onNotification?.('Failed to disconnect from QuickBooks', 'error')
    }
  }

  const importFromQuickBooks = async () => {
    if (!connected) {
      setError('Please connect to QuickBooks first')
      return
    }

    if (!importConfig.entity) {
      setError('Please select an entity to import')
      return
    }

    try {
      setIsImporting(true)
      setError(null)
      setImportResult(null)

      const filters: { limit: number; date_from?: string; date_to?: string } = {
        limit: importConfig.limit,
      }

      if (importConfig.dateFrom) {
        filters.date_from = importConfig.dateFrom
      }
      if (importConfig.dateTo) {
        filters.date_to = importConfig.dateTo
      }

      const result = await quickBooksAPI.importData(importConfig.entity, filters)

      setImportResult(result)
      onNotification?.(`Successfully imported ${result.records_imported} records!`, 'success')
      onImportComplete?.(result.upload_id)
    } catch (err) {
      console.error('Error importing data:', err)
      const message = (err as Error).message || 'Failed to import data'
      setError(message)
      onNotification?.('Import failed: ' + message, 'error')
    } finally {
      setIsImporting(false)
    }
  }

  const entityOptions = [
    { value: 'customers', label: 'Customers' },
    { value: 'invoices', label: 'Invoices' },
    { value: 'vendors', label: 'Vendors' },
    { value: 'items', label: 'Items' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {importResult && (
        <Alert className="border-green-200 bg-green-50 py-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-900">
            Imported {importResult.records_imported} records • {importResult.filename}
          </AlertDescription>
        </Alert>
      )}

      {/* Not Connected State */}
      {!connected ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <Network className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Connect QuickBooks to import data directly
          </p>
          <Button onClick={connectQuickBooks} size="sm" className="bg-green-600 hover:bg-green-700">
            <ExternalLink className="mr-2 h-4 w-4" />
            Connect QuickBooks
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected Status */}
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Connected</span>
              {connectionInfo?.realm_id && (
                <span className="text-xs text-green-700">({connectionInfo.realm_id})</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnectQuickBooks}
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Disconnect
            </Button>
          </div>

          {/* Import Form */}
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Entity</Label>
                <Select
                  value={importConfig.entity}
                  onValueChange={(value) =>
                    setImportConfig({
                      ...importConfig,
                      entity: value as 'customers' | 'invoices' | 'vendors' | 'items',
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Max Records</Label>
                <Input
                  type="number"
                  value={importConfig.limit}
                  onChange={(e) =>
                    setImportConfig({ ...importConfig, limit: parseInt(e.target.value) || 1000 })
                  }
                  min={1}
                  max={10000}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From Date</Label>
                <Input
                  type="date"
                  value={importConfig.dateFrom}
                  onChange={(e) => setImportConfig({ ...importConfig, dateFrom: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Input
                  type="date"
                  value={importConfig.dateTo}
                  onChange={(e) => setImportConfig({ ...importConfig, dateTo: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={importFromQuickBooks}
              disabled={isImporting}
              className="w-full bg-green-600 hover:bg-green-700"
              size="sm"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import from QuickBooks
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
