"use client"

import { AuthGuard } from "@/components/auth/auth-guard"
import { MainLayout } from "@/components/layout/main-layout"
import { OrganizationAdmin } from "@/components/admin/organization-admin"

export default function AdminPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <OrganizationAdmin />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
