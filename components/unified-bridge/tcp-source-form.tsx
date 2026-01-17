"use client"

import { useState } from "react"
import { Network, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fileManagementAPI, type TcpIngestionConfig } from "@/lib/api/file-management-api"

interface TcpSourceFormProps {
    token: string
    onIngestionStart: () => void
    onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
    onError: (error: string) => void
    disabled?: boolean
}

export default function TcpSourceForm({
    token,
    onIngestionStart,
    onIngestionComplete,
    onError,
    disabled,
}: TcpSourceFormProps) {
    const [host, setHost] = useState("")
    const [port, setPort] = useState("")
    const [timeout, setTimeout] = useState("30")
    const [delimiter, setDelimiter] = useState("")
    const [requestData, setRequestData] = useState("")
    const [filename, setFilename] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)

    const handleTest = async () => {
        setIsTesting(true)
        try {
            const result = await fileManagementAPI.testTcpConnection({
                host,
                port: parseInt(port),
                timeout_seconds: parseInt(timeout),
                delimiter,
            })
            if (result.success) {
                onIngestionComplete({ success: true, message: result.message })
            } else {
                onError(result.message)
            }
        } catch (err: any) {
            onError(err.message || "Connection test failed")
        } finally {
            setIsTesting(false)
        }
    }

    const handleIngest = async () => {
        if (!host || !port || !filename) {
            onError("Please fill in all required fields")
            return
        }

        setIsLoading(true)
        onIngestionStart()

        try {
            const config: TcpIngestionConfig = {
                host,
                port: parseInt(port),
                timeout_seconds: parseInt(timeout) || 30,
                delimiter: delimiter || undefined,
                request_data: requestData || undefined,
                filename,
            }

            const result = await fileManagementAPI.ingestFromTcp(config, token)

            onIngestionComplete({
                success: true,
                message: `Successfully ingested ${result.filename} (${(result.size_bytes / 1024).toFixed(1)} KB)`,
                uploadId: result.upload_id,
            })
        } catch (err: any) {
            onError(err.message || "TCP ingestion failed")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Host & Port */}
            <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                    <Label htmlFor="tcp-host">Host *</Label>
                    <Input
                        id="tcp-host"
                        placeholder="192.168.1.100"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tcp-port">Port *</Label>
                    <Input
                        id="tcp-port"
                        type="number"
                        placeholder="9000"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* Timeout & Delimiter */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="tcp-timeout">Timeout (seconds)</Label>
                    <Input
                        id="tcp-timeout"
                        type="number"
                        placeholder="30"
                        value={timeout}
                        onChange={(e) => setTimeout(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tcp-delimiter">End Delimiter</Label>
                    <Input
                        id="tcp-delimiter"
                        placeholder="\n---END---\n"
                        value={delimiter}
                        onChange={(e) => setDelimiter(e.target.value)}
                        disabled={disabled || isLoading}
                    />
                </div>
            </div>

            {/* Request Data */}
            <div className="space-y-2">
                <Label htmlFor="tcp-request">Request Data (Optional)</Label>
                <Textarea
                    id="tcp-request"
                    placeholder="Data to send to initiate transfer..."
                    value={requestData}
                    onChange={(e) => setRequestData(e.target.value)}
                    disabled={disabled || isLoading}
                    rows={3}
                />
                <p className="text-xs text-muted-foreground">
                    Optional data to send when connection is established
                </p>
            </div>

            {/* Output Filename */}
            <div className="space-y-2">
                <Label htmlFor="tcp-filename">Save As *</Label>
                <Input
                    id="tcp-filename"
                    placeholder="tcp_data.csv"
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
                    disabled={disabled || isLoading || isTesting || !host || !port}
                    className="gap-2"
                >
                    {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4" />
                    )}
                    Test Connection
                </Button>
                <Button
                    onClick={handleIngest}
                    disabled={disabled || isLoading || !host || !port || !filename}
                    className="gap-2 flex-1"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Network className="h-4 w-4" />
                    )}
                    {isLoading ? "Ingesting..." : "Ingest Data"}
                </Button>
            </div>
        </div>
    )
}
