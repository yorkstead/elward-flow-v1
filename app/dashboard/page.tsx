import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const session = await auth()
  return (
    <main className="mx-auto w-full max-w-6xl p-5 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-sm font-semibold tracking-widest text-slate-500">
            ELWARD FLOW
          </p>
          <h1 className="text-3xl font-bold">Foundation status</h1>
        </div>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/sign-in' })
          }}
        >
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </header>
      <section className="grid gap-5 py-8 md:grid-cols-3">
        <article className="rounded-xl border p-6">
          <h2 className="font-semibold">Authenticated</h2>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as {session?.user.email}. Organization and site identity
            are server-backed.
          </p>
        </article>
        <article className="rounded-xl border p-6">
          <h2 className="font-semibold">Dependencies</h2>
          <p className="mt-2 text-sm text-slate-600">
            Readiness checks PostgreSQL and object storage.
          </p>
          <Link
            className="mt-4 inline-block underline"
            href="/api/health/ready"
          >
            Open readiness
          </Link>
        </article>
        <article className="rounded-xl border p-6">
          <h2 className="font-semibold">Immutable storage</h2>
          <p className="mt-2 text-sm text-slate-600">
            Exercise upload, retrieval, and SHA-256 verification through
            FileStore.
          </p>
          <Link
            className="mt-4 inline-block underline"
            href="/dashboard/storage-test"
          >
            Open storage test
          </Link>
        </article>
      </section>
    </main>
  )
}
