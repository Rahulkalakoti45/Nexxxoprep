import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'

export default function AppLayout() {
  return (
    <div className="min-h-screen text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
