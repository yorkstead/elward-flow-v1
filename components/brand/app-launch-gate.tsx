'use client'

import * as React from 'react'
import { AppLaunchScreen } from './app-launch-screen'

export const APP_LAUNCH_MINIMUM_MS = 1100
const APP_LAUNCH_FADE_MS = 200

export function AppLaunchGate() {
  const [phase, setPhase] = React.useState<'visible' | 'exiting' | 'hidden'>(
    'visible',
  )

  React.useEffect(() => {
    const exitTimer = window.setTimeout(
      () => setPhase('exiting'),
      APP_LAUNCH_MINIMUM_MS - APP_LAUNCH_FADE_MS,
    )
    const hideTimer = window.setTimeout(
      () => setPhase('hidden'),
      APP_LAUNCH_MINIMUM_MS,
    )

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-[100] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        phase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <AppLaunchScreen />
    </div>
  )
}
