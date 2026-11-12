import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import useInterview from '../hooks/useInterview.js'
import { isCodingSession } from '../lib/routes.js'
import { ButtonLink, Logo } from './ui/index.jsx'
import { cx } from './ui/helpers.js'
import { IconCode, IconFile, IconHome, IconLogout, IconMic } from './ui/icons.jsx'

const navItems = [
  { label: 'Home', to: '/dashboard', icon: IconHome },
  { label: 'Resume', to: '/resume', icon: IconFile },
  { label: 'Practice', to: '/setup', icon: IconMic },
  { label: 'Coding', to: '/coding', icon: IconCode },
]

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'mousedown' && ref.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] p-1 pr-1 transition hover:border-line-strong sm:pr-3"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-bold text-white">
          {initials(user?.name)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-ink-soft sm:block">{user?.name}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 mt-2 w-60 animate-rise rounded-2xl border border-line-strong bg-raised p-2 shadow-2xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft transition hover:bg-white/[0.06] hover:text-ink"
          >
            <IconLogout className="h-4 w-4" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useInterview()
  // During an interview the screen belongs to the interview: no tab bar over the call controls.
  const inInterview = pathname.startsWith('/interview') || isCodingSession(pathname)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
                    isActive ? 'bg-white/[0.07] text-ink' : 'text-ink-muted hover:bg-white/[0.04] hover:text-ink',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* Phones use the Practice tab in the bottom bar instead. */}
            <span className="hidden sm:block">
              <ButtonLink to="/setup" size="sm">
                <IconMic className="h-4 w-4" /> Start practice
              </ButtonLink>
            </span>
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      {/* Phones get a thumb-reachable tab bar instead of the top links. */}
      {inInterview ? null : (
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition', isActive ? 'text-brand-300' : 'text-ink-muted')
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      )}
    </>
  )
}
