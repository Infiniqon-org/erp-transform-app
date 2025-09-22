"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/hooks/useAuth'
import { Mail, ArrowLeft, Shield, CheckCircle, Timer, RotateCcw } from 'lucide-react'

interface EmailVerificationProps {
  email: string
  onVerified: () => void
  onBack: () => void
}

export function EmailVerification({ email, onVerified, onBack }: EmailVerificationProps) {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes
  const { confirmSignup } = useAuth()

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await confirmSignup(email, code)
      setSuccess(result.message)
      setTimeout(() => {
        onVerified()
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    // Implement resend logic here
    setTimeLeft(300) // Reset timer
    setError('')
    setSuccess('Verification code resent successfully!')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-1000">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl mb-4 shadow-lg animate-pulse">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent mb-2">
            Check Your Email
          </h1>
          <p className="text-slate-400 text-sm">
            We've sent a verification code to
          </p>
          <p className="text-blue-300 font-medium text-sm mt-1">
            {email}
          </p>
        </div>

        <Card className="backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl shadow-black/20 hover:shadow-black/30 transition-all duration-500">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center space-x-2 text-white/90">
              <Shield className="w-5 h-5" />
              <span className="text-lg font-semibold">Email Verification</span>
            </div>
            
            {/* Timer */}
            <div className="flex items-center space-x-2 text-sm text-slate-400">
              <Timer className="w-4 h-4" />
              <span>Code expires in {formatTime(timeLeft)}</span>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Verification Code Field */}
              <div className="space-y-2">
                <Label htmlFor="code" className="text-white/90 font-medium">
                  Verification Code
                </Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-blue-400/20 transition-all duration-200"
                  required
                  maxLength={6}
                />
                <p className="text-xs text-slate-400 text-center">
                  Enter the 6-digit code from your email
                </p>
              </div>

              {/* Alerts */}
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 animate-in slide-in-from-top-1 duration-300">
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-500/10 border-green-500/20 animate-in slide-in-from-top-1 duration-300">
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription className="text-green-200">{success}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none group" 
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>Verify Email</span>
                  </div>
                )}
              </Button>
            </form>

            {/* Resend Code */}
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-400">
                Didn't receive the code?
              </p>
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={timeLeft > 0}
                className="text-sm border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all duration-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {timeLeft > 0 ? `Resend in ${formatTime(timeLeft)}` : 'Resend Code'}
              </Button>
            </div>

            {/* Back Button */}
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
              className="w-full border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign Up
            </Button>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400">
              <p>
                Check your spam folder if you don't see the email
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
