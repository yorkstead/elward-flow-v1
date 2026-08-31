'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SignInForm({
  invalidCredentials,
}: {
  invalidCredentials: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn())
  }, [])

  async function handlePasskeySignIn() {
    setPasskeyError(null)
    setIsPasskeyLoading(true)
    try {
      // 1. Fetch authentication options from server
      const optRes = await fetch('/api/auth/passkey/generate-options?mode=authenticate')
      if (!optRes.ok) {
        throw new Error('Could not initialize passkey challenge.')
      }
      const { options, rpID, origin, challenge } = await optRes.json()

      // 2. Perform WebAuthn authentication ceremony with platform authenticator
      const authResp = await startAuthentication({ optionsJSON: options })

      // 3. Complete authentication via NextAuth passkey provider
      const signInResult = await signIn('passkey', {
        response: JSON.stringify(authResp),
        challenge,
        origin,
        rpID,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (signInResult?.error) {
        setPasskeyError('Passkey authentication failed. Please use your email and password.')
      } else if (signInResult?.url) {
        router.push(signInResult.url)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled the biometric prompt
        setPasskeyError(null)
      } else {
        setPasskeyError(
          err.message || 'Passkey verification failed. Please try again or use your password.',
        )
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault()
    setPasskeyError(null)
    setIsPasswordLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (res?.error) {
        router.push('/sign-in?error=credentials')
      } else if (res?.url) {
        router.push(res.url)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      router.push('/sign-in?error=credentials')
    } finally {
      setIsPasswordLoading(false)
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Primary Passkey Action */}
      {passkeySupported && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePasskeySignIn}
            disabled={isPasskeyLoading || isPasswordLoading}
            className="border-brand-blue/30 hover:border-brand-blue hover:bg-brand-blue/5 text-brand-navy min-h-12 w-full font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            {isPasskeyLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
                <span>Verifying Biometric / Security Key...</span>
              </>
            ) : (
              <>
                <Fingerprint className="h-5 w-5 text-brand-blue" />
                <span>Sign in with Passkey / Biometrics</span>
              </>
            )}
          </Button>

          {passkeyError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <span>{passkeyError}</span>
            </div>
          )}

          <div className="relative my-4 flex items-center justify-center">
            <div className="border-border w-full border-t" />
            <span className="bg-card px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Or continue with password
            </span>
            <div className="border-border w-full border-t" />
          </div>
        </div>
      )}

      {/* Password Fallback Form */}
      <form onSubmit={handlePasswordSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username webauthn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-input min-h-12 bg-white"
            placeholder="name@elward.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="border-input min-h-12 bg-white"
          />
        </div>

        {invalidCredentials && !passkeyError ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800"
          >
            Email or password is incorrect.
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={isPasswordLoading || isPasskeyLoading}
          className="font-heading min-h-12 w-full text-sm font-bold tracking-[0.08em] uppercase"
        >
          {isPasswordLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </div>
  )
}
