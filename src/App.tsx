import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { OverviewPage } from '@/pages/OverviewPage'
import { BatteryCheckPage } from '@/pages/BatteryCheckPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { TechnologyPage } from '@/pages/TechnologyPage'
import { AboutPage } from '@/pages/AboutPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { FlashPage } from '@/pages/FlashPage'
import { TestPage } from '@/pages/TestPage'
import { ComponentPage } from '@/pages/ComponentPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { testEngine } from '@/state/testEngine'
import { useDeviceStore } from '@/state/deviceStore'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  // No timers survive the page.
  useEffect(() => {
    const onUnload = () => testEngine.dispose()
    window.addEventListener('beforeunload', onUnload)
    useDeviceStore.getState().pushEvent('info', 'PUNARVA dashboard session started.')
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      testEngine.dispose()
    }
  }, [])

  return (
    <>
      <ScrollToTop />
      <AppShell>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/battery-check" element={<BatteryCheckPage />} />
          <Route path="/results/:testId" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/technology" element={<TechnologyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/flash" element={<FlashPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/components" element={<ComponentPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </>
  )
}
