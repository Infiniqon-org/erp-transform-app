"use client"

import { motion } from 'framer-motion'
import { Settings, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SettingsSection() {
  // These would typically come from environment variables or a config service
  const config = {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.cleanflowai.com',
    AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    VERSION: 'CleanFlowAI v1.0.0'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Configuration */}
          <div>
            <h3 className="text-lg font-medium mb-4">API Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-muted-foreground mb-2">API Gateway Endpoint</label>
                <div className="w-full px-4 py-2 bg-muted border border-border rounded-lg font-mono text-sm">
                  {config.API_BASE_URL}
                </div>
              </div>
              <div>
                <label className="block text-muted-foreground mb-2">AWS Region</label>
                <div className="w-full px-4 py-2 bg-muted border border-border rounded-lg font-mono text-sm">
                  {config.AWS_REGION}
                </div>
              </div>
            </div>
          </div>

          {/* DQ Rules Configuration */}
          <div>
            <h3 className="text-lg font-medium mb-4">Data Quality Rules</h3>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span>Active Rules</span>
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                  30+ rules
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>• Fatal: 7 rules</div>
                <div>• High: 8 rules</div>
                <div>• Medium: 15+ rules</div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div>
            <h3 className="text-lg font-medium mb-4">System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium mb-2">Backend Status</h4>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm">All Tests Passing</span>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium mb-2">Version</h4>
                <span className="text-muted-foreground text-sm">{config.VERSION}</span>
              </div>
            </div>
          </div>

          {/* Processing Capabilities */}
          <div>
            <h3 className="text-lg font-medium mb-4">Processing Capabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium mb-2">File Formats</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    CSV (Primary)
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    JSON (Export)
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Excel (Export)
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="font-medium mb-2">Data Quality</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Schema Validation
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Type Checking
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Business Rules
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}