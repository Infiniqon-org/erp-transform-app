"use client"

import { useState } from 'react'
import { Network } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import QuickBooksImport from '@/components/quickbooks/quickbooks-import'

interface ErpSourceFormProps {
  token: string
  onIngestionStart: () => void
  onIngestionComplete: (result: { success: boolean; message: string; uploadId?: string }) => void
  onError: (error: string) => void
  disabled?: boolean
}

const ERP_OPTIONS = [
  { label: "QuickBooks Online", value: "quickbooks" },
  { label: "Oracle Fusion", value: "oracle" },
  { label: "SAP ERP", value: "sap" },
  { label: "Microsoft Dynamics", value: "dynamics" },
  { label: "NetSuite", value: "netsuite" },
  { label: "Workday", value: "workday" },
  { label: "Infor M3", value: "infor-m3" },
  { label: "Infor LN", value: "infor-ln" },
  { label: "Epicor Kinetic", value: "epicor" },
  { label: "QAD ERP", value: "qad" },
  { label: "IFS Cloud", value: "ifs" },
  { label: "Sage Intacct", value: "sage" },
]

export default function ErpSourceForm({
  token,
  onIngestionStart,
  onIngestionComplete,
  onError,
  disabled,
}: ErpSourceFormProps) {
  const [selectedErp, setSelectedErp] = useState("quickbooks")

  return (
    <div className="space-y-4">
      {/* ERP System Selector */}
      <div className="space-y-2">
        <Label htmlFor="erp-system">Select ERP System</Label>
        <Select value={selectedErp} onValueChange={setSelectedErp}>
          <SelectTrigger id="erp-system" disabled={disabled}>
            <SelectValue placeholder="Select ERP system" />
          </SelectTrigger>
          <SelectContent>
            {ERP_OPTIONS.map((erp) => (
              <SelectItem key={erp.value} value={erp.value}>
                {erp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ERP-specific content */}
      {selectedErp === "quickbooks" ? (
        <QuickBooksImport
          onImportComplete={(uploadId) => {
            onIngestionComplete({
              success: true,
              message: 'Successfully imported data from QuickBooks',
              uploadId,
            })
          }}
          onNotification={(message, type) => {
            if (type === 'error') {
              onError(message)
            } else {
              onIngestionComplete({
                success: true,
                message,
              })
            }
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[250px] p-8 border-2 border-dashed rounded-lg bg-muted/5">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Network className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-center">
            {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md text-center">
            Connect your {ERP_OPTIONS.find((e) => e.value === selectedErp)?.label} account to import data directly.
          </p>
          <Button disabled size="lg">Connect</Button>
        </div>
      )}
    </div>
  )
}

