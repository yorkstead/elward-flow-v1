import Link from 'next/link'
import { StorageTestForm } from './storage-test-form'

export default function StorageTestPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-5 md:p-10">
      <Link href="/dashboard" className="underline">
        ← Foundation status
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Immutable storage test</h1>
      <p className="mt-2 text-slate-600">
        Upload a fictional test PDF. Elward Flow calculates its SHA-256 hash,
        writes through the repository-owned FileStore, verifies MinIO metadata,
        and checks the hash again on retrieval.
      </p>
      <StorageTestForm />
    </main>
  )
}
