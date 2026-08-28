import Link from 'next/link'
import { ArrowRight, ClipboardList, PackageOpen, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FirstRunDashboard() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center p-4 sm:p-8">
      <section className="border-border bg-card w-full overflow-hidden rounded-lg border shadow-sm">
        <div className="border-brand-orange bg-brand-navy border-l-4 p-6 text-white sm:p-8">
          <div className="bg-brand-blue mb-5 flex size-12 items-center justify-center rounded-md">
            <PackageOpen className="size-6" aria-hidden="true" />
          </div>
          <p className="font-heading text-brand-orange text-xs font-bold tracking-[0.18em] uppercase">
            Production workspace ready
          </p>
          <h1 className="mt-2 text-3xl font-bold uppercase sm:text-4xl">
            No production releases yet
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
            Start with an approved release package. Ellwood Flow will preserve
            the original files, establish the current revision, and build the
            permitted path from panel marks through shipment.
          </p>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Establish the first controlled release
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: PackageOpen,
                  title: 'Upload package',
                  text: 'Add the release ZIP or PDF and its five-digit job number.',
                },
                {
                  icon: ClipboardList,
                  title: 'Review classification',
                  text: 'Confirm documents, release identity, and revision details.',
                },
                {
                  icon: ScanLine,
                  title: 'Publish safely',
                  text: 'Approve the current revision before shop-floor execution.',
                },
              ].map((step, index) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="flex gap-3">
                    <div className="bg-brand-blue-50 text-brand-blue flex size-9 shrink-0 items-center justify-center rounded-md">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-heading text-sm font-bold text-slate-900 uppercase">
                        {index + 1}. {step.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {step.text}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              size="lg"
              render={<Link href="/releases/intake" />}
              className="min-h-11"
            >
              Start release intake
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/releases" />}
              className="min-h-11"
            >
              View releases
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
