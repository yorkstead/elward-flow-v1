'use client'
import { useEffect, useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function OfflineStatus() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js')
  }, [])
  if (online) return null
  return (
    <div
      role="status"
      className="bg-amber-300 px-4 py-2 text-center font-semibold text-amber-950"
    >
      Offline — authenticated business data is not cached. Reconnect to
      continue.
    </div>
  )
}
