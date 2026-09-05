import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="flex min-h-screen items-center justify-center px-6 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121721] p-8 text-center">
        <h1 className="text-3xl font-semibold">Page Not Found</h1>
        <p className="mt-3 text-slate-400">The page you requested does not exist.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-slate-100 px-4 py-2 text-slate-900 transition hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    </section>
  )
}
