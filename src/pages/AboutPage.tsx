import { Link } from 'react-router-dom'
import {
  BatteryWarning,
  CircleCheck,
  ClipboardList,
  Cpu,
  FlaskConical,
  Goal,
  LineChart,
  PlugZap,
  Radar,
  Rocket,
  Search,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'

const WORKFLOW = [
  { id: 'connect', label: 'Connect', icon: PlugZap, note: 'Attach the test probes and establish the setup. (Hardware stage planned.)' },
  { id: 'measure', label: 'Measure', icon: Radar, note: 'Capture voltage, current, and temperature through the sensing chain.' },
  { id: 'test', label: 'Test', icon: Wrench, note: 'A controlled load will run only when validated firmware and protection exist.' },
  { id: 'analyze', label: 'Analyze', icon: Search, note: 'Review the measured electrical response and data completeness.' },
  { id: 'report', label: 'Report', icon: ClipboardList, note: 'Save the record locally and export the actual samples as CSV.' },
] as const

const CURRENT_FOCUS = [
  'ESP32-based data acquisition (controller and ADC bring-up)',
  'Sensor interface design and selection',
  'Measurement validation rules in the dashboard',
  'Test workflow and state-machine development',
  'This dashboard: charts, reports, history, CSV export',
]

const FUTURE = [
  { label: 'Validated battery-health estimation', status: 'planned' },
  { label: 'Reliable hardware data acquisition', status: 'planned' },
  { label: 'Calibration and repeatable testing', status: 'planned' },
  { label: 'Better on-device data logging (MicroSD)', status: 'planned' },
  { label: 'AI/ML analysis after suitable data collection', status: 'planned' },
  { label: 'Second-life evaluation support', status: 'planned' },
]

export function AboutPage() {
  return (
    <div className="space-y-8">
      {/* Mission */}
      <section className="hero-radial panel tech-grid p-6 sm:p-10">
        <Badge tone="copper">About the project</Badge>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ivory sm:text-4xl">
          PUNARVA — <span className="text-copper-400">Every Battery Has More Life.</span>
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-lavender sm:text-base">
          PUNARVA is an emerging battery diagnostics project. It aims to assess battery condition through measured
          electrical response, record test results, and support better battery lifecycle decisions — including, one
          day, second-life evaluation. It is an engineering prototype: it does not claim certified battery safety,
          guaranteed remaining life, or validated health predictions.
        </p>
      </section>

      {/* Problem / solution */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="The problem" icon={<BatteryWarning aria-hidden />} />
          <CardBody className="pt-4 text-sm leading-relaxed text-lavender">
            <p>
              Battery condition is genuinely uncertain. A voltage reading alone cannot establish battery health: a
              tired cell can rest at a plausible voltage yet collapse under load, while a healthy cell can read low
              when discharged. Without measurement under controlled conditions, decisions about reuse, replacement,
              or second-life deployment are guesses.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="The proposed solution" icon={<Goal aria-hidden />} />
          <CardBody className="pt-4 text-sm leading-relaxed text-lavender">
            <p>
              Collect electrical measurements (voltage, current, temperature), investigate the response under an
              appropriately controlled test, record the data, and provide transparent reports with explicit
              completeness and data-quality information. Every number in a PUNARVA report traces back to an actual
              sample — or is clearly labelled as simulated.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* How it works */}
      <section>
        <SectionHeading eyebrow="How PUNARVA works" title="Five stages" description="The intended end-to-end workflow. Stages that need hardware are marked planned." />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WORKFLOW.map((step, i) => (
            <li key={step.id} className="panel p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-plum-800 text-sea-400 ring-1 ring-plum-600/70">
                  <step.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="numeric text-[10px] font-bold tracking-widest text-lavender/40">0{i + 1}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ivory">{step.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-lavender/80">{step.note}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Hardware summary */}
      <Card>
        <CardHeader
          title="Hardware architecture"
          icon={<Cpu aria-hidden />}
          subtitle="Battery → probes → sensing → ESP32 + ADS1115 → processing → dashboard"
          actions={
            <Link to="/technology">
              <Button variant="teal" size="sm">
                <FlaskConical className="h-4 w-4" aria-hidden /> Explore components
              </Button>
            </Link>
          }
        />
        <CardBody className="pt-4">
          <p className="text-sm leading-relaxed text-lavender">
            The prototype centres on an <strong className="text-ivory">ESP32 DevKit V1</strong> reading an{' '}
            <strong className="text-ivory">ADS1115</strong> external ADC, with voltage, current, and temperature
            sensing, an I2C OLED for standalone readout, and a MicroSD module planned for on-device logging. A
            controlled-load stage is proposed so response under load can be studied — it requires validated firmware
            and electrical protection before any activation, so the software cannot and does not actuate it.
          </p>
        </CardBody>
      </Card>

      {/* Current + future */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Current development" icon={<LineChart aria-hidden />} subtitle="Only verified capabilities are listed" />
          <CardBody className="pt-4">
            <ul className="space-y-2.5">
              {CURRENT_FOCUS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-lavender">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-sea-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg border border-plum-500/50 bg-plum-800/50 px-3.5 py-3 text-xs leading-relaxed text-lavender/80">
              Honest boundaries: hardware measurements are not yet streaming, so the dashboard runs on clearly
              labelled demo data until the ESP32 link is validated.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Future development" icon={<Rocket aria-hidden />} subtitle="Planned — not yet operational" />
          <CardBody className="pt-4">
            <ul className="space-y-2.5">
              {FUTURE.map((f) => (
                <li key={f.label} className="flex items-center justify-between gap-3 text-sm text-lavender">
                  {f.label}
                  <Badge tone="neutral">Planned</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-lavender/70">
              None of these are claimed as working features. AI/ML analysis, in particular, becomes meaningful only
              after reliable, calibrated data collection exists.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
