import { cn } from '@/lib/utils'

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg border border-plum-600/70 bg-plum-950/70 p-4 font-mono text-xs leading-relaxed text-sea-300',
        className,
      )}
    >
      <code>{code}</code>
    </pre>
  )
}
