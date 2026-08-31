import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { verifyPasskeyRegistration } from '@/lib/services/passkey'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { response, challenge, origin, rpID, friendlyName } = body

    if (!response || !challenge || !origin || !rpID) {
      return NextResponse.json({ error: 'Missing required WebAuthn payload' }, { status: 400 })
    }

    const passkey = await verifyPasskeyRegistration(
      session.user.id,
      response,
      challenge,
      origin,
      rpID,
      friendlyName,
    )

    return NextResponse.json({ success: true, passkey })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Passkey registration failed' },
      { status: 400 },
    )
  }
}
