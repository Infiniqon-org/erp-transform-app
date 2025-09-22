"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Database, Download, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useAppSelector } from "@/lib/store"

export function TransformResults() {
  const { transformResult } = useAppSelector((state) => state.transform)

  if (!transformResult) return null

  const handleDownload = (format: string) => {
    // Simulate download
    const blob = new Blob([JSON.stringify(transformResult.data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transformed_data.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Transformation Complete</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Detected ERP</div>
              <Badge variant="outline">{transformResult.detected_erp}</Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Entity Type</div>
              <Badge variant="outline">{transformResult.detected_entity}</Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Records</div>
              <div className="text-lg font-semibold">{transformResult.row_count}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Processing Time</div>
              <div className="text-lg font-semibold">{transformResult.processing_time_ms}ms</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Confidence Score</div>
            <div className="flex items-center space-x-2">
              <div className="text-lg font-semibold">{(transformResult.confidence_score * 100).toFixed(1)}%</div>
              <Badge variant={transformResult.confidence_score > 0.8 ? "default" : "secondary"} className="text-xs">
                {transformResult.confidence_score > 0.8 ? "High" : "Medium"}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Download Options</div>
            <div className="flex flex-wrap gap-2">
              {["json", "csv", "excel", "parquet"].map((format) => (
                <Button key={format} variant="outline" size="sm" onClick={() => handleDownload(format)}>
                  <Download className="w-3 h-3 mr-1" />
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Column Mappings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {Object.entries(transformResult.column_mappings || {}).map(([source, target]) => (
                <div key={source} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <code className="text-sm">{source}</code>
                  <span className="text-muted-foreground">→</span>
                  <code className="text-sm font-medium">{target as string}</code>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="hover:glow transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Preview Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-60">
            <pre className="text-xs font-mono bg-muted/50 p-4 rounded-lg overflow-auto">
              {JSON.stringify(transformResult.data.slice(0, 3), null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
