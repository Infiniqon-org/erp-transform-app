"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useEffect, useState } from 'react'

import { Button } from "@/components/ui/button"
import { EmailVerification } from "./email-verification"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showVerification, setShowVerification] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { signup } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await signup(email, password, confirmPassword)
      setSuccess(result.message)
      if (!result.confirmed) {
        setShowVerification(true)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerificationComplete = () => {
    setShowVerification(false)
    window.location.href = '/dashboard'
  }

  const handleBackToSignup = () => {
    setShowVerification(false)
    setError('')
    setSuccess('')
  }

  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  const getPasswordStrengthLabel = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return 'Very Weak'
      case 2:
        return 'Weak'
      case 3:
        return 'Fair'
      case 4:
        return 'Good'
      case 5:
        return 'Strong'
      default:
        return ''
    }
  }

  const getPasswordStrengthColor = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return 'bg-red-500'
      case 2:
        return 'bg-orange-500'
      case 3:
        return 'bg-yellow-500'
      case 4:
        return 'bg-blue-500'
      case 5:
        return 'bg-green-500'
      default:
        return 'bg-gray-200'
    }
  }

  if (!mounted) return null

  if (showVerification) {
    return <EmailVerification email={email} onVerified={handleVerificationComplete} onBack={handleBackToSignup} />
  }

  return (
    <div className="w-full">
      {/* Header Section with Logo */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16">
            <Image
              src="/images/infiniqon-logo-light.png"
              alt="Infiniqon"
              width={64}
              height={64}
              className="rounded-xl object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Create account
        </h1>
        <p className="text-muted-foreground">
          Get started with your free account today
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
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
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

              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(getPasswordStrength(password))}`}
                        style={{ width: `${(getPasswordStrength(password) / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {getPasswordStrengthLabel(getPasswordStrength(password))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-muted-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-12 border-input focus:border-primary focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Terms and Privacy */}
            <div className="flex items-start space-x-2">
              <input
                id="terms"
                type="checkbox"
                required
                className="h-4 w-4 mt-0.5 rounded border-input text-primary focus:ring-ring"
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-5">
                I agree to the{' '}
                <Link href="/terms" className="text-accent hover:opacity-90">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-accent hover:opacity-90">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            {/* Alerts */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          {/* Sign in link */}
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-accent hover:opacity-90 font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
