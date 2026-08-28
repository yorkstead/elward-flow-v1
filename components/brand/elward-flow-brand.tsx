import { cn } from '@/lib/utils'

interface ElwardFlowBrandProps {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function EllwoodLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 90 90"
      className={cn('h-6 w-6 shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="efSymPanel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B334F" />
          <stop offset="100%" stopColor="#0F2033" />
        </linearGradient>
        <linearGradient id="efSymOrange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F26A36" />
          <stop offset="100%" stopColor="#D4501E" />
        </linearGradient>
      </defs>
      <g transform="translate(6, 4)">
        <path d="M 8 16 L 46 6 L 68 34 L 30 44 Z" fill="url(#efSymPanel)" opacity="0.95" />
        <path d="M 24 38 L 62 28 L 78 66 L 40 76 Z" fill="url(#efSymOrange)" />
        <path d="M 12 48 L 36 42 L 48 70 L 24 76 Z" fill="#0063A6" opacity="0.85" />
        <line x1="24" y1="38" x2="40" y2="76" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function ElwardFlowBrand({
  className,
  compact = false,
}: ElwardFlowBrandProps) {
  return (
    <div
      className={cn('flex min-w-0 items-center gap-2.5', className)}
      aria-label="Ellwood Flow"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-white px-2 py-1 shadow-xs ring-1 ring-white/20">
        <EllwoodLogoMark className={cn('h-5 w-5', compact && 'h-4 w-4')} />
        <span
          className={cn(
            'font-heading font-black tracking-wider text-[#1B334F] uppercase select-none',
            compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base',
          )}
        >
          ELLWOOD
        </span>
      </span>
      <span
        className={cn(
          'h-7 w-px shrink-0 bg-white/25',
          compact && 'max-[420px]:hidden',
        )}
        aria-hidden="true"
      />
      <span
        className={cn('min-w-0 leading-none', compact && 'max-[420px]:hidden')}
      >
        <span className="font-heading block text-lg font-bold tracking-[0.14em] text-white uppercase">
          Flow
        </span>
        {!compact ? (
          <span className="mt-1 block truncate text-[9px] font-bold tracking-[0.18em] text-slate-300 uppercase">
            Operations Control
          </span>
        ) : null}
      </span>
    </div>
  )
}

export const EllwoodFlowBrand = ElwardFlowBrand
