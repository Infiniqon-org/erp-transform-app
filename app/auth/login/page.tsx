"use client"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 m-2 rounded-3xl">
        {/* Animated background waves */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20"></div>
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            <path d="M0,100 C150,200 350,0 500,100 C650,200 850,0 1000,100 L1000,1000 L0,1000 Z" fill="url(#gradient1)" opacity="0.3">
              <animateTransform attributeName="transform" type="translate" values="0,0;50,0;0,0" dur="10s" repeatCount="indefinite"/>
            </path>
            <path d="M0,200 C150,300 350,100 500,200 C650,300 850,100 1000,200 L1000,1000 L0,1000 Z" fill="url(#gradient2)" opacity="0.2">
              <animateTransform attributeName="transform" type="translate" values="0,0;-30,0;0,0" dur="8s" repeatCount="indefinite"/>
            </path>
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1"/>
              </linearGradient>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
