'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-dvh place-items-center p-6 text-center">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900">
              Ellwood Flow is unavailable
            </h1>
            <p className="text-sm text-slate-600">
              A critical application error occurred.
            </p>
            <button
              onClick={() => reset()}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
