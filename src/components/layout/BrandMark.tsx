import { cn } from '@/lib/utils'

/** PUNARVA brand mark — stylised battery cell with a charge bolt. */
export function BrandMark({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <rect x="3" y="3" width="38" height="38" rx="9" className="fill-plum-800" />
      <rect x="3" y="3" width="38" height="38" rx="9" stroke="url(#pv-g)" strokeWidth="1.6" />
      <rect x="10" y="14" width="20" height="16" rx="3" className="fill-plum-700" stroke="#FF936B" strokeWidth="1.6" />
      <rect x="31.5" y="18.5" width="3" height="7" rx="1.2" className="fill-copper-500" />
      <path d="M21 16.5 16.5 23h3.8l-1.6 4.5L24 21h-3.8l1.6-4.5Z" className="fill-sea-400" />
      <defs>
        <linearGradient id="pv-g" x1="3" y1="3" x2="41" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF936B" />
          <stop offset="1" stopColor="#63D8C2" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      {!compact && (
        <div className="leading-tight">
          <p className="font-display text-lg font-bold tracking-[0.18em] text-ivory">PUNARVA</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-copper-400/90">Every battery has more life</p>
        </div>
      )}
    </div>
  )
}
