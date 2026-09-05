import { useEffect, useState } from 'react'

function format(sec) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function TimerPanel({ interviewStartedAt, roundStartedAt, questionStartedAt, suggestedSeconds = 0 }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const interviewSec = interviewStartedAt ? (now - interviewStartedAt) / 1000 : 0
  const roundSec = roundStartedAt ? (now - roundStartedAt) / 1000 : 0
  const questionSec = questionStartedAt ? (now - questionStartedAt) / 1000 : 0
  const remaining = Math.max(0, Math.round((suggestedSeconds || 0) - questionSec))

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm font-semibold text-slate-100">Timers</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-[#0a0f17] p-3">
          <p className="text-slate-400">Interview</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{format(interviewSec)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a0f17] p-3">
          <p className="text-slate-400">Round</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{format(roundSec)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a0f17] p-3">
          <p className="text-slate-400">Question</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{format(questionSec)}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">Suggested: {Math.round(suggestedSeconds)}s</p>
      <p className="mt-1 text-xs text-slate-400">Remaining: {format(remaining)} (estimate)</p>
    </div>
  )
}

