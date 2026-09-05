import { useEffect, useState } from 'react'

export default function TimerPanel({ startedAt, estimatedTime = 0 }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return undefined
    const interval = setInterval(() => {
      const startMs = new Date(startedAt).getTime()
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Timer</h3>
      <p className="text-sm text-slate-700">Elapsed: {elapsed}s</p>
      <p className="text-xs text-slate-500">Suggested for this question: {estimatedTime}s</p>
    </div>
  )
}
