import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const baseField =
  'w-full rounded-lg border border-plum-500/70 bg-plum-800/70 px-3 text-sm text-ivory placeholder:text-lavender/40 ' +
  'hover:border-plum-400/70 focus:border-copper-500/70 focus:outline-none focus:ring-1 focus:ring-copper-500/50 ' +
  'transition-colors disabled:opacity-50'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  unit?: string
  optional?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, unit, optional, className, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 flex items-baseline gap-2 text-xs font-medium text-lavender">
          {label}
          {optional && <span className="text-[10px] uppercase tracking-wider text-lavender/50">optional</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          className={cn(baseField, 'h-10', unit && 'pr-12', className)}
          {...props}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-lavender/70">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-lavender/60">{hint}</p>}
    </div>
  )
})

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, className, children, id, ...props },
  ref,
) {
  const fieldId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium text-lavender">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          className={cn(baseField, 'h-10 appearance-none pr-9 [&>option]:bg-plum-800 [&>option]:text-ivory', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lavender/70"
          aria-hidden
        />
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-lavender/60">{hint}</p>}
    </div>
  )
})
