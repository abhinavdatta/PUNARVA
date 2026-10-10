import { Component, useMemo, type ReactNode } from 'react'
import { BatteryCharging } from 'lucide-react'

/** Detect WebGL once per session. Returns false only when a context truly cannot be created. */
export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

let cachedDetection: boolean | null = null
export function webGLSupported(): boolean {
  if (cachedDetection === null) cachedDetection = detectWebGL()
  return cachedDetection
}

/**
 * Clean conceptual fallback when WebGL is unavailable. Everything else in the
 * application keeps working — this only replaces the 3D visualization.
 */
export function WebGLFallback({ height = 420, label }: { height?: number; label?: string }) {
  return (
    <div
      className="tech-grid panel flex flex-col items-center justify-center gap-4 rounded-xl px-8 text-center"
      style={{ minHeight: height }}
      role="img"
      aria-label="Conceptual diagram of the PUNARVA tester connected to a battery"
    >
      <div className="flex items-end gap-6">
        {/* Battery */}
        <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden>
          <rect x="6" y="14" width="100" height="52" rx="6" className="fill-plum-800 stroke-copper-500" strokeWidth="2" />
          <rect x="107" y="30" width="7" height="20" rx="2" className="fill-copper-500" />
          <circle cx="30" cy="10" r="5" className="fill-critical-500" />
          <circle cx="76" cy="10" r="5" className="fill-plum-500" />
          <path d="M56 26 44 44h10l-4 12 14-18H54l4-12Z" className="fill-sea-400" />
        </svg>
        {/* Tester */}
        <svg width="86" height="110" viewBox="0 0 86 110" aria-hidden>
          <rect x="8" y="6" width="70" height="98" rx="8" className="fill-plum-800 stroke-sea-400" strokeWidth="2" />
          <rect x="16" y="18" width="54" height="34" rx="3" className="fill-plum-950 stroke-sea-400/60" strokeWidth="1.5" />
          <path d="M20 44 32 38 44 42 58 34 66 38" className="stroke-sea-400" strokeWidth="2" fill="none" />
          <circle cx="26" cy="66" r="5" className="fill-copper-500" />
          <circle cx="43" cy="66" r="5" className="fill-lavender/50" />
          <circle cx="60" cy="66" r="5" className="fill-sea-500" />
          <rect x="20" y="82" width="46" height="10" rx="2" className="fill-plum-700 stroke-plum-500" strokeWidth="1" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-ivory">Interactive 3D preview unavailable</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-lavender/80">
          WebGL is disabled or unsupported in this browser, so the conceptual 3D model cannot be rendered.
          {label ? ` ${label}` : ''} Every other function of this application remains fully available.
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-lavender/60">
        <BatteryCharging className="h-3.5 w-3.5" aria-hidden /> Conceptual prototype visualization
      </span>
    </div>
  )
}

interface BoundaryState {
  failed: boolean
}

/** Catches runtime errors from the 3D scene so the rest of the app is never affected. */
export class Scene3DErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn('[PUNARVA] 3D scene failed to render:', error)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Convenience wrapper: guard + boundary + canvas consumer. */
export function useSceneGuard(): { ok: boolean; fallback: (h?: number, label?: string) => ReactNode } {
  const ok = useMemo(() => webGLSupported(), [])
  return {
    ok,
    fallback: (h?: number, label?: string) => <WebGLFallback height={h} label={label} />,
  }
}
