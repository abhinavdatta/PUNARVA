import { useMemo, useRef, useState } from 'react'
import { ArrowRight, MousePointerClick, RotateCcw } from 'lucide-react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { FLOW_STAGES, STATUS_LABEL, TECH_COMPONENTS } from '@/data/components'
import { useMotionEnabled } from '@/state/useMotionEnabled'
import { Badge, ComponentStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { TesterAssemblyVisual } from '@/components/three/TesterAssemblyScene'
import { cn } from '@/lib/utils'

export function TechnologyPage() {
  const motionEnabled = useMotionEnabled()
  const controlsRef = useRef<OrbitControlsImpl>(null)

  /** Selection shared by the signal-flow diagram, the component grid, and the 3D assembly. */
  const [selected, setSelected] = useState<string | null>(null)

  const selectedComponent = TECH_COMPONENTS.find((c) => c.id === selected) ?? null
  const selectedStage = selectedComponent ? FLOW_STAGES[selectedComponent.flowStage] : null

  const componentsByStage = useMemo(() => {
    return FLOW_STAGES.map((stage, i) => ({
      stage,
      items: TECH_COMPONENTS.filter((c) => c.flowStage === i),
    }))
  }, [])

  function onSelect(id: string | null) {
    setSelected(id === '' ? null : id)
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Hardware architecture"
        title="Technology & components"
        description="How a measurement travels from the battery terminals to this dashboard. Every component shows its honest development status — nothing is marked connected until connectivity is actually verified."
      />

      {/* ------------------------- Signal flow ------------------------- */}
      <Card>
        <CardHeader
          title="Signal flow"
          icon={<MousePointerClick aria-hidden />}
          subtitle="Click a stage to highlight the components behind it"
        />
        <CardBody className="pt-4">
          <ol className="flex flex-wrap items-stretch gap-2">
            {FLOW_STAGES.map((stage, i) => {
              const active = selectedStage?.id === stage.id
              return (
                <li key={stage.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(active ? null : stage.id)}
                    className={cn(
                      'group flex min-w-[120px] flex-1 flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-all',
                      active
                        ? 'border-copper-500/70 bg-copper-500/10 shadow-glowCopper'
                        : 'border-plum-500/60 bg-plum-800/50 hover:border-plum-400/70 hover:bg-plum-800',
                    )}
                    aria-pressed={active}
                  >
                    <span className={cn('text-[10px] font-bold tracking-widest', active ? 'text-copper-400' : 'text-lavender/50')}>
                      STAGE {i + 1}
                    </span>
                    <span className={cn('text-sm font-semibold', active ? 'text-copper-300' : 'text-ivory')}>
                      {stage.label}
                    </span>
                  </button>
                  {i < FLOW_STAGES.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-lavender/40" aria-hidden />
                  )}
                </li>
              )
            })}
          </ol>
          {(selectedStage || selectedComponent) && (
            <div className="mt-4 rounded-lg border border-plum-500/60 bg-plum-800/50 px-4 py-3">
              {selectedComponent ? (
                <>
                  <p className="text-sm font-semibold text-ivory">{selectedComponent.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-lavender">{selectedComponent.signalRole}</p>
                </>
              ) : (
                <p className="text-xs leading-relaxed text-lavender">{selectedStage?.description}</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* --------------------- Interactive assembly --------------------- */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <div className="relative h-[360px] sm:h-[430px]">
            <TesterAssemblyVisual selectedId={selected} onSelect={onSelect} motionEnabled={motionEnabled} controlsRef={controlsRef} />
            <button
              type="button"
              onClick={() => controlsRef.current?.reset()}
              className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-plum-500/60 bg-plum-900/80 px-2.5 py-1.5 text-[11px] font-medium text-lavender backdrop-blur transition-colors hover:text-ivory"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset view
            </button>
            <span className="absolute left-3 top-3 z-10 rounded-lg border border-plum-500/60 bg-plum-900/80 px-2.5 py-1.5 text-[11px] font-medium text-lavender backdrop-blur">
              Conceptual geometry — not dimensionally accurate
            </span>
          </div>
          <p className="border-t border-plum-600/50 px-4 py-2.5 text-[11px] text-lavender/60">
            Click a part to inspect it. Ghosted (translucent) parts are planned — they have no confirmed hardware yet.
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Component details" icon={<MousePointerClick aria-hidden />} />
          <CardBody className="pt-4">
            {selectedComponent ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-bold text-ivory">{selectedComponent.name}</h3>
                  <ComponentStatusBadge status={selectedComponent.status} />
                </div>
                <div>
                  <p className="label-caps mb-1">Purpose</p>
                  <p className="text-sm leading-relaxed text-lavender">{selectedComponent.purpose}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Signal role</p>
                  <p className="text-sm leading-relaxed text-lavender">{selectedComponent.signalRole}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Development status</p>
                  <p className="text-sm leading-relaxed text-lavender">{selectedComponent.statusNote}</p>
                </div>
                <div>
                  <p className="label-caps mb-1">Flow stage</p>
                  <p className="text-sm text-lavender">
                    {FLOW_STAGES[selectedComponent.flowStage].label} — {FLOW_STAGES[selectedComponent.flowStage].description}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>Clear selection</Button>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-lavender/70">
                Select a component — in the 3D assembly, the signal-flow diagram, or the list below — to see its
                purpose, signal role, and honest development status.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ------------------------ Component list ------------------------ */}
      <div className="grid gap-4 md:grid-cols-2">
        {componentsByStage.map(({ stage, items }) =>
          items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(selected === c.id ? null : c.id)}
              className={cn(
                'panel p-4 text-left transition-all hover:border-plum-400/70',
                selected === c.id && 'border-copper-500/70 shadow-glowCopper',
              )}
              aria-pressed={selected === c.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ivory">{c.name}</p>
                <ComponentStatusBadge status={c.status} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-lavender/80">{c.purpose}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-lavender/50">
                {STATUS_LABEL[c.status]} · stage {c.flowStage + 1} · {stage.short}
              </p>
            </button>
          )),
        )}
      </div>

      {/* ------------------------ Status legend ------------------------ */}
      <Card>
        <CardHeader title="Status legend" subtitle="Labels are only used when they are true" />
        <CardBody className="flex flex-wrap gap-2 pt-4">
          <Badge tone="neutral">Planned — designed, not built</Badge>
          <Badge tone="amber">Under development — being built, not validated</Badge>
          <Badge tone="teal">Implemented — confirmed to exist and run</Badge>
          <Badge tone="copper">Connected — verified live connectivity</Badge>
        </CardBody>
      </Card>
    </div>
  )
}
