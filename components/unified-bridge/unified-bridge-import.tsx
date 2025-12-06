"use client"

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw,
  Loader2,
  Database,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Building2,
  Server,
  Lock,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn, formatBytes } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import {
  fileManagementAPI,
  type UnifiedBridgeErp,
  type UnifiedBridgeFile,
} from "@/lib/api/file-management-api"

// Valid credentials for Unified Bridge access
const VALID_EMAIL = 'kiranparthiban2004+test@gmail.com'
const VALID_PASSWORD = 'TestPassword123!'

interface UnifiedBridgeImportProps {
  onImportComplete?: (uploadId: string) => void
  onNotification?: (message: string, type: "success" | "error") => void
}

export default function UnifiedBridgeImport({
  onImportComplete,
  onNotification,
}: UnifiedBridgeImportProps) {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Data state
  const [erps, setErps] = useState<UnifiedBridgeErp[]>([])
  const [selectedErp, setSelectedErp] = useState<string | null>(null)
  const [files, setFiles] = useState<UnifiedBridgeFile[]>([])
  const [selectedFile, setSelectedFile] = useState<UnifiedBridgeFile | null>(null)
  const [loadingErps, setLoadingErps] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedFileId, setImportedFileId] = useState<string | null>(null)

  const { idToken } = useAuth()

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)

    // Simulate a small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500))

    if (loginEmail === VALID_EMAIL && loginPassword === VALID_PASSWORD) {
      setIsAuthenticated(true)
      setShowLoginModal(false)
      setLoginEmail('')
      setLoginPassword('')
      onNotification?.('Authentication successful! Welcome to Unified Bridge.', 'success')
      // Load ERPs after successful login
      loadErps()
    } else {
      setLoginError('Invalid credentials. Please check your email and password.')
    }
    setIsLoggingIn(false)
  }

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false)
    setErps([])
    setSelectedErp(null)
    setFiles([])
    setSelectedFile(null)
    setImportedFileId(null)
    onNotification?.('Logged out from Unified Bridge', 'success')
  }

  // Handle browse button click
  const handleBrowseClick = () => {
    if (isAuthenticated) {
      loadErps()
    } else {
      setShowLoginModal(true)
    }
  }

  // Load ERPs from API
  const loadErps = useCallback(async () => {
    if (!isAuthenticated || !idToken) return

    setLoadingErps(true)
    try {
      const response = await fileManagementAPI.getUnifiedBridgeErps(idToken)
      setErps(response.erps || [])
    } catch (error) {
      console.error("Failed to load ERPs:", error)
      onNotification?.("Failed to load ERP list", "error")
    } finally {
      setLoadingErps(false)
    }
  }, [isAuthenticated, idToken, onNotification])

  // Load files when ERP is selected
  const loadFiles = useCallback(async () => {
    if (!idToken || !selectedErp || !isAuthenticated) return

    setLoadingFiles(true)
    setFiles([])
    setSelectedFile(null)
    setImportedFileId(null)

    try {
      const response = await fileManagementAPI.getUnifiedBridgeFiles(selectedErp, idToken)
      setFiles(response.files || [])
    } catch (error) {
      console.error("Failed to load files:", error)
      onNotification?.(`Failed to load files from ${selectedErp}`, "error")
    } finally {
      setLoadingFiles(false)
    }
  }, [idToken, selectedErp, isAuthenticated])

  // Don't auto-load on mount - wait for authentication
  useEffect(() => {
    if (isAuthenticated && erps.length === 0) {
      loadErps()
    }
  }, [isAuthenticated, loadErps, erps.length])

  useEffect(() => {
    if (selectedErp) {
      loadFiles()
    }
  }, [selectedErp, loadFiles])

  const handleErpSelect = (erpName: string) => {
    setSelectedErp(erpName)
    setSelectedFile(null)
    setImportedFileId(null)
  }

  const handleFileSelect = (file: UnifiedBridgeFile) => {
    if (!file.available) return
    setSelectedFile(file)
    setImportedFileId(null)
  }

  const handleImport = async () => {
    if (!idToken || !selectedFile || !selectedErp) return

    setImporting(true)
    try {
      const response = await fileManagementAPI.importUnifiedBridgeFile(
        selectedFile.id,
        selectedErp,
        idToken
      )

      // Check for success - handle different response formats
      const isSuccess = response.success !== false && (response.upload_id || response.rows)
      
      if (isSuccess) {
        setImportedFileId(selectedFile.id)
        // Call onImportComplete to refresh the file list - parent will show toast
        if (response.upload_id) {
          onImportComplete?.(response.upload_id)
        }
      } else {
        onNotification?.(response.message || "Import failed", "error")
      }
    } catch (error) {
      console.error("Import failed:", error)
      onNotification?.("Failed to import file", "error")
    } finally {
      setImporting(false)
    }
  }

  const availableErps = erps.filter((e) => e.available)

  return (
    <div className="flex flex-col h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]">
      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Unified Bridge Access
            </DialogTitle>
            <DialogDescription>
              Enter your credentials to access ERP datasets
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            {loginError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {loginError}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowLoginModal(false)
                  setLoginError('')
                  setLoginEmail('')
                  setLoginPassword('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Authenticating...
                  </>
                ) : (
                  'Access'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center pt-2">
              <Lock className="h-3 w-3 inline mr-1" />
              Secure access to enterprise datasets
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Unified Bridge</h3>
            <p className="text-xs text-muted-foreground">Import data from connected ERP systems</p>
          </div>
        </div>
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            onClick={loadErps}
            disabled={loadingErps}
            className="h-8 w-8"
          >
            {loadingErps ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Not Authenticated View */}
      {!isAuthenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Database className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-medium mb-2">Access ERP Datasets</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Browse and import data from connected enterprise systems. Authentication required for secure access.
          </p>
          <Button onClick={handleBrowseClick} className="gap-2">
            <Building2 className="h-4 w-4" />
            Browse ERP Systems
          </Button>
        </div>
      ) : (
        <>
          {/* Main Content */}
          <div className="flex-1 flex flex-col lg:flex-row gap-2 pt-4">
            {/* ERP Selection Panel */}
            <div className="lg:w-1/3 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Select ERP System</span>
              </div>

              {loadingErps ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : erps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-center p-4 rounded-lg border border-dashed">
                  <Database className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No ERP systems available</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact admin to set up connections</p>
                </div>
              ) : (
            <ScrollArea className="h-[200px] lg:h-[300px]">
              <div className="space-y-2 px-4 py-2">
                {erps.map((erp) => (
                  <button
                    key={erp.name}
                    onClick={() => erp.available && handleErpSelect(erp.name)}
                    disabled={!erp.available}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                      selectedErp === erp.name
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : erp.available
                        ? "border-border hover:border-primary/50 hover:bg-muted/50"
                        : "border-border/50 opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-md",
                          erp.available ? "bg-green-500/10" : "bg-muted"
                        )}
                      >
                        <Database
                          className={cn(
                            "h-4 w-4",
                            erp.available ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{erp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {erp.available
                            ? `${erp.file_count} file${erp.file_count !== 1 ? "s" : ""} available`
                            : "Not connected"}
                        </p>
                      </div>
                    </div>
                    {selectedErp === erp.name && (
                      <ChevronRight className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
              )}
            </div>

            {/* File Selection Panel */}
        <div className="flex-1 lg:border-l lg:pl-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {selectedErp ? `Files from ${selectedErp}` : "Select an ERP to view files"}
              </span>
            </div>
            {selectedErp && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadFiles}
                disabled={loadingFiles}
                className="h-7 px-2"
              >
                {loadingFiles ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {!selectedErp ? (
            <div className="flex flex-col items-center justify-center h-[200px] lg:h-[300px] text-center p-4 rounded-lg border border-dashed">
              <ChevronRight className="h-8 w-8 text-muted-foreground mb-2 rotate-180 lg:rotate-0" />
              <p className="text-sm text-muted-foreground">Select an ERP system to browse files</p>
            </div>
          ) : loadingFiles ? (
            <div className="flex items-center justify-center h-[200px] lg:h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] lg:h-[300px] text-center p-4 rounded-lg border border-dashed">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No files available</p>
              <p className="text-xs text-muted-foreground mt-1">
                No importable files found in {selectedErp}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[200px] lg:h-[300px]">
              <div className="space-y-2 pr-4">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    disabled={!file.available || importing}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                      selectedFile?.id === file.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : file.available
                        ? "border-border hover:border-primary/50 hover:bg-muted/50"
                        : "border-border/50 opacity-50 cursor-not-allowed",
                      importedFileId === file.id && "border-green-500 bg-green-500/5"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          "p-2 rounded-md shrink-0",
                          importedFileId === file.id
                            ? "bg-green-500/10"
                            : selectedFile?.id === file.id
                            ? "bg-primary/10"
                            : "bg-muted"
                        )}
                      >
                        {importedFileId === file.id ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <FileText
                            className={cn(
                              "h-4 w-4",
                              selectedFile?.id === file.id
                                ? "text-primary"
                                : "text-muted-foreground"
                            )}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{file.rows.toLocaleString()} rows</span>
                          <span>•</span>
                          <span>{file.size_mb.toFixed(1)} MB</span>
                          {file.entity && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {file.entity}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {!file.available && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] border-yellow-500/30 text-yellow-600 dark:text-yellow-400"
                      >
                        Unavailable
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
          </div>
        </div>

        {/* Footer / Import Button */}
      <div className="flex items-center justify-between pt-4 border-t mt-4">
        <div className="text-sm text-muted-foreground">
          {selectedFile ? (
            <span>
              Selected: <span className="font-medium text-foreground">{selectedFile.name}</span>
            </span>
          ) : (
            <span>Select a file to import</span>
          )}
        </div>
        <Button
          onClick={handleImport}
          disabled={!selectedFile || importing || importedFileId === selectedFile?.id}
          className="gap-2"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : importedFileId === selectedFile?.id ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Imported
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Import to Pipeline
            </>
          )}
        </Button>
      </div>
        </>
      )}
    </div>
  )
}
