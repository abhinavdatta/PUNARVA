import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-plum-500/60 bg-plum-800/30 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-plum-700/80 text-lavender [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <p className="text-sm font-medium text-ivory">{title}</p>
      {description && <p className="max-w-sm text-xs leading-relaxed text-lavender/80">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
