import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SignInForm } from './sign-in-form'
import { ElwardFlowBrand } from '@/components/brand/elward-flow-brand'

export const metadata: Metadata = { title: 'Sign in' }

export const dynamic = 'force-dynamic'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if ((await auth())?.user) redirect('/dashboard')
  const { error } = await searchParams
  return (
    <main className="flow-panel-grid bg-flow-chrome grid min-h-screen place-items-center p-4 sm:p-8">
      <section className="border-sidebar-border bg-card grid w-full max-w-5xl overflow-hidden rounded-lg border shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-brand-navy relative hidden min-h-[590px] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <div
            className="bg-brand-orange absolute inset-y-0 right-0 w-1"
            aria-hidden="true"
          />
          <ElwardFlowBrand priority />
          <div className="relative z-10 max-w-sm">
            <p className="font-heading text-brand-orange text-xs font-bold tracking-[0.2em] uppercase">
              Release to shipment
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white uppercase">
              One operational source of truth.
            </h1>
            <p className="mt-5 text-sm leading-6 text-slate-200">
              Production control for Ellwood Systems—from engineering intake and
              revision safety through QC, palletizing, and dispatch.
            </p>
          </div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Built for the work. Clear at every handoff.
          </p>
        </div>

        <div className="p-7 sm:p-10 lg:p-14">
          <ElwardFlowBrand className="mb-10 lg:hidden" priority />
          <p className="font-heading text-brand-blue text-xs font-bold tracking-[0.18em] uppercase">
            Secure operations access
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 uppercase">
            Sign in to Ellwood Flow
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Accounts are provisioned by an administrator. Public registration is
            disabled.
          </p>
          <SignInForm invalidCredentials={error === 'credentials'} />
        </div>
      </section>
    </main>
  )
}
