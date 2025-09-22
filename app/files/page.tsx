"use client"

import { FileExplorer } from "@/components/files/file-explorer"
import { FileStats } from "@/components/files/file-stats"
import { FilesHeader } from "@/components/files/files-header"
import { DQResults } from "@/components/files/dq-results"
import { DQSummary } from "@/components/files/dq-summary"
import { MainLayout } from "@/components/layout/main-layout"
import { AuthGuard } from "@/components/auth/auth-guard"
import { FileManagerProvider } from "@/components/providers/file-manager-provider"

export default function FilesPage() {
  return (
    <AuthGuard>
      <FileManagerProvider>
        <MainLayout>
          <div className="space-y-6 slide-in">
            <FilesHeader />

            {/* Top Row: Storage Overview | Data Quality Processing Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <FileStats />
              </div>
              <div className="lg:col-span-2">
                <DQSummary />
              </div>
            </div>

            {/* Bottom Row: Files (n) | Individual File results */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <FileExplorer />
              <DQResults />
            </div>
          </div>
        </MainLayout>
      </FileManagerProvider>
    </AuthGuard>
  )
}
