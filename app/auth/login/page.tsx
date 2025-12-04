"use client"

import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#2a4477] via-[#0cbeb6] to-[#00dfc2] m-2 rounded-3xl">
        {/* Static brand gradient background, no animations */}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Welcome<br/>
              Back to<br/>
              Transform
            </h1>
            <p className="text-xl text-white/80 leading-relaxed max-w-md">
              Access your dashboard and continue transforming your data with our powerful platform. Your workspace awaits.
            </p>
          </div>
          
          {/* Features highlight */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              <span className="text-white/70">Real-time data processing</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              <span className="text-white/70">Advanced analytics</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              <span className="text-white/70">Secure & reliable</span>
            </div>
          </div>
          
          {/* Quote attribution */}
          <div className="text-sm text-white/60 mt-8">
            POWERFUL • SECURE • RELIABLE
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
