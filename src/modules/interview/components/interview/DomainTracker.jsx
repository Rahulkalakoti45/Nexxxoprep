export default function DomainTracker({ domain }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Domain</p>
      <p className="mt-2 text-sm text-ink-soft">{domain || '—'}</p>
    </div>
  )
}

