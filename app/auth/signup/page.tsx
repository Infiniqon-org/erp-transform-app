"use client"

import { SignUpForm } from "@/components/auth/signup-form"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#2a4477] via-[#0cbeb6] to-[#00dfc2] m-2 rounded-3xl">
        {/* Static brand gradient background, no animations */}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Start Your<br/>
              Journey<br/>
              Today
            </h1>
            <p className="text-xl text-white/80 leading-relaxed max-w-md">
              Transform your data with our powerful platform. Join thousands of users already succeeding.
            </p>
          </div>
          
          {/* Quote attribution */}
          <div className="text-sm text-white/60">
            YOUR SUCCESS STARTS HERE
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <SignUpForm />
        </div>
      </div>
    </div>
  )
}
