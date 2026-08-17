import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SignInForm } from './sign-in-form'

export const metadata: Metadata = { title: 'Sign in' }
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if ((await auth())?.user) redirect('/dashboard')
  const { error } = await searchParams
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-widest text-slate-500">
          ELWARD SYSTEMS
        </p>
        <h1 className="mt-2 text-3xl font-bold">Sign in to Elward Flow</h1>
        <p className="mt-2 text-slate-600">
          Local accounts are created by an administrator. Public registration is
          disabled.
        </p>
        <SignInForm invalidCredentials={error === 'credentials'} />
      </section>
    </main>
  )
}
