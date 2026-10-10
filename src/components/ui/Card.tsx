import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  icon,
  actions,
  subtitle,
  className,
}: {
  title: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  subtitle?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-plum-600/60 px-5 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-sea-400 shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold tracking-wide text-ivory truncate">{title}</h3>
          {subtitle && <p className="text-xs text-lavender/80 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}
