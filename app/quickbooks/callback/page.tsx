'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * QuickBooks OAuth Callback Handler
 * This component handles the redirect from Lambda after OAuth authorization
 * NOTE: The Lambda already exchanged the code for tokens, so we just show success!
 */
function QuickBooksCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Connecting to QuickBooks...')

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      console.log('[QuickBooks Callback] Starting OAuth callback handling...')

      // Extract query parameters from URL
      const code = searchParams.get('code')
      const realmId = searchParams.get('realmId')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const success = searchParams.get('success') // Added by Lambda redirect

      console.log('[QuickBooks Callback] Parameters:', {
        code: code ? '***' : null,
        realmId,
        state: state ? state.substring(0, 36) + '...' : null,
        error,
        success,
      })

      // Check for OAuth errors
      if (error) {
        console.error('[QuickBooks Callback] OAuth error from QuickBooks:', error)
        throw new Error(searchParams.get('error_description') || 'Authorization failed')
      }

      // Validate required parameters
      if (!realmId) {
        console.error('[QuickBooks Callback] Missing realmId')
        throw new Error('Missing realm ID')
      }

      // Check if Lambda already processed this (success=true means Lambda already exchanged code)
      if (success === 'true') {
        console.log('[QuickBooks Callback] ✅ Lambda already exchanged code and stored tokens!')
        console.log('[QuickBooks Callback] Realm ID:', realmId)

        // Success! Lambda already did the work (exchanged code, stored tokens)
        setStatus('success')
        setMessage('Successfully connected to QuickBooks!')

        // Send message to parent window (if opened as popup)
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'quickbooks-auth-success',
              realmId: realmId,
            },
            window.location.origin
          )

          // Close popup after short delay
          setTimeout(() => {
            window.close()
          }, 1500)
        } else {
          // If not a popup, redirect to Files page
          setTimeout(() => {
            router.push('/files?quickbooks=connected')
          }, 2000)
        }
      } else {
        // No success=true parameter means something went wrong
        throw new Error('OAuth flow incomplete - missing success parameter from Lambda')
      }
    } catch (err) {
      console.error('OAuth callback error:', err)
      setStatus('error')
      setMessage((err as Error).message || 'Failed to connect to QuickBooks')

      // Send error message to parent window (if opened as popup)
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'quickbooks-auth-error',
            error: (err as Error).message || 'Connection failed',
          },
          window.location.origin
        )

        // Keep popup open for 5 seconds to see error
        setTimeout(() => {
          window.close()
        }, 5000)
      } else {
        // If not a popup, redirect back with error
        setTimeout(() => {
          router.push('/files?quickbooks=error')
        }, 3000)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
      <div className="bg-card border rounded-xl shadow-lg p-8 max-w-sm w-full">
        {/* Processing State */}
        {status === 'processing' && (
          <div className="text-center">
            <div className="mb-5">
              <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connecting to QuickBooks</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <div className="text-center">
            <div className="mb-5">
              <div className="w-14 h-14 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connected</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">This window will close automatically...</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center">
            <div className="mb-5">
              <div className="w-14 h-14 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Connection Failed</h2>
            <p className="text-sm text-muted-foreground mb-3">{message}</p>
            <p className="text-xs text-muted-foreground">Redirecting you back...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CallbackLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
      <div className="bg-card border rounded-xl shadow-lg p-8 max-w-sm w-full">
        <div className="text-center">
          <div className="mb-5">
            <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Loading...</h2>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      </div>
    </div>
  )
}

export default function QuickBooksCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoadingFallback />}>
      <QuickBooksCallbackContent />
    </Suspense>
  )
}
