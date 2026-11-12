import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="flex min-h-screen items-center justify-center px-6 text-ink">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-raised p-8 text-center">
        <h1 className="text-3xl font-semibold">Page Not Found</h1>
        <p className="mt-3 text-ink-muted">The page you requested does not exist.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white hover:bg-brand-400 transition hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </div>
    </section>
  )
}
