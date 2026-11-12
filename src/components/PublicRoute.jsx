import { Navigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'

export default function PublicRoute({ children }) {
  const { user, hydrated } = useInterview()

  if (!hydrated) {
    return <div className="p-6 text-ink-soft">Loading session...</div>
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
