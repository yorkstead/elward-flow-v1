import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getPasskeyRelyingParty,
  storePasskeyChallenge,
} from '@/lib/auth/passkey-challenge'
import {
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
} from '@/lib/services/passkey'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'authenticate'
    const { rpID } = getPasskeyRelyingParty()

    if (mode === 'register') {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const options = await getPasskeyRegistrationOptions(
        {
          id: session.user.id,
          name: session.user.name || 'User',
          email: session.user.email || 'user@example.test',
        },
        rpID,
      )

      await storePasskeyChallenge(
        'register',
        options.challenge,
        session.user.id,
      )
      return NextResponse.json(
        { options },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Default: authenticate
    const options = await getPasskeyAuthenticationOptions(rpID)
    await storePasskeyChallenge('authenticate', options.challenge)
    return NextResponse.json(
      { options },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate passkey options',
      },
      { status: 500 },
    )
  }
}
