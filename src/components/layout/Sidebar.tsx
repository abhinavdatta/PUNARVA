import { NavLink } from 'react-router-dom'
import {
  Activity,
  Cpu,
  History,
  Info,
  LayoutDashboard,
  Microscope,
  Plug,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLockup } from './BrandMark'

export const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/battery-check', label: 'Battery Check', icon: Activity },
  { to: '/flash', label: 'Flash Firmware', icon: Zap },
  { to: '/test', label: 'Component Test', icon: Microscope },
  { to: '/history', label: 'Test History', icon: History },
  { to: '/technology', label: 'Technology', icon: Cpu },
  { to: '/about', label: 'Project Information', icon: Info },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/components', label: 'Components', icon: Plug },
] as const

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest ? rest.end : false}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper-400',
              isActive
                ? 'bg-copper-500/12 text-copper-400 shadow-[inset_2px_0_0_0_#FF936B]'
                : 'text-lavender hover:bg-plum-700/60 hover:text-ivory',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-copper-400' : 'text-lavender group-hover:text-ivory')}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-plum-600/60 bg-plum-950/60 backdrop-blur lg:flex">
      <div className="flex h-16 items-center border-b border-plum-600/50 px-5">
        <BrandLockup />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavList />
      </div>
      <div className="border-t border-plum-600/50 px-5 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lavender/60">Engineering prototype</p>
        <p className="mt-1 text-[11px] leading-snug text-lavender/50">
          Conceptual hardware visualization — not a manufacturing CAD model.
        </p>
      </div>
    </aside>
  )
}
