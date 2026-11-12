export default function ProgressTracker({ progress }) {
  const percent = progress?.percent || 0
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Progress</p>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {progress?.answered || 0}/{progress?.total || 0} answered ({percent}%)
      </p>
    </div>
  )
}

