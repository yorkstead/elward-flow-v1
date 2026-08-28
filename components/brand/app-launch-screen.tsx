import Image from 'next/image'

export function AppLaunchScreen() {
  return (
    <div
      className="grid min-h-dvh w-full place-items-center bg-white/95 text-slate-900 backdrop-blur-[2px]"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="flex flex-col items-center gap-3"
        role="status"
        aria-label="Ellwood Flow is loading"
      >
        <div className="relative grid h-16 w-16 place-items-center">
          <span
            className="border-brand-orange/20 border-t-brand-orange absolute inset-0 animate-spin rounded-full border-2 motion-reduce:animate-pulse"
            aria-hidden="true"
          />
          <Image
            src="/brand/ellwood-symbol-orange.svg"
            alt=""
            width={100}
            height={100}
            priority
            className="h-10 w-10 object-contain"
          />
        </div>
        <span className="sr-only">Ellwood Flow is loading</span>
      </div>
    </div>
  )
}
