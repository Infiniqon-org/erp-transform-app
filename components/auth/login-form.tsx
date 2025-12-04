"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AnimatePresence, motion } from "framer-motion"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { CheckCircle, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { LoadingDots, LoadingSpinner } from "@/components/ui/loading"
import { useEffect, useState } from 'react'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useAuth } from "@/components/providers/auth-provider"

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const { login } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await login(email, password)
      setSuccess(result.message)
      setIsVerifying(true)

      // Add a small delay for verification animation
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="text-center mb-8">
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
    </div>
  )
}
