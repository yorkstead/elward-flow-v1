'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavHeader } from './nav-header'
import {
  Compass,
  Layers,
  QrCode,
  Cpu,
  PackageCheck,
  ShieldAlert,
  Boxes,
  Truck,
  BarChart3,
  Settings,
  HardDrive,
  X,
} from 'lucide-react'

interface AppShellProps {
  user: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean
    roles?: string[]
  }
  siteName?: string
  timezone?: string
  children: React.ReactNode
  onSignOut: () => Promise<void>
}

export function AppShell({
  user,
  siteName,
  timezone,
  children,
  onSignOut,
}: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const isAdministrator =
    user.isAdmin ||
    (user.roles &&
      (user.roles.includes('System Administrator') ||
        user.roles.includes('Operations Manager')))

  const navItems = [
    { href: '/dashboard', label: 'Active Release', icon: Compass, exact: true },
    { href: '/releases', label: 'Releases', icon: Layers },
    { href: '/scan', label: 'Scan Station', icon: QrCode },
    { href: '/production', label: 'Production', icon: Cpu },
    { href: '/inventory', label: 'Inventory', icon: PackageCheck },
    { href: '/quality', label: 'Quality & Holds', icon: ShieldAlert },
    { href: '/pallets', label: 'Pallets', icon: Boxes },
    { href: '/shipping', label: 'Shipping', icon: Truck },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    ...(isAdministrator
      ? [{ href: '/admin', label: 'Administration', icon: Settings }]
      : []),
    { href: '/dashboard/storage-test', label: 'Storage Test', icon: HardDrive },
  ]

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      <NavHeader
        user={user}
        siteName={siteName}
        timezone={timezone}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        onSignOut={onSignOut}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop / Tablet Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col space-y-1 overflow-y-auto border-r bg-white p-3 md:flex lg:w-64">
          <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
            Operations Chain
          </div>

          <nav className="space-y-0.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const active = isActive(item.href, item.exact)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-blue-600 font-semibold text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-500'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Mobile slide-over drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex h-full w-4/5 max-w-xs flex-col overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-base font-bold">Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href, item.exact)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                        active
                          ? 'bg-blue-600 font-semibold text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content Workspace */}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile bottom quick bar */}
      <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] shadow-lg md:hidden">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center rounded-md py-1 ${
            isActive('/dashboard', true)
              ? 'font-bold text-blue-600'
              : 'text-slate-600'
          }`}
        >
          <Compass className="mb-0.5 h-5 w-5" />
          Active
        </Link>
        <Link
          href="/scan"
          className={`flex flex-col items-center rounded-md py-1 ${
            isActive('/scan') ? 'font-bold text-blue-600' : 'text-slate-600'
          }`}
        >
          <QrCode className="mb-0.5 h-5 w-5" />
          Scan
        </Link>
        <Link
          href="/production"
          className={`flex flex-col items-center rounded-md py-1 ${
            isActive('/production')
              ? 'font-bold text-blue-600'
              : 'text-slate-600'
          }`}
        >
          <Cpu className="mb-0.5 h-5 w-5" />
          Shop
        </Link>
        <Link
          href="/quality"
          className={`flex flex-col items-center rounded-md py-1 ${
            isActive('/quality') ? 'font-bold text-blue-600' : 'text-slate-600'
          }`}
        >
          <ShieldAlert className="mb-0.5 h-5 w-5" />
          Holds
        </Link>
      </nav>
    </div>
  )
}
