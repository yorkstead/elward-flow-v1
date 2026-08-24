import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, userRoles, roles } from '@/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { credentialsSchema } from '@/lib/auth/validation'
import { getEnvironment } from '@/lib/env'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getEnvironment().AUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/sign-in' },
  providers: [
    Credentials({
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(input) {
        const parsed = credentialsSchema.safeParse(input)
        if (!parsed.success) return null
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1)
        if (
          !user ||
          user.disabledAt ||
          !(await verifyPassword(parsed.data.password, user.passwordHash))
        )
          return null

        const userRoleRows = await db
          .select({ roleName: roles.name })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(eq(userRoles.userId, user.id))

        const userRoleNames = userRoleRows.map((r) => r.roleName)

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: user.organizationId,
          siteId: user.siteId,
          isAdmin: user.isAdmin,
          roles: userRoleNames,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.organizationId = user.organizationId
        token.siteId = user.siteId
        token.isAdmin = user.isAdmin
        token.roles = user.roles ?? []
      }
      return token
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
