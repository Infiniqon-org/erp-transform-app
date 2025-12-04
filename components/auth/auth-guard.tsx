"use client"

import { useAuth } from '@/components/providers/auth-provider'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = redirectTo
    }
  }, [isAuthenticated, isLoading, redirectTo])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-full h-10 w-10 border-2 border-muted-foreground"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return <>{children}</>
}
