'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, LogOut, ShieldCheck, Clock, MapPin, Menu } from 'lucide-react'
import { OfflineStatus } from '@/components/offline-status'
import { GlobalSearchDialog } from './global-search-dialog'
import { ElwardFlowBrand } from '@/components/brand/elward-flow-brand'

interface NavHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    isAdmin?: boolean
    roles?: string[]
  }
  siteName?: string
  timezone?: string
  onToggleMobileMenu?: () => void
  onSignOut: () => Promise<void>
}

export function NavHeader({
  user,
  siteName = 'Fictional Primary Plant',
  timezone = 'America/Denver',
  onToggleMobileMenu,
  onSignOut,
}: NavHeaderProps) {
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Register Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const primaryRole =
    user.roles && user.roles.length > 0
      ? user.roles[0]
      : user.isAdmin
        ? 'Administrator'
        : 'Operator'

  return (
    <>
      <header className="border-sidebar-border bg-flow-chrome/98 sticky top-0 z-40 flex min-h-16 w-full items-center justify-between gap-3 border-b px-4 py-2.5 text-white shadow-md backdrop-blur-md">
        {/* Left branding & mobile menu toggle */}
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          {onToggleMobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMobileMenu}
              className="hover:bg-sidebar-accent h-11 w-11 text-slate-200 hover:text-white md:hidden"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <Link
            href="/dashboard"
            className="flex items-center"
            aria-label="Elward Flow dashboard"
          >
            <ElwardFlowBrand compact priority />
          </Link>

          <div className="border-sidebar-border hidden items-center gap-2 border-l pl-3 text-xs text-slate-300 lg:flex">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{siteName}</span>
            <span className="text-slate-500">•</span>
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{timezone}</span>
          </div>
        </div>

        {/* Global Search trigger */}
        <div className="mx-0 min-w-0 shrink-0 sm:mx-2 sm:max-w-md sm:flex-1">
          <Button
            variant="outline"
            aria-label="Search records"
            onClick={() => setSearchOpen(true)}
            className="border-sidebar-border bg-sidebar-accent hover:bg-brand-navy h-10 w-10 justify-center px-0 text-xs text-slate-300 hover:text-white sm:w-full sm:justify-between sm:px-3"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="text-brand-orange h-3.5 w-3.5 shrink-0" />
              <span className="hidden truncate sm:inline">
                Search job, release, mark, PO...
              </span>
            </span>
            <kbd className="border-sidebar-border bg-flow-chrome hidden rounded-sm border px-1.5 py-0.5 font-mono text-[10px] text-slate-300 shadow-2xs sm:inline-flex">
              Ctrl+K
            </kbd>
          </Button>
        </div>

        {/* Right action status & user profile */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
          <OfflineStatus />

          <div className="hidden flex-col items-end text-right sm:flex">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span className="max-w-[150px] truncate text-xs font-semibold text-white">
                {user.name || user.email}
              </span>
            </div>
            <Badge
              variant="secondary"
              className="border-sidebar-border bg-sidebar-accent border px-1.5 py-0 text-[10px] font-medium text-slate-200"
            >
              {primaryRole}
            </Badge>
          </div>

          <form action={onSignOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-10 px-2.5 text-slate-200 hover:bg-red-950/50 hover:text-red-200"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1.5 hidden text-xs md:inline">Sign Out</span>
            </Button>
          </form>
        </div>
      </header>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
