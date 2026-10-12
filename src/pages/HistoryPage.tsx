import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileWarning,
  History,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import type { DataSource, TestRecord } from '@/types'
import { useHistoryStore } from '@/state/historyStore'
import { useDeviceStore } from '@/state/deviceStore'
import { fmtBytes, fmtDateTime, fmtPct } from '@/lib/format'
import { shortId } from '@/lib/id'
import { exportSummaryCsv } from '@/services/csv/exportCsv'
import { importSamplesCsv } from '@/services/csv/importCsv'
import { storageBytes } from '@/services/storage/safeStorage'
import { Badge, DataSourceBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { SelectField } from '@/components/ui/fields'
import { cn } from '@/lib/utils'

type SourceFilter = 'all' | DataSource
type StatusFilter = 'all' | 'completed' | 'stopped'
type DateRangeFilter = 'all' | '24h' | '7d' | '30d'
type SortFilter = 'newest' | 'oldest' | 'duration'

const DATE_RANGE_MAX_AGE_MS: Record<Exclude<DateRangeFilter, 'all'>, number> = {
  '24h': 24 * 3600_000,
  '7d': 7 * 24 * 3600_000,
  '30d': 30 * 24 * 3600_000,
}

export function HistoryPage() {
  const records = useHistoryStore((s) => s.records)
  const storageMode = useHistoryStore((s) => s.storageMode)
  const persistWarning = useHistoryStore((s) => s.persistWarning)
  const removeRecord = useHistoryStore((s) => s.removeRecord)
  const clearAll = useHistoryStore((s) => s.clearAll)
  const dismissPersistWarning = useHistoryStore((s) => s.dismissPersistWarning)
  const addRecord = useHistoryStore((s) => s.addRecord)
  const pushEvent = useDeviceStore((s) => s.pushEvent)

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [sortFilter, setSortFilter] = useState<SortFilter>('newest')
  const [confirmClear, setConfirmClear] = useState(false)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = Date.now()
    const result = records.filter((r) => {
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (dateRange !== 'all') {
        const startedAt = new Date(r.startedAt).getTime()
        if (Number.isNaN(startedAt) || now - startedAt > DATE_RANGE_MAX_AGE_MS[dateRange]) return false
      }
      if (q === '') return true
      return (
        r.id.toLowerCase().includes(q) ||
        r.config.batteryId.toLowerCase().includes(q) ||
        r.config.chemistry.toLowerCase().includes(q)
      )
    })
    if (sortFilter === 'oldest') return [...result].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    if (sortFilter === 'duration') return [...result].sort((a, b) => b.config.durationS - a.config.durationS)
    return result // store keeps records newest-first already
  }, [records, query, sourceFilter, statusFilter, dateRange, sortFilter])

  const storageKey = 'punarva.history.v1'
  const approxBytes = storageMode === 'local' ? storageBytes(window.localStorage, storageKey) : 0

  function onImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const res = importSamplesCsv(text)
      if (res.ok && res.record) {
        addRecord(res.record)
        pushEvent('info', `Imported test record ${res.record.id} (${res.record.samples.length} samples) from CSV.`)
        setImportErrors(null)
      } else {
        pushEvent('error', `CSV import rejected: ${res.errors[0] ?? 'invalid file'}`)
        setImportErrors(res.errors)
      }
    }
    reader.onerror = () => setImportErrors(['The file could not be read.'])
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      {/* Storage status */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3',
          storageMode === 'local' ? 'border-plum-500/50 bg-plum-800/50' : 'border-amber-400/35 bg-amber-400/10',
        )}
      >
        <History className="mt-0.5 h-5 w-5 shrink-0 text-sea-400" aria-hidden />
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-lavender/85">
          {storageMode === 'local' ? (
            <>
              Demo and imported records are stored <strong className="text-ivory">in this browser's local storage</strong>{' '}
              (approx. {fmtBytes(approxBytes)}). This is NOT the ESP32's MicroSD card — device records appear here only
              after you explicitly export them on the device side and import the CSV below.
            </>
          ) : (
            <>
              Browser storage is unavailable, so records are kept <strong className="text-amber-400">in memory for this session only</strong>{' '}
              and will be lost on reload. Export CSV to keep anything important.
            </>
          )}
        </div>
      </div>

      {persistWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1 text-xs leading-relaxed text-lavender/85">
            Local history is getting large and may exceed the browser's storage limit. Export a CSV backup and clear
            old records.
          </div>
          <Button variant="ghost" size="sm" onClick={dismissPersistWarning}>Dismiss</Button>
        </div>
      )}

      <Card>
        <CardHeader
          title="Recorded tests"
          icon={<History aria-hidden />}
          subtitle={`${records.length} record${records.length === 1 ? '' : 's'} · ${filtered.length} shown`}
          actions={
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" aria-hidden /> Import CSV
              </Button>
              <Button
                variant="teal"
                size="sm"
                onClick={() => exportSummaryCsv(records)}
                disabled={records.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden /> Export summary CSV
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} disabled={records.length === 0}>
                <Trash2 className="h-4 w-4" aria-hidden /> Clear
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4 pt-4">
          {/* Filters */}
          <div className="grid gap-3 sm:grid-cols-[1fr_150px_140px_140px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lavender/50" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by test ID, battery, chemistry…"
                aria-label="Search test history"
                className="h-10 w-full rounded-lg border border-plum-500/70 bg-plum-800/70 pl-9 pr-3 text-sm text-ivory placeholder:text-lavender/40 focus:border-copper-500/70 focus:outline-none focus:ring-1 focus:ring-copper-500/50"
              />
            </div>
            <SelectField value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} aria-label="Filter by data source">
              <option value="all">All sources</option>
              <option value="DEMO">Demo</option>
              <option value="HARDWARE">Hardware</option>
              <option value="IMPORTED">Imported</option>
            </SelectField>
            <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="stopped">Stopped early</option>
            </SelectField>
            <SelectField value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)} aria-label="Filter by date range">
              <option value="all">Any date</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </SelectField>
            <SelectField value={sortFilter} onChange={(e) => setSortFilter(e.target.value as SortFilter)} aria-label="Sort records">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="duration">Longest test</option>
            </SelectField>
          </div>

          {/* Import errors */}
          {importErrors && (
            <div className="rounded-lg border border-critical-500/40 bg-critical-500/10 px-4 py-3" role="alert">
              <p className="flex items-center gap-2 text-sm font-semibold text-critical-400">
                <FileWarning className="h-4 w-4" aria-hidden /> Import failed — invalid file structure
              </p>
              <ul className="mt-1.5 list-inside space-y-0.5 text-xs text-lavender/85">
                {importErrors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<History aria-hidden />}
              title={records.length === 0 ? 'No test records yet' : 'No records match your filters'}
              description={
                records.length === 0
                  ? 'Complete a test in Battery Check (or import a CSV) and it will be listed here.'
                  : 'Try a different search term or reset the filters.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-plum-600/60 text-[11px] uppercase tracking-wider text-lavender/60">
                    <th className="px-3 py-2.5 font-semibold">Test ID</th>
                    <th className="px-3 py-2.5 font-semibold">Date &amp; time</th>
                    <th className="px-3 py-2.5 font-semibold">Battery</th>
                    <th className="px-3 py-2.5 font-semibold">Duration</th>
                    <th className="px-3 py-2.5 font-semibold">Source</th>
                    <th className="px-3 py-2.5 font-semibold">Samples</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-plum-600/40">
                  {filtered.map((r) => (
                    <HistoryRow key={r.id} record={r} onDelete={() => removeRecord(r.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all test history?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAll()
                setConfirmClear(false)
                pushEvent('warn', 'All test history was cleared by the user.')
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-lavender">
          This permanently removes all {records.length} record{records.length === 1 ? '' : 's'} — including any
          imported device logs — from this browser. Export a CSV first if you need a backup.
        </p>
      </Modal>
    </div>
  )
}

function HistoryRow({ record, onDelete }: { record: TestRecord; onDelete: () => void }) {
  return (
    <tr className="group transition-colors hover:bg-plum-800/50">
      <td className="numeric px-3 py-3 font-semibold text-ivory">{shortId(record.id)}</td>
      <td className="numeric px-3 py-3 text-lavender">{fmtDateTime(record.startedAt)}</td>
      <td className="px-3 py-3 text-lavender">{record.config.batteryId || 'Unnamed battery'}</td>
      <td className="numeric px-3 py-3 text-lavender">{record.config.durationS}s</td>
      <td className="px-3 py-3"><DataSourceBadge source={record.source} /></td>
      <td className="numeric px-3 py-3 text-lavender">
        {record.samples.length}
        <span className={cn('ml-1.5 text-[11px]', record.completeness >= 0.95 ? 'text-sea-400/80' : 'text-amber-400')}>
          {fmtPct(record.completeness, 0)}
        </span>
      </td>
      <td className="px-3 py-3">
        <Badge tone={record.status === 'completed' ? 'teal' : 'amber'}>
          {record.status === 'completed' ? 'Completed' : 'Stopped'}
        </Badge>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link
            to={`/results/${record.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-sea-400 hover:bg-sea-400/10 hover:text-sea-300"
            aria-label={`Open report for test ${record.id}`}
          >
            Open <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-lavender/50 opacity-0 transition-opacity hover:bg-critical-500/10 hover:text-critical-400 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label={`Delete record ${record.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  )
}
