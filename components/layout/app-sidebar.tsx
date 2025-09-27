"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BarChart3, Zap, FileText, ChevronLeft, ChevronRight, HelpCircle, Settings, LogOut, Menu, X } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/components/providers/auth-provider"

const navigation = [
	{
		name: "Dashboard",
		href: "/dashboard",
		icon: BarChart3,
		description: "View your transformation analytics",
	},
	{
		name: "Transform Data",
		href: "/data-tools",
		icon: Zap,
		description: "Upload and transform your files",
	},
	{
		name: "File Manager",
		href: "/files",
		icon: FileText,
		description: "Manage your transformed files",
	},
	{
		name: "Admin",
		href: "/admin",
		icon: Settings,
		description: "Access organization admin page",
	},
]

export function AppSidebar() {
	const [collapsed, setCollapsed] = useState(false)
	const [isMobile, setIsMobile] = useState(false)
	const [mobileOpen, setMobileOpen] = useState(false)
	const pathname = usePathname()
	const { logout, isAuthenticated, user } = useAuth()

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024)
			if (window.innerWidth < 1024) {
				setCollapsed(false)
			}
		}
		
		checkMobile()
		window.addEventListener('resize', checkMobile)
		return () => window.removeEventListener('resize', checkMobile)
	}, [])

	useEffect(() => {
		setMobileOpen(false)
	}, [pathname])

	const handleLogout = () => {
		logout()
		window.location.href = '/auth/login'
	}

	return (
		<div>
			{/* Mobile Menu Button */}
			{isMobile && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setMobileOpen(true)}
					className="fixed top-4 right-4 z-50 lg:hidden bg-white shadow-md"
				>
					<Menu className="w-5 h-5" />
				</Button>
			)}

			{/* Mobile Overlay */}
			{isMobile && mobileOpen && (
				<div 
					className="fixed inset-0 bg-black/50 z-40 lg:hidden"
					onClick={() => setMobileOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<div
				className={cn(
					"flex flex-col h-screen bg-white border-r border-gray-200 shadow-sm transition-all duration-300",
					isMobile ? [
						"fixed left-0 top-0 z-50 w-72",
						mobileOpen ? "translate-x-0" : "-translate-x-full"
					] : [
						"relative",
						collapsed ? "w-16" : "w-72"
					]
				)}
			>
				<div className="flex items-center justify-between p-6 border-b border-gray-100">
					{!collapsed && (
						<div className="flex items-center space-x-3">
							<div className="relative w-10 h-10">
								<Image
									src="/images/infiniqon-logo-light.png"
									alt="Infiniqon"
									width={40}
									height={40}
									className="rounded-lg object-contain"
								/>
							</div>
							<div>
								<span className="font-playfair font-bold text-xl text-gray-900">Infiniqon</span>
								<p className="text-xs text-gray-500 mt-0.5">Data Transformation</p>
							</div>
						</div>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setCollapsed(!collapsed)}
						className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
					>
						{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
					</Button>
				</div>

				<nav className="flex-1 p-4 space-y-2">
					{navigation.map((item) => {
						const isActive = pathname === item.href
						return (
							<Link key={item.name} href={item.href}>
								<div
									className={cn(
										"flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group",
										isActive
											? "bg-emerald-50 text-emerald-700 border border-emerald-200"
											: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
										collapsed && "justify-center px-3",
									)}
								>
									<item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-emerald-600" : "")} />
									{!collapsed && (
										<div className="flex-1">
											<div className="font-medium">{item.name}</div>
											<div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
										</div>
									)}
								</div>
							</Link>
						)
					})}
				</nav>

				<div className="p-4 border-t border-gray-100">
					{!collapsed && (
						<div className="space-y-3">
							{isAuthenticated && (
								<div className="px-4 py-2">
									<div className="text-xs text-gray-500 mb-2">Signed in as:</div>
									<div className="text-sm font-medium text-gray-900 truncate">
										{user?.email || 'User'}
									</div>
								</div>
							)}
							<Link
								href="/help"
								className="flex items-center space-x-3 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
							>
								<HelpCircle className="w-4 h-4" />
								<span className="text-sm">Help & Support</span>
							</Link>
							{isAuthenticated && (
								<Button
									onClick={handleLogout}
									variant="ghost"
									className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors justify-start"
								>
									<LogOut className="w-4 h-4" />
									<span className="text-sm">Logout</span>
								</Button>
							)}
							<div className="text-xs text-gray-400 text-center">
								<div className="font-medium">Infiniqon Platform</div>
								<div className="mt-1">Professional Data Transformation</div>
							</div>
						</div>
					)}
					{collapsed && isAuthenticated && (
						<div className="flex flex-col items-center space-y-2">
							<Button
								onClick={handleLogout}
								variant="ghost"
								size="sm"
								className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
								title="Logout"
							>
								<LogOut className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
