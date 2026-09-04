'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { Fingerprint, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasskeyItem {
  id: string
  friendlyName: string | null
  deviceType: string
  backedUp: boolean
  lastUsedAt: string | null
  createdAt: string
}

const subscribeToSupport = () => () => {}

export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supported = useSyncExternalStore(
    subscribeToSupport,
    browserSupportsWebAuthn,
    () => false,
  )

  useEffect(() => {
    void loadPasskeys()
  }, [])

  async function loadPasskeys() {
    try {
      const res = await fetch('/api/auth/passkey/list')
      if (!res.ok) throw new Error('Could not load passkeys.')
      if (res.ok) {
        const data = await res.json()
        setPasskeys(data.passkeys || [])
      }
    } catch {
      setError('Could not load passkeys. Please reload and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterPasskey(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setRegistering(true)

    try {
      // 1. Request registration options
      const optRes = await fetch(
        '/api/auth/passkey/generate-options?mode=register',
      )
      if (!optRes.ok) {
        throw new Error('Failed to start passkey registration ceremony.')
      }
      const { options } = await optRes.json()

      // 2. Browser biometric / security key prompt
      const regResp = await startRegistration({ optionsJSON: options })

      // 3. Verify on server
      const verifyRes = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: regResp,
          friendlyName: keyName.trim() || 'My Passkey',
        }),
      })

      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Registration verification failed.')
      }

      setSuccess(
        'Passkey registered successfully! You can now use it to sign in.',
      )
      setKeyName('')
      await loadPasskeys()
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'NotAllowedError') {
        setError(
          (err instanceof Error ? err.message : undefined) ||
            'Passkey registration failed.',
        )
      }
    } finally {
      setRegistering(false)
    }
  }

  async function handleDeletePasskey(id: string) {
    if (!confirm('Are you sure you want to remove this passkey?')) return
    try {
      const res = await fetch(`/api/auth/passkey/list?id=${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Could not load passkeys.')
      if (res.ok) {
        setPasskeys((prev) => prev.filter((k) => k.id !== id))
        setSuccess('Passkey removed.')
      }
    } catch {
      setError('Failed to delete passkey.')
    }
  }

  if (!supported) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Passkeys and WebAuthn hardware authenticators are not supported in this
        browser.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-lg font-bold text-slate-900 uppercase">
            Passkeys & Security Keys
          </h3>
          <p className="text-sm text-slate-500">
            Sign in instantly using Touch ID, Face ID, Windows Hello, or a
            hardware security key.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}

      {/* Register New Form */}
      <form
        onSubmit={handleRegisterPasskey}
        className="flex flex-col items-end gap-3 sm:flex-row"
      >
        <div className="w-full flex-1 space-y-1.5">
          <Label
            htmlFor="keyName"
            className="text-xs font-semibold text-slate-600 uppercase"
          >
            Passkey / Device Name
          </Label>
          <Input
            id="keyName"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g. Shop Floor iPad, Work MacBook, YubiKey"
            className="bg-white"
            disabled={registering}
          />
        </div>
        <Button
          type="submit"
          disabled={registering}
          className="font-heading shrink-0 font-semibold tracking-wider uppercase"
        >
          {registering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add Passkey
            </>
          )}
        </Button>
      </form>

      {/* List Existing Keys */}
      <div className="divide-y divide-slate-200 rounded-md border bg-white shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading passkeys...
          </div>
        ) : passkeys.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No passkeys registered yet. Add one above for instant, passwordless
            sign-in.
          </div>
        ) : (
          passkeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between p-4 hover:bg-slate-50/50"
            >
              <div className="flex items-center gap-3">
                <div className="bg-brand-blue/10 text-brand-blue flex h-9 w-9 items-center justify-center rounded-full">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {k.friendlyName || 'Security Key'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Added {new Date(k.createdAt).toLocaleDateString()} •{' '}
                    {k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : 'Never used'}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${k.friendlyName || 'security key'}`}
                onClick={() => handleDeletePasskey(k.id)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
