import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, SearchX } from 'lucide-react'
import { useHistoryStore } from '@/state/historyStore'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ResultsReport } from '@/components/results/ResultsReport'

export function ResultsPage() {
  const { testId } = useParams<{ testId: string }>()
  const record = useHistoryStore((s) => s.records.find((r) => r.id === testId))

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Engineering report"
        title="Test report"
        actions={
          <Link to="/history">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to history
            </Button>
          </Link>
        }
      />

      {record ? (
        <ResultsReport record={record} />
      ) : (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title="Test record not found"
          description={
            testId
              ? `No record with ID "${testId}" exists in this browser's history. Records created on another device or cleared storage are not available here.`
              : 'No test ID was provided.'
          }
          action={
            <Link to="/battery-check">
              <Button variant="primary" size="sm">Run a new test</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
