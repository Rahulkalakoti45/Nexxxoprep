import { NavLink, useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Resume', to: '/resume' },
  { label: 'Setup', to: '/setup' },
  { label: 'Interview', to: '/interview' },
  { label: 'Report', to: '/report' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { user, logout } = useInterview()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0d1017]/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">NexoPrep</p>
          <h1 className="text-lg font-semibold text-slate-100">AI Mock Interview Platform</h1>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
