import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './components/dashboard/Dashboard'
import { WorkspaceLayout } from './components/workspace/WorkspaceLayout'

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notebook/:id" element={<WorkspaceLayout />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
