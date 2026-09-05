import { Navigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'

export default function PrivateRoute({ children }) {
  const { user, hydrated } = useInterview()

  if (!hydrated) {
    return <div className="p-6 text-slate-300">Loading session...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
