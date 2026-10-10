import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="tech-grid panel flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-plum-800 text-copper-400 ring-1 ring-plum-600/70">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="numeric font-display text-5xl font-bold text-ivory">404</p>
        <p className="mt-2 text-sm text-lavender">That route doesn't exist in the PUNARVA dashboard.</p>
      </div>
      <Link to="/">
        <Button variant="primary">Back to Overview</Button>
      </Link>
    </div>
  )
}
