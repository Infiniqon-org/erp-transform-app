"use client"

import { useState } from "react"
import { Globe, Loader2, CheckCircle, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fileManagementAPI, type HttpIngestionConfig } from "@/lib/api/file-management-api"

interface HttpSourceFormProps {
    token: string
    onIngestionStart: () => void
    onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
    onError: (error: string) => void
    disabled?: boolean
}

type AuthType = "none" | "bearer" | "api_key" | "basic"

export default function HttpSourceForm({
    token,
    onIngestionStart,
    onIngestionComplete,
    onError,
    disabled,
}: HttpSourceFormProps) {
    const [url, setUrl] = useState("")
    const [method, setMethod] = useState<"GET" | "POST">("GET")
    const [authType, setAuthType] = useState<AuthType>("none")
    const [bearerToken, setBearerToken] = useState("")
    const [apiKey, setApiKey] = useState("")
    const [apiKeyHeader, setApiKeyHeader] = useState("X-API-Key")
    const [basicUsername, setBasicUsername] = useState("")
    const [basicPassword, setBasicPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [headers, setHeaders] = useState<{ key: string; value: string }[]>([])
    const [body, setBody] = useState("")
    const [filename, setFilename] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)

    const addHeader = () => {
        setHeaders([...headers, { key: "", value: "" }])
    }

    const removeHeader = (index: number) => {
        setHeaders(headers.filter((_, i) => i !== index))
    }

    const updateHeader = (index: number, field: "key" | "value", value: string) => {
        const updated = [...headers]
        updated[index][field] = value
        setHeaders(updated)
    }

    const handleTest = async () => {
        setIsTesting(true)
        try {
            const result = await fileManagementAPI.testHttpEndpoint({ url })
            if (result.success) {
                onIngestionComplete({ success: true, message: result.message })
            } else {
                onError(result.message)
            }
        } catch (err: any) {
            onError(err.message || "URL validation failed")
        } finally {
            setIsTesting(false)
        }
    }

    const handleIngest = async () => {
        if (!url || !filename) {
            onError("Please fill in all required fields")
            return
        }

        setIsLoading(true)
        onIngestionStart()

        try {
            const config: HttpIngestionConfig = {
                url,
                method,
                filename,
                headers: headers.reduce((acc, h) => {
                    if (h.key) acc[h.key] = h.value
                    return acc
                }, {} as Record<string, string>),
            }

            // Add auth config
            if (authType === "bearer") {
                config.auth = { type: "bearer", token: bearerToken }
            } else if (authType === "api_key") {
                config.auth = { type: "api_key", api_key: apiKey, header_name: apiKeyHeader }
            } else if (authType === "basic") {
                config.auth = { type: "basic", username: basicUsername, password: basicPassword }
            }

            // Add body for POST
            if (method === "POST" && body) {
                try {
                    config.body = JSON.parse(body)
                } catch {
                    config.body = body
                }
            }

            const result = await fileManagementAPI.ingestFromHttp(config, token)

            onIngestionComplete({
                success: true,
                message: `Successfully fetched ${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`,
                uploadId: result.upload_id,
            })
        } catch (err: any) {
            onError(err.message || "HTTP ingestion failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* URL & Method */}
            <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as "GET" | "POST")} disabled={disabled || isLoading}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="col-span-3 space-y-2">
                    <Label htmlFor="http-url">URL *</Label>
                    <Input
                        id="http-url"
                        placeholder="https://api.example.com/export"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* Authentication */}
            <div className="space-y-2">
                <Label>Authentication</Label>
                <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)} disabled={disabled || isLoading}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Auth Fields */}
            {authType === "bearer" && (
                <div className="space-y-2">
                    <Label htmlFor="bearer-token">Bearer Token</Label>
                    <Input
                        id="bearer-token"
                        type="password"
                        placeholder="your-token-here"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            )}

            {authType === "api_key" && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="api-key-header">Header Name</Label>
                        <Input
                            id="api-key-header"
                            placeholder="X-API-Key"
                            value={apiKeyHeader}
                            onChange={(e) => setApiKeyHeader(e.target.value)}
                            disabled={disabled || isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="api-key">API Key</Label>
                        <Input
                            id="api-key"
                            type="password"
                            placeholder="your-api-key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            disabled={disabled || isLoading}
                        />
                    </div>
                </div>
            )}

            {authType === "basic" && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="basic-user">Username</Label>
                        <Input
                            id="basic-user"
                            placeholder="username"
                            value={basicUsername}
                            onChange={(e) => setBasicUsername(e.target.value)}
                            disabled={disabled || isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="basic-pass">Password</Label>
                        <div className="relative">
                            <Input
                                id="basic-pass"
                                type={showPassword ? "text" : "password"}
                                placeholder="password"
                                value={basicPassword}
                                onChange={(e) => setBasicPassword(e.target.value)}
                                disabled={disabled || isLoading}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Headers */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Custom Headers</Label>
                    <Button variant="ghost" size="sm" onClick={addHeader} disabled={disabled || isLoading} className="h-7 px-2">
                        <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                </div>
                {headers.map((header, index) => (
                    <div key={index} className="flex gap-2">
                        <Input
                            placeholder="Header-Name"
                            value={header.key}
                            onChange={(e) => updateHeader(index, "key", e.target.value)}
                            disabled={disabled || isLoading}
                            className="flex-1"
                        />
                        <Input
                            placeholder="value"
                            value={header.value}
                            onChange={(e) => updateHeader(index, "value", e.target.value)}
                            disabled={disabled || isLoading}
                            className="flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeHeader(index)} disabled={disabled || isLoading}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            {/* Request Body (POST only) */}
            {method === "POST" && (
                <div className="space-y-2">
                    <Label htmlFor="http-body">Request Body (JSON)</Label>
                    <Textarea
                        id="http-body"
                        placeholder='{"key": "value"}'
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        disabled={disabled || isLoading}
                        rows={3}
                    />
                </div>
            )}

            {/* Output Filename */}
            <div className="space-y-2">
                <Label htmlFor="http-filename">Save As *</Label>
                <Input
                    id="http-filename"
                    placeholder="api_export.csv"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={disabled || isLoading}
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={disabled || isLoading || isTesting || !url}
                    className="gap-2"
                >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Validate URL
                </Button>
                <Button
                    onClick={handleIngest}
                    disabled={disabled || isLoading || !url || !filename}
                    className="gap-2 flex-1"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                    {isLoading ? "Fetching..." : "Fetch Data"}
                </Button>
            </div>
        </div>
    )
}
