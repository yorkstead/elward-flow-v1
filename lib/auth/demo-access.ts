export function isDemoAccessEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.ALLOW_DEMO_SEED === 'true'
  )
}
