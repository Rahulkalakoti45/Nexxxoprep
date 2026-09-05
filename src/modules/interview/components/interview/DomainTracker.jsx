export default function DomainTracker({ domain }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111620] p-4">
      <p className="text-sm font-semibold text-slate-100">Domain</p>
      <p className="mt-2 text-sm text-slate-300">{domain || '—'}</p>
    </div>
  )
}

