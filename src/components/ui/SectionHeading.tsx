import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        {eyebrow && <p className="label-caps mb-1">{eyebrow}</p>}
        <h2 className="font-display text-lg font-semibold tracking-tight text-ivory sm:text-xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-lavender">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
