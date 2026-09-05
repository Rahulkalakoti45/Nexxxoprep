import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function cleanupInterviewStorage() {
  try {
    localStorage.removeItem('nexoprep_interview_v1')
  } catch (_e) {
    // ignore
  }

  try {
    const key = 'nexoprep_state_v2'
    const raw = localStorage.getItem(key)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return

    const cleaned = {
      ...parsed,
      interviewConfig: null,
      questionRounds: [],
      questions: [],
      answers: [],
      currentQuestionIndex: 0,
      currentInterview: null,
    }

    localStorage.setItem(key, JSON.stringify(cleaned))
  } catch (_e) {
    // ignore
  }
}

export default function InterviewMaintenancePage() {
  const navigate = useNavigate()

  useEffect(() => {
    cleanupInterviewStorage()
  }, [])

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111620] p-6 shadow-lg shadow-black/25">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs text-slate-200">
            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-200">Coming Soon</span>
            <span>Interview V2</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-100">Interview Module Under Rebuild</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            We are rebuilding the AI interview engine for a more realistic and stable experience.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">What’s coming next</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="rounded-lg border border-white/10 bg-[#0a0f17] px-3 py-2">Company-based rounds</li>
              <li className="rounded-lg border border-white/10 bg-[#0a0f17] px-3 py-2">AI interviewer + voice input</li>
              <li className="rounded-lg border border-white/10 bg-[#0a0f17] px-3 py-2">Behavior and confidence tracking</li>
              <li className="rounded-lg border border-white/10 bg-[#0a0f17] px-3 py-2">Stable session + analytics foundation</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0a0f17] p-4">
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/10">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-slate-100/10" />
                <p className="text-sm font-medium text-slate-200">Interview simulator placeholder</p>
                <p className="mt-1 text-xs text-slate-400">This section is temporarily disabled for stability.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:opacity-90"
          >
            Return to Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/resume')}
            className="rounded-lg border border-white/15 bg-black/20 px-4 py-2 font-medium text-slate-100 transition hover:bg-white/10"
          >
            Resume Builder Available
          </button>
        </div>
      </div>
    </section>
  )
}

