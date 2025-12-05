"use client"

import { AuthGuard } from "@/components/auth/auth-guard"
import { MainLayout } from "@/components/layout/main-layout"
import { OrganizationSettings } from "@/components/settings/organization-settings"

export default function SettingsPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <OrganizationSettings />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
