'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  Shield,
  Cpu,
  CheckCircle2,
  Truck,
  Loader2,
  Sparkles,
  ArrowRight,
  Database,
  RefreshCw,
} from 'lucide-react'
import {
  DEMO_PERSONAS,
  DEMO_PASSWORD,
  type DemoPersona,
} from '@/lib/auth/demo-accounts'
import { Button } from '@/components/ui/button'

const ICON_MAP = {
  Shield,
  Cpu,
  CheckCircle2,
  Truck,
}

export function DemoPersonaSelector({
  onSelectPersona,
}: {
  onSelectPersona?: (email: string, password: string) => void
}) {
  const router = useRouter()
  const [activePersonaId, setActivePersonaId] = React.useState<string | null>(
    null,
  )
  const [isSeeding, setIsSeeding] = React.useState(false)
  const [seedSuccess, setSeedSuccess] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const handleSeedDatabase = async () => {
    setError(null)
    setSeedSuccess(null)
    setIsSeeding(true)
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        setSeedSuccess('Demo database seeded with 7 releases, panel marks & users!')
      } else {
        setError(data.error || 'Failed to seed demo database.')
      }
    } catch {
      setError('Network error while requesting demo database seeding.')
    } finally {
      setIsSeeding(false)
    }
  }

  const handleQuickSignIn = async (persona: DemoPersona) => {
    setError(null)
    setSeedSuccess(null)
    setActivePersonaId(persona.id)
    onSelectPersona?.(persona.email, DEMO_PASSWORD)

    try {
      const result = await signIn('credentials', {
        email: persona.email,
        password: DEMO_PASSWORD,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        setError(
          'Could not sign in with demo credentials. Please click "Seed Demo Database" below to populate the database.',
        )
        setActivePersonaId(null)
      } else if (result?.url) {
        router.push(result.url)
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('An unexpected error occurred during demo sign-in.')
      setActivePersonaId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-orange h-4 w-4" />
          <span className="font-heading text-foreground text-xs font-bold tracking-wider uppercase">
            1-Click Demo Personas
          </span>
        </div>
        <button
          type="button"
          disabled={isSeeding || Boolean(activePersonaId)}
          onClick={handleSeedDatabase}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          {isSeeding ? (
            <RefreshCw className="h-3 w-3 animate-spin text-brand-blue" />
          ) : (
            <Database className="h-3 w-3 text-brand-blue" />
          )}
          <span>{isSeeding ? 'Seeding...' : 'Seed / Reset DB'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DEMO_PERSONAS.map((persona) => {
          const Icon = ICON_MAP[persona.icon]
          const isLoading = activePersonaId === persona.id

          return (
            <button
              key={persona.id}
              type="button"
              disabled={Boolean(activePersonaId) || isSeeding}
              onClick={() => handleQuickSignIn(persona)}
              className="group border-border bg-card/60 hover:border-brand-blue hover:bg-brand-blue/5 relative flex flex-col items-start justify-between rounded-lg border p-3 text-left transition-all hover:shadow-xs disabled:opacity-50"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                      <span>{persona.name}</span>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {persona.role}
                    </div>
                  </div>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-primary mt-1 h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-muted-foreground mt-2 text-[10px] leading-tight">
                {persona.description}
              </p>
            </button>
          )
        })}
      </div>

      {seedSuccess && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{seedSuccess}</span>
        </div>
      )}

      {error && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <p>{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSeeding}
            onClick={handleSeedDatabase}
            className="border-amber-400 bg-white dark:bg-card h-7 text-xs font-bold text-amber-900 dark:text-amber-200"
          >
            {isSeeding ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Seeding Demo Database...
              </>
            ) : (
              <>
                <Database className="mr-1 h-3 w-3" />
                Seed Demo Database Now
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
