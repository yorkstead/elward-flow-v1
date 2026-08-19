'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, LogOut, ShieldCheck, Clock, MapPin, Menu } from 'lucide-react'
import { OfflineStatus } from '@/components/offline-status'
import { GlobalSearchDialog } from './global-search-dialog'

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
      <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b bg-white/95 px-4 py-2.5 shadow-xs backdrop-blur-md">
        {/* Left branding & mobile menu toggle */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMobileMenu}
              className="h-9 w-9 text-slate-600 md:hidden"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold tracking-tight text-slate-900"
          >
            <div className="rounded bg-slate-900 px-2 py-1 font-mono text-xs font-black text-white">
              EF
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold tracking-tight">
                ELWARD FLOW
              </span>
              <span className="text-[10px] font-medium tracking-widest text-slate-500 uppercase">
                Manufacturing OS
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-500 lg:flex">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{siteName}</span>
            <span className="text-slate-300">•</span>
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>{timezone}</span>
          </div>
        </div>

        {/* Global Search trigger */}
        <div className="mx-2 max-w-md flex-1">
          <Button
            variant="outline"
            aria-label="Search records"
            onClick={() => setSearchOpen(true)}
            className="h-9 w-full justify-between border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 hover:bg-slate-100"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">Search job, release, mark, PO...</span>
            </span>
            <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 shadow-2xs sm:inline-flex">
              Ctrl+K
            </kbd>
          </Button>
        </div>

        {/* Right action status & user profile */}
        <div className="flex items-center gap-2.5">
          <OfflineStatus />

          <div className="hidden flex-col items-end text-right sm:flex">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span className="max-w-[150px] truncate text-xs font-semibold text-slate-800">
                {user.name || user.email}
              </span>
            </div>
            <Badge
              variant="secondary"
              className="bg-slate-100 px-1.5 py-0 text-[10px] font-medium text-slate-700"
            >
              {primaryRole}
            </Badge>
          </div>

          <form action={onSignOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
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
