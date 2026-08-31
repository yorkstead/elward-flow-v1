'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type UploadResult = {
  id: string
  name: string
  sha256: string
  downloadUrl: string
}
export function StorageTestForm() {
  const [result, setResult] = useState<UploadResult>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  return (
    <form
      className="mt-8 space-y-5 rounded-xl border p-6"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError('')
        setResult(undefined)
        try {
          const response = await fetch('/api/files', {
            method: 'POST',
            body: new FormData(event.currentTarget),
          })
          if (
            !response.headers.get('content-type')?.includes('application/json')
          ) {
            throw new Error('Storage is unavailable. Please try again.')
          }
          const body = await response.json()
          if (!response.ok) throw new Error(body.error ?? 'Upload failed')
          setResult(body)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'Upload failed')
        } finally {
          setPending(false)
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="file">Fictional PDF</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
        />
      </div>
      <Button type="submit" className="min-h-12" disabled={pending}>
        {pending ? 'Verifying upload…' : 'Upload and verify'}
      </Button>
      {error ? (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      ) : null}
      {result ? (
        <section
          role="status"
          className="rounded-lg bg-emerald-50 p-4 break-words text-emerald-950"
        >
          <p className="font-semibold">Upload verified</p>
          <p className="mt-2 text-sm">
            SHA-256: <code>{result.sha256}</code>
          </p>
          <a className="mt-3 inline-block underline" href={result.downloadUrl}>
            Download and verify again
          </a>
        </section>
      ) : null}
    </form>
  )
}
