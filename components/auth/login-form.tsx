"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AnimatePresence, motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckCircle, Eye, EyeOff, Lock, Mail, Shield, Smartphone, Copy, Check } from "lucide-react"
import { LoadingDots, LoadingSpinner } from "@/components/ui/loading"
import { useEffect, useState } from 'react'

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import QRCode from 'qrcode'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)
  
  // MFA Setup state
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false)
  const [mfaSetupStep, setMfaSetupStep] = useState<'qr' | 'verify'>('qr')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [setupMfaCode, setSetupMfaCode] = useState('')
  const [mfaSetupSession, setMfaSetupSession] = useState<string | null>(null)
  const [copiedSecret, setCopiedSecret] = useState(false)

  const { login, verifyMfaCode, setupMfaWithSession, confirmMfaSetupWithSession, mfaRequired, mfaSession, cancelMfa } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  // NOTE: Removed automatic MFA modal trigger - the login handler now explicitly
  // decides whether to show MFA verification modal or MFA setup modal

  // Function to mask email - show first 2 chars, last char, and mask the middle
  const maskEmail = (email: string): string => {
    const [localPart, domain] = email.split('@')
    if (!localPart || !domain) return email

    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`
    }

    // Show first 2 characters, mask middle, show last character
    const firstPart = localPart.substring(0, 2)
    const lastChar = localPart[localPart.length - 1]
    const middleLength = localPart.length - 3
    const masked = '*'.repeat(Math.max(middleLength, 4))
    return `${firstPart}${masked}${lastChar}@${domain}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await login(email, password)

      if (result.mfaRequired) {
        // Existing user with MFA - show verification modal
        setShowMfaModal(true)
        setIsLoading(false)
        return
      }

      if (result.mfaSetupRequired) {
        // First time MFA setup required - show QR code
        // Pass session directly to avoid React async state timing issue
        await handleMfaSetupStart(result.session)
        return
      }

      if (result.success) {
        setSuccess('Login successful!')
        setIsVerifying(true)
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1500)
      }
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  // Start MFA setup - get QR code
  const handleMfaSetupStart = async (session?: string) => {
    try {
      const sessionToUse = session || mfaSetupSession
      if (!sessionToUse) {
        throw new Error('No MFA setup session available')
      }

      // Call Cognito to get the secret code
      const result = await setupMfaWithSession(sessionToUse, email)
      
      // Generate QR code image from the TOTP URI
      const qrDataUrl = await QRCode.toDataURL(result.qrCodeUrl, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      
      setQrCodeDataUrl(qrDataUrl)
      setSecretCode(result.secretCode)
      setMfaSetupSession(result.session) // Update with new session
      setShowMfaSetupModal(true)
      setMfaSetupStep('qr')
      setIsLoading(false)
      
    } catch (err: any) {
      setError(err.message || 'Failed to start MFA setup')
      setIsLoading(false)
    }
  }

  const handleVerifyMfa = async () => {
    setMfaError('')

    // Check if code is 6 digits
    if (mfaCode.length !== 6 || !/^\d{6}$/.test(mfaCode)) {
      setMfaError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifyingMfa(true)

    try {
      const result = await verifyMfaCode(mfaCode)

      if (result.success) {
        setIsVerifying(true)
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1500)
      }
    } catch (err: any) {
      setMfaError(err.message || 'Invalid verification code')
      setIsVerifyingMfa(false)
    }
  }

  const handleCloseMfaModal = () => {
    setShowMfaModal(false)
    setMfaCode('')
    setMfaError('')
    setIsVerifyingMfa(false)
    cancelMfa()
  }

  const handleCloseMfaSetupModal = () => {
    setShowMfaSetupModal(false)
    setMfaSetupStep('qr')
    setSetupMfaCode('')
    setQrCodeDataUrl('')
    setSecretCode('')
    setMfaSetupSession(null)
    cancelMfa()
  }

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secretCode)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    } catch (err) {
      console.error('Failed to copy secret')
    }
  }

  const handleVerifySetupMfa = async () => {
    if (setupMfaCode.length !== 6 || !/^\d{6}$/.test(setupMfaCode)) {
      setMfaError('Please enter a valid 6-digit code')
      return
    }

    if (!mfaSetupSession) {
      setMfaError('MFA setup session expired. Please try again.')
      return
    }

    setIsVerifyingMfa(true)
    setMfaError('')

    try {
      const result = await confirmMfaSetupWithSession(mfaSetupSession, setupMfaCode, email)
      if (result.success) {
        setIsVerifying(true)
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 1500)
      }
    } catch (err: any) {
      setMfaError(err.message || 'Verification failed')
      setIsVerifyingMfa(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="w-full">
      {/* Header Section with Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <Image
              src="/images/infiniqon-logo-light.png"
              alt="CleanFlowAI"
              width={64}
              height={64}
              className="rounded-xl object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Welcome back
        </h1>
        <p className="text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>

      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardContent className="space-y-6 p-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-12 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Remember me and Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <Label htmlFor="remember" className="text-sm text-muted-foreground">
                  Remember me
                </Label>
              </div>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-accent hover:opacity-90"
              >
                Forgot password?
              </Link>
            </div>

            {/* Alerts */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-700 flex items-center gap-2">
                      {isVerifying ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Verifying credentials...</span>
                          <LoadingDots />
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>{success}</span>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={isLoading || isVerifying}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center space-x-2"
                    >
                      <LoadingSpinner size="sm" />
                      <span>Signing in...</span>
                    </motion.div>
                  ) : isVerifying ? (
                    <motion.div
                      key="verifying"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center space-x-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Success! Redirecting...</span>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="signin"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Sign in
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </motion.div>
          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-accent hover:opacity-90 font-medium"
            >
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* MFA Modal */}
      <Dialog open={showMfaModal} onOpenChange={handleCloseMfaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-center">
              Enter the 6-digit code from your authenticator app for{' '}
              <span className="font-medium text-foreground">{maskEmail(email)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            {/* MFA Code Input */}
            <div className="space-y-3">
              <Label htmlFor="mfa-code" className="text-sm font-medium">
                Enter 6-digit code
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setMfaCode(value)
                }}
                className="h-12 text-center text-2xl tracking-widest font-mono mt-2"
                disabled={isVerifyingMfa || isVerifying}
                autoFocus
              />
            </div>

            {/* MFA Error */}
            {mfaError && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-700">{mfaError}</AlertDescription>
              </Alert>
            )}

            {/* Verify Button */}
            <Button
              onClick={handleVerifyMfa}
              className="w-full h-12"
              disabled={mfaCode.length !== 6 || isVerifyingMfa || isVerifying}
            >
              {isVerifyingMfa ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>Verifying...</span>
                </div>
              ) : isVerifying ? (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Verified! Redirecting...</span>
                </div>
              ) : (
                'Verify Code'
              )}
            </Button>

            {/* Help text */}
            <p className="text-center text-sm text-muted-foreground">
              Open your authenticator app (Google Authenticator, Authy, etc.) to get the code
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Modal (First-time setup with QR code) */}
      <Dialog open={showMfaSetupModal} onOpenChange={handleCloseMfaSetupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Set Up Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-center">
              Scan the QR code with your authenticator app to enable 2FA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Step 1: QR Code */}
            {mfaSetupStep === 'qr' && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                      <div className="text-center text-sm text-muted-foreground">
                        <Smartphone className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>Scan QR code in your</p>
                        <p>authenticator app</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Manual entry option */}
                {secretCode && secretCode !== 'Please complete setup to get your secret code' && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Can't scan? Enter this code manually:
                    </Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                        {secretCode}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopySecret}
                        className="shrink-0"
                      >
                        {copiedSecret ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => setMfaSetupStep('verify')}
                  className="w-full h-12"
                >
                  I've scanned the QR code
                </Button>
              </>
            )}

            {/* Step 2: Verify code */}
            {mfaSetupStep === 'verify' && (
              <>
                <div className="space-y-3">
                  <Label htmlFor="setup-mfa-code" className="text-sm font-medium">
                    Enter the 6-digit code from your authenticator app
                  </Label>
                  <Input
                    id="setup-mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={setupMfaCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setSetupMfaCode(value)
                    }}
                    className="h-12 text-center text-2xl tracking-widest font-mono"
                    disabled={isVerifyingMfa || isVerifying}
                    autoFocus
                  />
                </div>

                {mfaError && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-700">{mfaError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setMfaSetupStep('qr')}
                    className="flex-1"
                    disabled={isVerifyingMfa || isVerifying}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleVerifySetupMfa}
                    className="flex-1"
                    disabled={setupMfaCode.length !== 6 || isVerifyingMfa || isVerifying}
                  >
                    {isVerifyingMfa ? (
                      <div className="flex items-center space-x-2">
                        <LoadingSpinner size="sm" />
                        <span>Verifying...</span>
                      </div>
                    ) : isVerifying ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Success!</span>
                      </div>
                    ) : (
                      'Verify & Enable'
                    )}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Supported apps: Google Authenticator, Authy, Microsoft Authenticator
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
