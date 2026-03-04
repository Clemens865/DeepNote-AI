import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './components/dashboard/Dashboard'
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout'
import { KnowledgeHubPage } from './components/knowledge/KnowledgeHubPage'
import { SetupWizard } from './components/onboarding/SetupWizard'

function App(): React.JSX.Element {
  const [showWizard, setShowWizard] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if onboarding is needed (no API key = first launch)
    window.api.getApiKey().then((key: string) => {
      setShowWizard(!key)
    }).catch(() => {
      setShowWizard(false)
    })
  }, [])

  // Loading state while checking config
  if (showWizard === null) {
    return <div className="w-full h-screen bg-slate-50 dark:bg-zinc-950" />
  }

  if (showWizard) {
    return <SetupWizard onComplete={() => setShowWizard(false)} />
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notebook/:id" element={<WorkspaceLayout />} />
          <Route path="/knowledge" element={<KnowledgeHubPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
