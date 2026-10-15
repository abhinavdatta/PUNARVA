import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, CircleSlash, Menu, X } from 'lucide-react'
import { useDeviceStore, selectCurrentSource } from '@/state/deviceStore'
import { fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusDot } from '@/components/ui/StatusDot'
import { BrandMark } from './BrandMark'
import { NavList } from './Sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/battery-check': 'Battery Check',
  '/history': 'Test History',
  '/technology': 'Technology',
  '/about': 'Project Information',
  '/settings': 'Settings',
}

const TOPBAR_HIDE_SOURCE_PATHS = ['/components', '/test', '/technology', '/about']

function topbarShowsSource(pathname: string): boolean {
  return !TOPBAR_HIDE_SOURCE_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/results')) return 'Test Report'
  return 'PUNARVA'
}


export function Topbar() {
  const { pathname } = useLocation()
  const source = useDeviceStore(selectCurrentSource)
  const lastValidAt = useDeviceStore((s) => s.lastValidAt)
  const lastReadingSource = useDeviceStore((s) => s.lastReadingSource)
  const events = useDeviceStore((s) => s.events)
  const eventUnseen = useDeviceStore((s) => s.eventUnseen)
  const markEventsSeen = useDeviceStore((s) => s.markEventsSeen)

  const [navOpen, setNavOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  // Close the drawer on navigation
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // Close notifications on outside click
  useEffect(() => {
    if (!bellOpen) return
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [bellOpen])

  const warnCount = events.filter((e) => e.level !== 'info').length

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-plum-600/60 bg-plum-900/80 backdrop-blur-md">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Mobile menu + brand */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lavender hover:bg-plum-700/60 hover:text-ivory lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="lg:hidden">
            <Link to="/" aria-label="PUNARVA home">
              <BrandMark size={30} />
            </Link>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold tracking-tight text-ivory sm:text-lg">
              {pageTitle(pathname)}
            </h1>
          </div>

          {/* Status cluster */}
          <div className="flex items-center gap-2 sm:gap-3">
            {topbarShowsSource(pathname) && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider',
                  source === 'HARDWARE'
                    ? 'border-sea-400/40 bg-sea-400/10 text-sea-300'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-400',
                )}
              title={source === 'HARDWARE' ? 'Receiving from connected hardware' : 'Demo mode'}
              >
                <CircleSlash className="h-3.5 w-3.5" aria-hidden />
                Demo data
              </span>
            )}

            {topbarShowsSource(pathname) && (
              <span className="hidden items-center gap-1.5 text-xs text-lavender xl:inline-flex" title="Last valid measurement received">
                <span className="text-lavender/60">Last valid:</span>
                <span className="numeric text-ivory">{lastValidAt ? fmtTime(lastValidAt) : '—'}</span>
                {lastValidAt && lastReadingSource && (
                  <span className={cn('text-[10px] font-semibold uppercase', lastReadingSource === 'DEMO' ? 'text-amber-400' : 'text-sea-300')}>
                    {lastReadingSource}
                  </span>
                )}
              </span>
            )}

            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-lavender hover:bg-plum-700/60 hover:text-ivory"
                onClick={() => {
                  setBellOpen((v) => !v)
                  if (!bellOpen) markEventsSeen()
                }}
                aria-label={`System notifications${eventUnseen > 0 ? ` (${eventUnseen} unseen)` : ''}`}
                aria-expanded={bellOpen}
              >
                <Bell className="h-5 w-5" aria-hidden />
                {warnCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical-500 px-1 text-[9px] font-bold text-plum-950">
                    {warnCount > 9 ? '9+' : warnCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="panel-elevated absolute right-0 top-12 z-40 w-80 overflow-hidden sm:w-96">
                  <p className="border-b border-plum-600/60 px-4 py-2.5 label-caps">System events</p>
                  <ul className="max-h-80 divide-y divide-plum-600/40 overflow-y-auto">
                    {events.length === 0 && (
                      <li className="px-4 py-6 text-center text-xs text-lavender/70">No events yet.</li>
                    )}
                    {[...events]
                      .reverse()
                      .slice(0, 14)
                      .map((e) => (
                        <li key={e.id} className="flex gap-2.5 px-4 py-2.5">
                          <StatusDot
                            tone={e.level === 'error' ? 'red' : e.level === 'warn' ? 'amber' : 'teal'}
                            className="mt-1.5"
                          />
                          <div className="min-w-0">
                            <p className="text-xs leading-snug text-ivory/90">{e.message}</p>
                            <p className="numeric mt-0.5 text-[10px] text-lavender/60">{fmtTime(e.at)}</p>
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-plum-950/70 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-plum-600/60 bg-plum-900 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-plum-600/50 px-4">
              <span className="font-display text-base font-bold tracking-[0.18em] text-ivory">PUNARVA</span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-lavender hover:bg-plum-700/60 hover:text-ivory"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
