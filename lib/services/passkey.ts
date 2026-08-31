import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import { passkeys, users, roles, userRoles } from '@/db/schema'
import { auditEvents } from '@/db/schema'

/**
 * Generate options for Passkey Authentication (Sign In)
 */
export async function getPasskeyAuthenticationOptions(rpID: string) {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: [],
  })
  return options
}

/**
 * Verify Passkey Authentication response and return the authenticated user
 */
export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
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

  const verification: VerifiedAuthenticationResponse =
    await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential: {
        id: passkey.credentialId,
        publicKey: publicKeyUint8,
        counter: Number(passkey.counter),
        transports:
          (passkey.transports as AuthenticatorTransportFuture[]) || undefined,
      },
      requireUserVerification: true,
    })

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error('Cryptographic signature verification failed.')
  }

  const { newCounter } = verification.authenticationInfo

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(passkeys)
      .set({ counter: newCounter, lastUsedAt: new Date() })
      .where(
        and(eq(passkeys.id, passkey.id), eq(passkeys.counter, passkey.counter)),
      )
      .returning()
    if (!updated)
      throw new Error('Passkey changed during sign-in. Please retry.')
    await tx.insert(auditEvents).values({
      organizationId: user.organizationId,
      actorId: user.id,
      actingRole: user.isAdmin ? 'System Administrator' : 'Operator',
      action: 'PASSKEY_AUTHENTICATED',
      resourceType: 'user',
      resourceId: user.id,
      reason: 'Passkey sign-in successful',
    })
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
    rpName: 'Elward Flow',
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingKeys.map((k) => ({
      id: k.credentialId,
      transports: (k.transports as AuthenticatorTransportFuture[]) || undefined,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  })

  return options
}

/**
 * Verify and save new Passkey Registration
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRPID: string,
  friendlyName?: string,
) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user || user.disabledAt) throw new Error('User not found or disabled.')

  const verification: VerifiedRegistrationResponse =
    await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: true,
    })

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration verification failed.')
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo
  const publicKeyBase64Url = Buffer.from(credential.publicKey).toString(
    'base64url',
  )

  return db.transaction(async (tx) => {
    const [savedKey] = await tx
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
    await tx.insert(auditEvents).values({
      organizationId: user.organizationId,
      actorId: user.id,
      actingRole: user.isAdmin ? 'System Administrator' : 'Operator',
      action: 'PASSKEY_REGISTERED',
      resourceType: 'passkey',
      resourceId: savedKey.id,
      reason: `Passkey registered: ${savedKey.friendlyName}`,
    })

    return { id: savedKey.id, friendlyName: savedKey.friendlyName }
  })
}
