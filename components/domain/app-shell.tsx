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
    <div className="bg-flow-workspace text-foreground selection:bg-brand-orange selection:text-brand-navy flex min-h-dvh w-full max-w-full flex-col overflow-x-hidden antialiased">
      <NavHeader
        user={user}
        siteName={siteName}
        timezone={timezone}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        onSignOut={onSignOut}
      />

      <div className="flex min-w-0 flex-1 overflow-hidden">
        {/* Desktop / Tablet Sidebar */}
        <aside className="flow-panel-grid border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-56 shrink-0 flex-col space-y-1 overflow-y-auto border-r p-3 md:flex lg:w-64">
          <div className="font-heading px-3 py-2 text-[11px] font-bold tracking-[0.16em] text-slate-300 uppercase">
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
                  className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'border-brand-orange bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-xs'
                      : 'hover:bg-sidebar-accent border-transparent text-slate-200 hover:border-slate-400 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}
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
            <div className="flow-panel-grid bg-sidebar text-sidebar-foreground relative z-10 flex h-full w-4/5 max-w-xs flex-col overflow-y-auto p-4 shadow-xl">
              <div className="border-sidebar-border flex items-center justify-between border-b pb-4">
                <span className="text-base font-bold">Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:bg-sidebar-accent min-h-11 min-w-11 rounded-md p-2 text-slate-300 hover:text-white"
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
                      className={`flex min-h-12 items-center gap-3 rounded-md border-l-2 px-3 py-3 text-sm font-medium ${
                        active
                          ? 'border-brand-orange bg-sidebar-primary font-semibold text-white'
                          : 'hover:bg-sidebar-accent border-transparent text-slate-200 hover:text-white'
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
        <main className="w-full max-w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom quick bar */}
      <nav className="border-sidebar-border bg-sidebar text-sidebar-foreground sticky bottom-0 z-30 grid grid-cols-4 border-t px-2 py-1.5 text-center text-[10px] shadow-lg md:hidden">
        <Link
          href="/dashboard"
          className={`flex min-h-12 flex-col items-center justify-center rounded-md border-t-2 py-1 ${
            isActive('/dashboard', true)
              ? 'border-brand-orange font-bold text-white'
              : 'border-transparent text-slate-300'
          }`}
        >
          <Compass className="mb-0.5 h-5 w-5" />
          Active
        </Link>
        <Link
          href="/scan"
          className={`flex min-h-12 flex-col items-center justify-center rounded-md border-t-2 py-1 ${
            isActive('/scan')
              ? 'border-brand-orange font-bold text-white'
              : 'border-transparent text-slate-300'
          }`}
        >
          <QrCode className="mb-0.5 h-5 w-5" />
          Scan
        </Link>
        <Link
          href="/production"
          className={`flex min-h-12 flex-col items-center justify-center rounded-md border-t-2 py-1 ${
            isActive('/production')
              ? 'border-brand-orange font-bold text-white'
              : 'border-transparent text-slate-300'
          }`}
        >
          <Cpu className="mb-0.5 h-5 w-5" />
          Shop
        </Link>
        <Link
          href="/quality"
          className={`flex min-h-12 flex-col items-center justify-center rounded-md border-t-2 py-1 ${
            isActive('/quality')
              ? 'border-brand-orange font-bold text-white'
              : 'border-transparent text-slate-300'
          }`}
        >
          <ShieldAlert className="mb-0.5 h-5 w-5" />
          Holds
        </Link>
      </nav>
    </div>
  )
}
