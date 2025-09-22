"use client"
import { MainLayout } from "@/components/layout/main-layout"
import { OrganizationAdmin } from "@/components/admin/organization-admin"
import { AuthGuard } from "@/components/auth/auth-guard"

export default function AdminPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <div className="container mx-auto p-6 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Organization Admin</h1>
            <p className="text-muted-foreground mt-2 text-lg">Manage your organization details, subscription plan, and preferred data formats.</p>
          </div>
          <OrganizationAdmin />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
