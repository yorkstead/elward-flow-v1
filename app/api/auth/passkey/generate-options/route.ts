import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
  resolveRpIdAndOrigin,
} from '@/lib/services/passkey'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const mode = searchParams.get('mode') || 'authenticate'
    const hostHeader = req.headers.get('host')
    const originHeader = req.headers.get('origin') || req.headers.get('referer')
    const { rpID, origin } = resolveRpIdAndOrigin(hostHeader, originHeader)

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

      return NextResponse.json({ options, rpID, origin, challenge: options.challenge })
    }

    // Default: authenticate
    const options = await getPasskeyAuthenticationOptions(rpID)
    return NextResponse.json({ options, rpID, origin, challenge: options.challenge })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to generate passkey options' },
      { status: 500 },
    )
  }
}
