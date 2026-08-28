'use client'
export default function GlobalError({
  unstable_retry,
}: {
  error: Error
  unstable_retry: () => void
}) {
  return (
    <html>
      <body>
        <main>
          <h1>Ellwood Flow is unavailable</h1>
          <button onClick={() => unstable_retry()}>Try again</button>
        </main>
      </body>
    </html>
  )
}
