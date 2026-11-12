import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import PageErrorBoundary from '../components/PageErrorBoundary.jsx'
import { isCodingSession } from '../lib/routes.js'

export default function AppLayout() {
  const { pathname } = useLocation()

  // A new page starts at the top, not wherever the previous page was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen text-ink">
      <Navbar />
      {/* Keyed on the route so each page eases in. Bottom padding clears the phone tab bar. */}
      <main key={pathname} className={`mx-auto w-full animate-rise px-4 sm:px-6 md:pb-16 ${isCodingSession(pathname) ? 'max-w-[1600px] pt-4' : 'max-w-6xl pt-6 sm:pt-10'} ${pathname.startsWith('/interview') || isCodingSession(pathname) ? 'pb-8' : 'pb-28'}`}>
        <PageErrorBoundary key={pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>
    </div>
  )
}
