import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-plum-600/50 px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] leading-relaxed text-lavender/50">
            PUNARVA — engineering prototype. Measurements shown in demo mode are simulated; the interface never
            claims capabilities the hardware has not verified.
          </p>
        </footer>
      </div>
    </div>
  )
}
