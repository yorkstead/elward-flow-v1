import { hasPermission, hasRole, UserContext } from '@/lib/auth/roles'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized: Access denied.') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(
    message = 'Forbidden: You do not have sufficient permissions for this operation.',
  ) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Asserts that the authenticated context has the required role.
 * Throws ForbiddenError if authorization fails.
 */
export function requireRole(
  context: UserContext,
  requiredRoles: string[],
  operationName?: string,
): void {
  if (!context || !context.userId) {
    throw new UnauthorizedError('Authentication required.')
  }

  if (!hasRole(context, requiredRoles)) {
    const roleList = requiredRoles.join(' or ')
    throw new ForbiddenError(
      `Permission Denied: Operation ${operationName ? `"${operationName}" ` : ''}requires role [${roleList}].`,
    )
  }
}

/**
 * Asserts that the authenticated context has the required permission action.
 * Throws ForbiddenError if authorization fails.
 */
export function requirePermission(
  context: UserContext,
  action: string,
  operationName?: string,
): void {
  if (!context || !context.userId) {
    throw new UnauthorizedError('Authentication required.')
  }

  if (!hasPermission(context, action)) {
    throw new ForbiddenError(
      `Permission Denied: Operation ${operationName ? `"${operationName}" ` : ''}requires "${action}" permission.`,
    )
  }
}
