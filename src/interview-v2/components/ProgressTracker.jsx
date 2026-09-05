export default function ProgressTracker({ progress }) {
  const percent = progress?.percent || 0
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Progress</h3>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-600">
        {progress?.answered || 0}/{progress?.total || 0} answered ({percent}%)
      </p>
    </div>
  )
}
