type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const severity: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) return error
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  }
}

export function log(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
) {
  const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'
  if (severity[level] < severity[configured]) return
  const safeContext = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('secret')
        ? '[REDACTED]'
        : serializeError(value),
    ]),
  )
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeContext,
  })
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) =>
    log('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    log('error', message, context),
}
