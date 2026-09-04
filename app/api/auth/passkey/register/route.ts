import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  consumePasskeyChallenge,
  getPasskeyRelyingParty,
  requirePasskeyOrigin,
} from '@/lib/auth/passkey-challenge'
import { z } from 'zod'
import { verifyPasskeyRegistration } from '@/lib/services/passkey'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    requirePasskeyOrigin(req)
    const body = await req.json()
    const { response } = body
    const friendlyName = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional()
      .parse(body.friendlyName)

    if (!response) {
      return NextResponse.json(
        { error: 'Missing required WebAuthn payload' },
        { status: 400 },
      )
    }

    const challenge = await consumePasskeyChallenge('register', session.user.id)
    const { origin, rpID } = getPasskeyRelyingParty()
    const passkey = await verifyPasskeyRegistration(
      session.user.id,
      response,
      challenge,
      origin,
      rpID,
      friendlyName,
    )

    return NextResponse.json({ success: true, passkey })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Passkey registration failed',
      },
      { status: 400 },
    )
  }
}
