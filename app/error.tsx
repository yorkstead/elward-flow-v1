'use client'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-lg text-center">
        <h1 className="text-3xl font-bold">
          Elward Flow could not complete that request
        </h1>
        <p className="mt-3 text-slate-600">
          No production data was changed. Retry, or give support the reference
          below.
        </p>
        {error.digest ? (
          <code className="mt-4 block">Reference: {error.digest}</code>
        ) : null}
        <Button className="mt-6" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </section>
    </main>
  )
}
