import { ElwardFlowBrand } from './elward-flow-brand'

export function AppLaunchScreen() {
  return (
    <div
      className="flow-panel-grid bg-flow-chrome relative grid min-h-dvh w-full place-items-center overflow-hidden px-6 py-10 text-white"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="bg-brand-orange/10 absolute inset-x-0 top-0 h-1/2 blur-3xl"
        aria-hidden="true"
      />
      <section className="relative flex w-full max-w-sm flex-col items-center text-center">
        <div className="border-sidebar-border bg-brand-navy/80 rounded-lg border p-5 shadow-2xl backdrop-blur-sm">
          <ElwardFlowBrand priority />
        </div>

        <p className="font-heading text-brand-orange mt-8 text-xs font-bold tracking-[0.22em] uppercase">
          Operations control
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight uppercase sm:text-3xl">
          Preparing your workspace
        </h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
          Connecting release, production, quality, pallet, and shipment status.
        </p>

        <div
          className="mt-8 flex items-center gap-2"
          role="status"
          aria-label="Elward Flow is loading"
        >
          <span className="bg-brand-orange h-2 w-2 animate-pulse rounded-full" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:160ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500 [animation-delay:320ms]" />
          <span className="sr-only">Elward Flow is loading</span>
        </div>

        <p className="mt-10 text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
          Release to shipment • America/Denver
        </p>
      </section>
    </div>
  )
}
