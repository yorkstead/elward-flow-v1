'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Loader2,
  ArrowRight,
  Layers,
  FileText,
  Building,
  Folder,
} from 'lucide-react'
import type { SearchResultItem } from '@/lib/services/search'

interface GlobalSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResultItem[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
    onOpenChange(isOpen)
  }

  const handleSearch = React.useCallback((searchQuery: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (searchQuery.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`,
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data.results || [])
          setSelectedIndex(0)
        }
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [])

  const handleSelect = (item: SearchResultItem) => {
    onOpenChange(false)
    router.push(item.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'job':
      case 'release':
        return <Layers className="h-4 w-4 text-blue-600" />
      case 'mark':
        return <FileText className="h-4 w-4 text-emerald-600" />
      case 'customer':
        return <Building className="h-4 w-4 text-amber-600" />
      case 'project':
        return <Folder className="h-4 w-4 text-purple-600" />
      default:
        return <Search className="h-4 w-4 text-slate-500" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden border border-slate-200 p-0 shadow-2xl">
        <DialogHeader className="border-b bg-slate-50 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Search className="h-4 w-4 text-slate-600" />
            Global Search
            <span className="ml-auto text-xs font-normal text-slate-400">
              ESC to close • ↑↓ to navigate • Enter to select
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="relative border-b p-4">
          <Input
            autoFocus
            placeholder="Search by 5-digit job (25036), release (25036-1), mark (P-101), customer, project..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            className="bg-white py-5 pr-10 pl-10 text-base shadow-inner"
          />
          <Search className="pointer-events-none absolute top-1/2 left-7 h-5 w-5 -translate-y-1/2 text-slate-400" />
          {loading && (
            <Loader2 className="absolute top-1/2 right-7 h-5 w-5 -translate-y-1/2 animate-spin text-blue-600" />
          )}
        </div>

        <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto p-2">
          {query.trim().length >= 2 && results.length === 0 && !loading && (
            <div className="py-10 text-center text-sm text-slate-500">
              No matching jobs, releases, marks, or records found for &ldquo;
              {query}&rdquo;.
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Type at least 2 characters to search across all operational
              records.
            </div>
          )}

          {results.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors ${
                selectedIndex === idx
                  ? 'border-blue-200 bg-blue-50/80 text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded border border-slate-200 bg-white p-2 shadow-xs">
                  {getIcon(item.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {item.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] tracking-wider uppercase"
                    >
                      {item.type}
                    </Badge>
                    {item.status && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {item.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-600">
                    {item.subtitle}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-blue-600">
                    ↳ {item.matchReason}
                  </p>
                </div>
              </div>
              <ArrowRight
                className={`h-4 w-4 shrink-0 ${selectedIndex === idx ? 'text-blue-600' : 'text-slate-300'}`}
              />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
