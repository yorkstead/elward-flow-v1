import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { passkeys, users, roles, userRoles } from '@/db/schema'
import { auditEvents } from '@/db/schema'

export function resolveRpIdAndOrigin(hostHeader?: string | null, originHeader?: string | null) {
  let hostname = 'localhost'
  let origin = 'http://localhost:3000'

  if (originHeader) {
    try {
      const url = new URL(originHeader)
      hostname = url.hostname
      origin = url.origin
    } catch {
      // fallback
    }
  } else if (hostHeader) {
    const hostWithoutPort = hostHeader.split(':')[0]
    hostname = hostWithoutPort
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    origin = `${isLocal ? 'http' : 'https'}://${hostHeader}`
  }

  const rpID = hostname
  return { rpID, origin }
}

/**
 * Generate options for Passkey Authentication (Sign In)
 */
export async function getPasskeyAuthenticationOptions(rpID: string) {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials: [],
  })
  return options
}

/**
 * Verify Passkey Authentication response and return the authenticated user
 */
export async function verifyPasskeyAuthentication(
  response: any,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRPID: string,
) {
  const credentialId = response.id

  // Find passkey in database
  const [passkey] = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, credentialId))
    .limit(1)

  if (!passkey) {
    throw new Error('Passkey credential not recognized on this system.')
  }

  // Load user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, passkey.userId))
    .limit(1)

  if (!user || user.disabledAt) {
    throw new Error('Associated user account is disabled or not found.')
  }

  const publicKeyUint8 = Buffer.from(passkey.publicKey, 'base64url')

  const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: passkey.credentialId,
      publicKey: publicKeyUint8,
      counter: Number(passkey.counter),
      transports: (passkey.transports as any) || undefined,
    },
    requireUserVerification: false,
  })

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error('Cryptographic signature verification failed.')
  }

  const { newCounter } = verification.authenticationInfo

  // Update passkey counter and last used timestamp
  await db
    .update(passkeys)
    .set({
      counter: newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(passkeys.id, passkey.id))

  // Audit event
  await db.insert(auditEvents).values({
    organizationId: user.organizationId,
    actorId: user.id,
    actingRole: user.isAdmin ? 'System Administrator' : 'Operator',
    action: 'PASSKEY_AUTHENTICATED',
    resourceType: 'user',
    resourceId: user.id,
    reason: `Passkey sign-in successful (${passkey.friendlyName || 'Unnamed Key'})`,
  })

  // Resolve user roles
  const userRoleRows = await db
    .select({ roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id))

  const userRoleNames = userRoleRows.map((r) => r.roleName)
  if (user.isAdmin && !userRoleNames.includes('System Administrator')) {
    userRoleNames.push('System Administrator', 'Executive')
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: user.organizationId,
    siteId: user.siteId,
    isAdmin: user.isAdmin,
    roles: userRoleNames,
  }
}

/**
 * Generate options for Passkey Registration (Adding new biometric credential)
 */
export async function getPasskeyRegistrationOptions(
  user: { id: string; name: string; email: string },
  rpID: string,
) {
  // Existing user credentials to exclude
  const existingKeys = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.userId, user.id))

  const options = await generateRegistrationOptions({
    rpName: 'Ellwood Flow',
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingKeys.map((k) => ({
      id: k.credentialId,
      transports: (k.transports as any) || undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  })

  return options
}

/**
 * Verify and save new Passkey Registration
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: any,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRPID: string,
  friendlyName?: string,
) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error('User not found.')

  const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: false,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration verification failed.')
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  const publicKeyBase64Url = Buffer.from(credential.publicKey).toString('base64url')

  const [savedKey] = await db
    .insert(passkeys)
    .values({
      userId: user.id,
      credentialId: credential.id,
      publicKey: publicKeyBase64Url,
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: (credential.transports as string[]) || [],
      friendlyName: friendlyName || 'Biometric Security Key',
      lastUsedAt: new Date(),
    })
    .returning()

  // Audit event
  await db.insert(auditEvents).values({
    organizationId: user.organizationId,
    actorId: user.id,
    actingRole: user.isAdmin ? 'System Administrator' : 'Operator',
    action: 'PASSKEY_REGISTERED',
    resourceType: 'passkey',
    resourceId: savedKey.id,
    reason: `Passkey registered: ${savedKey.friendlyName}`,
  })

  return savedKey
}
