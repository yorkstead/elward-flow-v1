import Image from 'next/image'
import { cn } from '@/lib/utils'

interface ElwardFlowBrandProps {
  className?: string
  compact?: boolean
  priority?: boolean
}

export function ElwardFlowBrand({
  className,
  compact = false,
  priority = false,
}: ElwardFlowBrandProps) {
  return (
    <div
      className={cn('flex min-w-0 items-center gap-2.5', className)}
      aria-label="Elward Flow"
    >
      <span className="flex shrink-0 items-center rounded-sm bg-white px-2 py-1 shadow-sm ring-1 ring-white/20">
        <Image
          src="/brand/elward-logo-primary.png"
          alt="Elward"
          width={1467}
          height={306}
          priority={priority}
          className={cn('h-auto w-[106px]', compact && 'w-[88px]')}
        />
      </span>
      <span className="h-7 w-px shrink-0 bg-white/25" aria-hidden="true" />
      <span className="min-w-0 leading-none">
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
