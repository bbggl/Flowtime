import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import Dashboard from './pages/Dashboard'
import Todo from './pages/Todo'
import Pomodoro from './pages/Pomodoro'
import Notes from './pages/Notes'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import AuthPage from './pages/AuthPage'

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/todo" element={<Todo />} />
        <Route path="/pomodoro" element={<Pomodoro />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
