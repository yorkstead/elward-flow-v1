import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, like, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { verificationTokens } from '@/db/schema'
import type { NextRequest } from 'next/server'
import { getEnvironment } from '@/lib/env'

type Ceremony = 'authenticate' | 'register'
const lifetimeSeconds = 300

export function getPasskeyRelyingParty(req?: Request | NextRequest | Headers | { get(name: string): string | null }) {
  if (req) {
    let candidateHost: string | null = null
    let candidateOrigin: string | null = null

    // 1. Check if client passed rpID / origin in query params (via Request or NextRequest)
    if ('url' in req && req.url) {
      try {
        const url = new URL(req.url)
        const qRpId = url.searchParams.get('rpID')
        const qOrigin = url.searchParams.get('origin')
        if (qRpId && qOrigin) {
          const parsed = new URL(qOrigin)
          if (
            parsed.hostname === qRpId &&
            (parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(qRpId))
          ) {
            candidateHost = qRpId
            candidateOrigin = parsed.origin
          }
        }
      } catch {}
    }

    // 2. Check headers
    const headers = 'headers' in req && req.headers ? req.headers : (req as { get(name: string): string | null })
    
    // Check referer if candidate not set
    if (!candidateHost) {
      const referer = headers.get?.('referer')
      if (referer) {
        try {
          const parsed = new URL(referer)
          if (parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname)) {
            candidateHost = parsed.hostname
            candidateOrigin = parsed.origin
          }
        } catch {}
      }
    }

    // Check forwarded host or host
    if (!candidateHost) {
      const hostHeader = headers.get?.('x-forwarded-host') || headers.get?.('host')
      if (hostHeader) {
        const hostname = hostHeader.split(':')[0]
        const proto =
          headers.get?.('x-forwarded-proto') ||
          (['localhost', '127.0.0.1'].includes(hostname) ? 'http' : 'https')
        candidateHost = hostname
        candidateOrigin = `${proto}://${hostHeader}`
      }
    }

    if (candidateHost && candidateOrigin) {
      return { rpID: candidateHost, origin: candidateOrigin }
    }
  }

  const url = new URL(getEnvironment().APP_URL)
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(url.hostname)
  ) {
    throw new Error('Passkeys require an HTTPS APP_URL.')
  }
  return { rpID: url.hostname, origin: url.origin }
}

function identifier(mode: Ceremony, binding: string, userId?: string) {
  return `passkey:${mode}:${userId ?? 'anonymous'}:${createHash('sha256').update(binding).digest('hex')}`
}

export async function storePasskeyChallenge(
  mode: Ceremony,
  challenge: string,
  userId?: string,
) {
  const jar = await cookies()
  const cookieName = `elward-passkey-${mode}`
  const previous = jar.get(cookieName)?.value
  if (previous) {
    await db
      .delete(verificationTokens)
      .where(
        eq(verificationTokens.identifier, identifier(mode, previous, userId)),
      )
  }
  await db
    .delete(verificationTokens)
    .where(
      and(
        like(verificationTokens.identifier, 'passkey:%'),
        lt(verificationTokens.expires, new Date()),
      ),
    )
  const binding = randomBytes(32).toString('base64url')
  await db.insert(verificationTokens).values({
    identifier: identifier(mode, binding, userId),
    token: challenge,
    expires: new Date(Date.now() + lifetimeSeconds * 1000),
  })
  jar.set(cookieName, binding, {
    httpOnly: true,
    secure: getPasskeyRelyingParty().origin.startsWith('https:'),
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: lifetimeSeconds,
  })
}

export async function consumePasskeyChallenge(mode: Ceremony, userId?: string) {
  const binding = (await cookies()).get(`elward-passkey-${mode}`)?.value
  if (!binding) throw new Error('Passkey challenge missing. Start again.')
  // DELETE RETURNING makes consumption single-use even across concurrent workers.
  const [challenge] = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier(mode, binding, userId)),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning()
  if (!challenge)
    throw new Error('Passkey challenge expired or already used. Start again.')
  return challenge.token
}

export function requirePasskeyOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) {
    throw new Error('Invalid request origin.')
  }
  const rp = getPasskeyRelyingParty(request)
  if (origin !== rp.origin && origin !== getPasskeyRelyingParty().origin) {
    throw new Error('Invalid request origin.')
  }
}
