import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, userRoles, roles } from '@/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { credentialsSchema } from '@/lib/auth/validation'
import { getEnvironment } from '@/lib/env'
import {
  consumePasskeyChallenge,
  getPasskeyRelyingParty,
} from '@/lib/auth/passkey-challenge'
import { verifyPasskeyAuthentication } from '@/lib/services/passkey'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getEnvironment().AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/sign-in' },
  providers: [
    Credentials({
      id: 'passkey',
      name: 'Passkey',
      credentials: {
        response: { type: 'text' },
      },
      async authorize(credentials) {
        if (typeof credentials?.response !== 'string') return null
        try {
          const response = JSON.parse(credentials.response as string)
          const challenge = await consumePasskeyChallenge('authenticate')
          const { origin, rpID } = getPasskeyRelyingParty()
          const user = await verifyPasskeyAuthentication(
            response,
            challenge,
            origin,
            rpID,
          )
          return user
        } catch (err) {
          console.warn('Passkey authorization failed:', err)
          return null
        }
      },
    }),
    Credentials({
      id: 'credentials',
      name: 'Credentials',
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input)
        if (!parsed.success) return null

        const email = parsed.data.email.toLowerCase().trim()
        const password = parsed.data.password

        // Try Database query first
        try {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)

          if (user && !user.disabledAt) {
            const passwordValid = await verifyPassword(
              password,
              user.passwordHash,
            )
            if (passwordValid) {
              const userRoleRows = await db
                .select({ roleName: roles.name })
                .from(userRoles)
                .innerJoin(roles, eq(userRoles.roleId, roles.id))
                .where(eq(userRoles.userId, user.id))

              const userRoleNames = userRoleRows.map((r) => r.roleName)
              if (
                user.isAdmin &&
                !userRoleNames.includes('System Administrator')
              ) {
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
          }
        } catch (dbErr) {
          console.warn('Database query during auth:', dbErr)
        }

        return null
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.userId ?? token.sub
      if (typeof userId !== 'string') return null
      try {
        const [current] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
        if (!current || current.disabledAt) return null
        const assignedRoles = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, current.id))
        token.userId = current.id
        token.organizationId = current.organizationId
        token.siteId = current.siteId
        token.isAdmin = current.isAdmin
        token.roles = assignedRoles.map((role) => role.roleName)
        if (current.isAdmin && !token.roles.includes('System Administrator'))
          token.roles.push('System Administrator')
        token.name = current.name
        token.email = current.email
        return token
      } catch {
        // Never preserve stale authority when the account cannot be verified.
        return null
      }
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub)
        session.user.organizationId = token.organizationId
          ? String(token.organizationId)
          : ''
        session.user.siteId = token.siteId ? String(token.siteId) : null
        session.user.isAdmin = Boolean(token.isAdmin)
        session.user.roles = Array.isArray(token.roles) ? token.roles : []
      }
      return session
    },
  },
})
