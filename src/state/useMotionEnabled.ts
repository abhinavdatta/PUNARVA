import { useEffect, useState } from 'react'
import { useSettingsStore } from './settingsStore'

/**
 * True when animation/motion should run. Combines the user override with the
 * OS-level prefers-reduced-motion setting. The 3D scenes and heavy animations
 * consult this; CSS has its own media-query fallback.
 */
export function useMotionEnabled(): boolean {
  const override = useSettingsStore((s) => s.motionOverride)
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setSystemReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (override === 'reduced') return false
  if (override === 'full') return true
  return !systemReduced
}
